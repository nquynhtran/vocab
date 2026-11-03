# Phạm vi

Web app học từ vựng cá nhân (một người dùng), chỉ có chế độ **Learn** giống Quizlet. Mở trên trình duyệt là học được, không cần chạy local.

## Có làm (MVP, giai đoạn 0–6)
| # | Tính năng | Mô tả |
|---|-----------|-------|
| F1 | Folder | Tạo / đổi tên / xóa folder theo chủ đề |
| F2 | File (bộ từ) | Trong folder tạo / đổi tên / xóa file |
| F3 | Từ vựng | 4 ô: **Từ vựng**, **Loại từ** (chọn từ danh sách, không bắt buộc), **Nghĩa**, **Ví dụ** (không bắt buộc). Thêm / sửa / xóa bất cứ lúc nào. Từ đã có (ở file khác **hoặc cùng file**) → cảnh báo "Already in *Folder / File*" nhưng vẫn cho thêm (từ nhiều nghĩa là hợp lệ) |
| F4 | Xem danh sách | Bấm vào file → **list** toàn bộ từ (không dùng thẻ lật), từ mới nhất trên cùng. Mỗi file hiện số từ và % đã thuộc. Nút 🔊 cạnh mỗi từ để nghe phát âm (giọng Anh-Anh, giọng đọc có sẵn của trình duyệt) |
| F5 | Learn | Trắc nghiệm + viết lại, ưu tiên từ hay sai → [learn-algorithm.md](learn-algorithm.md) |
| F6 | Streak | Ngày đã học, chuỗi ngày liên tiếp, lịch → [streak.md](streak.md) |
| F7 | Sao lưu | Xuất / nhập JSON → [data-model.md](data-model.md#sao-lưu-json) |

## Giai đoạn 7
Đăng nhập + lưu trên cloud để máy tính và iPhone dùng chung dữ liệu → [cloud-sync.md](cloud-sync.md).

## Không làm (YAGNI)
Nhiều người dùng, flashcard, Match, Test, chia sẻ bộ từ, file ghi âm / phát âm ngoài danh sách từ, hình ảnh, chiều hỏi Từ → Nghĩa.

## Đã chốt làm, chưa thiết kế xong (đợt 2, qua `challenger` trước)
- **Ghi chú cho file**: một ô chữ dài (ví dụ bài đọc chứa các từ), mục "Notes" thu gọn được ở cuối trang File, chữ thường giữ xuống dòng, có bộ đếm và giới hạn ký tự.
- **Phiên âm** (IPA) cho từ: không bắt buộc, gõ/dán tay được, nút **Look up** tự điền từ một từ điển miễn phí trên mạng (lỗi thì báo nhẹ, không chặn lưu). Hiện ở danh sách từ và màn phản hồi Learn.
- Cả hai đổi cấu trúc dữ liệu trong cùng một lần (Dexie, backup, migration cloud).

## Có thể làm sau (chưa cam kết)
- Dán nhanh danh sách từ (mỗi dòng `từ<TAB>nghĩa<TAB>ví dụ`).
- Học gộp nhiều file / cả folder.
- Ôn riêng các từ hay sai.

## Luồng người dùng
```
Home (Folder + Streak)
  └─ Folder "IELTS Environment"
       └─ File "Unit 1" ──► Danh sách từ (thêm/sửa/xóa)
                               └─ [Learn] ──► Phiên học ──► Kết quả ──► ghi nhận ngày học
```
Chi tiết từng màn hình: [ui.md](ui.md).
