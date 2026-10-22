# Mô hình dữ liệu

```ts
Folder       { id, name, nameKey, createdAt, updatedAt }
VocabFile    { id, folderId, name, nameKey, createdAt, updatedAt }   // không đặt tên "File" vì trùng kiểu File có sẵn của trình duyệt
Term         { id, fileId, word, wordKey, meaning, example?, createdAt, updatedAt }
TermProgress { termId, box, correctCount, wrongCount, lastWrongAt?, lastStudiedAt? }
StudyDay     { date /* YYYY-MM-DD */, answeredCount }
Meta         { key, value }  // lastBackupAt
```
- Thời gian (`createdAt`...) lưu dạng ISO string. Danh sách từ sắp xếp theo `createdAt` giảm dần.
- `nameKey`, `wordKey` = giá trị đã chuẩn hóa (NFC, trim, gộp khoảng trắng, chữ thường), chỉ dùng để so trùng và tìm kiếm. Tính trong repository khi ghi, không lưu trong file backup.
- Mọi chuỗi người dùng nhập được chuẩn hóa **Unicode NFC** trước khi lưu. Tiếng Việt gõ trên Mac/iPhone có thể ở dạng NFD, nhìn giống hệt nhưng so sánh sẽ khác.
- Phiên bản schema là version của Dexie (`db.verno`), không lưu riêng.

Index Dexie:
```
folders:   id, &nameKey
files:     id, folderId, &[folderId+nameKey]
terms:     id, fileId, wordKey, createdAt
progress:  termId
studyDays: date
meta:      key
```
`TermProgress` tách khỏi `Term` vì nội dung từ và trạng thái học thay đổi vì lý do khác nhau. Ý nghĩa các trường tiến độ: [learn-algorithm.md](learn-algorithm.md#tiến-độ-lưu-cho-mỗi-từ-termprogress).

## Ràng buộc toàn vẹn
IndexedDB không có khóa ngoại nên kiểm tra ở `domain/` (Zod) và trong repository:
- `id`: UUID.
- `name`, `word`, `meaning`: bắt buộc, đã trim, 1–200 ký tự. `example`: tối đa 500 ký tự.
- Tên folder không trùng. Tên file không trùng trong cùng folder. So sánh qua `nameKey` và được **DB chặn bằng unique index**, không chỉ kiểm tra trong code. Lỗi `ConstraintError` của Dexie được đổi thành thông báo dễ hiểu.
- `folderId`, `fileId`, `termId` phải trỏ tới bản ghi tồn tại.
- Xóa folder → xóa file, từ, tiến độ bên trong. Xóa từ → xóa tiến độ. Luôn **trong một transaction**.
- Sửa nội dung từ: giữ nguyên tiến độ.
- Từ trùng ở file khác: chỉ cảnh báo, không chặn (tra theo index `wordKey`).
- `box` trong khoảng 1..5; `correctCount`, `wrongCount`, `answeredCount` là số nguyên ≥ 0.

## Sao lưu JSON
```json
{ "schemaVersion": 1, "exportedAt": "...", "folders": [], "files": [], "terms": [], "progress": [], "studyDays": [] }
```
Không xuất `nameKey`/`wordKey` (tính lại khi nhập) và `Meta`.
Nhập: kiểm tra kích thước ≤ 5 MB → parse → validate bằng Zod (kể cả ràng buộc tham chiếu) → migration nếu là bản cũ → hỏi xác nhận "Replace all current data?" → ghi trong **một transaction**. Lỗi ở bất kỳ bước nào thì dữ liệu hiện tại giữ nguyên.

## Migration
- Đổi cấu trúc → thêm `db.version(n).upgrade(...)` của Dexie, tăng `schemaVersion` của file backup và thêm hàm migrate cho file JSON cũ.
- Mỗi migration có test: dữ liệu version cũ → đúng dữ liệu version mới.
- Không bao giờ sửa migration đã phát hành; chỉ thêm migration mới.
- Nhiều tab: khi bản mới nâng version DB, tab cũ nhận sự kiện `versionchange` → đóng kết nối và báo "A new version is available. Reloading…".
- File backup có `schemaVersion` lớn hơn app hiện tại → từ chối nhập, báo "This backup is from a newer version. Reload the page to update the app.".
