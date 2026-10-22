# Phạm vi

Web app học từ vựng cá nhân (một người dùng), chỉ có chế độ **Learn** giống Quizlet. Mở trên trình duyệt là học được, không cần chạy local.

## Có làm (MVP, giai đoạn 0–6)
| # | Tính năng | Mô tả |
|---|-----------|-------|
| F1 | Folder | Tạo / đổi tên / xóa folder theo chủ đề |
| F2 | File (bộ từ) | Trong folder tạo / đổi tên / xóa file |
| F3 | Từ vựng | 3 ô: **Từ vựng**, **Nghĩa**, **Ví dụ** (ví dụ không bắt buộc). Thêm / sửa / xóa bất cứ lúc nào. Từ đã có (ở file khác **hoặc cùng file**) → cảnh báo "Already in *Folder / File*" nhưng vẫn cho thêm (từ nhiều nghĩa là hợp lệ) |
| F4 | Xem danh sách | Bấm vào file → **list** toàn bộ từ (không dùng thẻ lật), từ mới nhất trên cùng. Mỗi file hiện số từ và % đã thuộc |
| F5 | Learn | Trắc nghiệm + viết lại, ưu tiên từ hay sai → [learn-algorithm.md](learn-algorithm.md) |
| F6 | Streak | Ngày đã học, chuỗi ngày liên tiếp, lịch → [streak.md](streak.md) |
| F7 | Sao lưu | Xuất / nhập JSON → [data-model.md](data-model.md#sao-lưu-json) |

## Giai đoạn 7
Đăng nhập + lưu trên cloud để máy tính và iPhone dùng chung dữ liệu → [cloud-sync.md](cloud-sync.md).

## Không làm (YAGNI)
Nhiều người dùng, flashcard, Match, Test, chia sẻ bộ từ, âm thanh, hình ảnh, chiều hỏi Từ → Nghĩa.

## Có thể làm sau (chưa cam kết)
- Dán nhanh danh sách từ (mỗi dòng `từ<TAB>nghĩa<TAB>ví dụ`).
- Học gộp nhiều file / cả folder.

## Luồng người dùng
```
Home (Folder + Streak)
  └─ Folder "IELTS Environment"
       └─ File "Unit 1" ──► Danh sách từ (thêm/sửa/xóa)
                               └─ [Learn] ──► Phiên học ──► Kết quả ──► ghi nhận ngày học
```
Chi tiết từng màn hình: [ui.md](ui.md).
