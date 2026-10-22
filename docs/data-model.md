# Mô hình dữ liệu

```ts
Folder       { id, name, createdAt, updatedAt }
VocabFile    { id, folderId, name, createdAt, updatedAt }   // không đặt tên "File" vì trùng kiểu File có sẵn của trình duyệt
Term         { id, fileId, word, meaning, example?, createdAt, updatedAt }
TermProgress { termId, box, correctCount, wrongCount, lastWrongAt?, lastStudiedAt? }
StudyDay     { date /* YYYY-MM-DD */, answeredCount }
Meta         { key, value }  // lastBackupAt
```
Kiểu và validate định nghĩa bằng Zod ở `src/domain/schemas.ts`; chuẩn hóa chuỗi ở `src/domain/text.ts`.
- Thời gian (`createdAt`...) lưu dạng ISO string. `id` là UUID v4 (`z.uuid()` kiểm tra chặt theo RFC, nên id giả trong test cũng phải đúng dạng v4).
- **Chuẩn hóa khi lưu** (`normalizeText`): Unicode **NFC**, trim, gộp mọi khoảng trắng (kể cả xuống dòng) thành một dấu cách. Tiếng Việt gõ trên Mac/iPhone có thể ở dạng NFD, nhìn giống hệt nhưng so sánh sẽ khác. Mọi ô nhập đều một dòng nên gộp xuống dòng không mất gì; nếu sau này có ô nhiều dòng thì phải xem lại.
- **Khóa so sánh** (`toKey`): `normalizeText` + chữ thường (`toLowerCase`, không phụ thuộc locale) + nháy cong → nháy thẳng (iPhone tự đổi `'` thành `’`). Giữ dấu tiếng Việt ("ma" ≠ "má"). Đây là hàm chuẩn hóa duy nhất cho so trùng; chấm câu viết dùng lại hàm này.
- `nameKey`, `wordKey` = `toKey(name)`, `toKey(word)`, chỉ dùng để so trùng và tìm kiếm. **Không có trong kiểu domain**, chỉ có trong bản ghi DB: repository tính khi ghi và bỏ đi khi trả về. Không lưu trong file backup.
- Sắp xếp: folder và file theo tên (`compareNames` ở domain, mọi repository dùng chung để thứ tự không phụ thuộc DB); từ theo `createdAt` giảm dần, bằng nhau thì theo `id`.
- Phiên bản schema là version của Dexie (`db.verno`), không lưu riêng.
- Tên DB: `vocab-app` (hằng số trong `src/data/db.ts`). Không đổi tên: IndexedDB tính theo origin `nquynhtran.github.io`, dùng chung với mọi repo Pages khác của tài khoản, nên tên phải riêng biệt.

Index Dexie (version 1, đã tạo sẵn đủ bảng cho các giai đoạn sau):
```
folders:   id, &nameKey
files:     id, folderId, &[folderId+nameKey]
terms:     id, fileId, wordKey
progress:  termId
studyDays: date
meta:      key
```
Không có index `createdAt`: danh sách từ lọc theo `fileId` rồi sắp xếp trong bộ nhớ. Cần thì thêm index ở version sau (thêm index không phải migrate dữ liệu).
`TermProgress` tách khỏi `Term` vì nội dung từ và trạng thái học thay đổi vì lý do khác nhau. Ý nghĩa các trường tiến độ: [learn-algorithm.md](learn-algorithm.md#tiến-độ-lưu-cho-mỗi-từ-termprogress).

## Ràng buộc toàn vẹn
IndexedDB không có khóa ngoại nên kiểm tra ở `domain/` (Zod) và trong repository:
- `id`: UUID.
- `name`, `word`, `meaning`: bắt buộc, đã trim, 1–200 ký tự. `example`: tối đa 500 ký tự.
- Tên folder không trùng. Tên file không trùng trong cùng folder. So sánh qua `nameKey`: repository tra index trong cùng transaction ghi để báo lỗi `DuplicateNameError` kèm tên, và **unique index của DB là lớp chặn cuối**. IndexedDB chạy tuần tự các transaction rw trên cùng bảng (kể cả giữa các tab), nên khi đã kiểm tra trước thì `ConstraintError` chỉ xảy ra khi có bug; lỗi này **không** bị đổi thành `DuplicateNameError` để khỏi che bug. Không bắt lỗi bên trong callback của transaction: bắt mà không ném lại thì Dexie không hủy transaction.
- Tạo mới dùng `add` (trùng `id` thì báo lỗi), không dùng `put` (ghi đè im lặng).
- `folderId`, `fileId`, `termId` phải trỏ tới bản ghi tồn tại. Kiểm tra **trong cùng transaction rw có cả bảng cha**, kể cả khi sửa/đổi tên: đọc bản ghi → không có thì `EntityNotFoundError` → kiểm tra cha còn tồn tại → ghi. Nhờ vậy tab khác xóa cha cùng lúc không tạo ra bản ghi mồ côi.
- Đổi tên/sửa bản ghi không tồn tại → `EntityNotFoundError`. Xóa bản ghi không tồn tại → không làm gì (tab khác có thể đã xóa).
- Xóa folder → xóa file, từ, tiến độ bên trong. Xóa từ → xóa tiến độ. Luôn **trong một transaction**.
- Sửa nội dung từ: giữ nguyên tiến độ.
- Từ trùng ở file khác: chỉ cảnh báo, không chặn (tra theo index `wordKey`).
- `box` trong khoảng 1..5; `correctCount`, `wrongCount`, `answeredCount` là số nguyên ≥ 0.

## Sao lưu JSON
```json
{ "schemaVersion": 1, "exportedAt": "...", "folders": [], "files": [], "terms": [], "progress": [], "studyDays": [] }
```
Không xuất `nameKey`/`wordKey` (tính lại khi nhập) và `Meta`.
Nhập: kiểm tra kích thước ≤ 5 MB → parse → validate bằng Zod (kể cả ràng buộc tham chiếu, và trùng `toKey` giữa các bản ghi trong chính file, ví dụ "IELTS" và "ielts ") → migration nếu là bản cũ → hỏi xác nhận "Replace all current data?" → ghi trong **một transaction**. Lỗi ở bất kỳ bước nào thì dữ liệu hiện tại giữ nguyên.

## Migration
- Đổi cấu trúc → thêm `db.version(n).upgrade(...)` của Dexie, tăng `schemaVersion` của file backup và thêm hàm migrate cho file JSON cũ.
- Mỗi migration có test: dữ liệu version cũ → đúng dữ liệu version mới.
- Đổi `toKey` (hoặc `normalizeText`) cũng là đổi dữ liệu: key đã lưu sẽ lệch, cảnh báo trùng sót và unique index chặn sai. Phải thêm version Dexie có migration tính lại mọi `nameKey`/`wordKey`, và xử lý trường hợp hai bản ghi cũ thành trùng key.
- Không bao giờ sửa migration đã phát hành; chỉ thêm migration mới.
- Nhiều tab: khi bản mới nâng version DB, tab cũ nhận sự kiện `versionchange` → `db.close({ disableAutoOpen: true })` rồi báo "A new version is available. Reloading…". Phải tắt tự mở lại: handler mặc định của Dexie cho tự mở lại, khi đó code cũ sẽ ghi dữ liệu theo cấu trúc cũ vào DB đã nâng version. Handler có sẵn từ version 1, vì tab đang chạy bản cũ phải có nó thì mới xử lý được khi bản mới ra.
- File backup có `schemaVersion` lớn hơn app hiện tại → từ chối nhập, báo "This backup is from a newer version. Reload the page to update the app.".
