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

## Giai đoạn 3b (đợt 2): ghi chú file + phiên âm
| # | Tính năng | Mô tả |
|---|-----------|-------|
| F8 | Ghi chú cho file | Một ô chữ dài (ví dụ bài đọc chứa các từ), mục **Notes** thu gọn được ở **đầu** trang File (#65). Chữ thường (không định dạng, không link), giữ xuống dòng, có bộ đếm và giới hạn ký tự → [ui.md](ui.md#ghi-chú-file-f8), [data-model.md](data-model.md) |
| F9 | Phiên âm (IPA) | Ô **Pronunciation** không bắt buộc ở form từ, gõ/dán tay được; nút **Look up** tự điền từ Wiktionary (lỗi thì báo nhẹ, không chặn lưu) → [pronunciation-lookup.md](pronunciation-lookup.md). Hiện ở danh sách từ, màn phản hồi Learn và các danh sách tóm tắt sau vòng/phiên (#70), không hiện lúc đang hỏi (lộ đáp án câu viết) |

Cả hai đổi cấu trúc dữ liệu trong **một lần**: Dexie v5, backup `schemaVersion` 3, migration cloud + `min_client_version` 3 ([cloud-sync.md](cloud-sync.md#giai-đoạn-3b-ghi-chú--phiên-âm)). Không làm: định dạng chữ trong ghi chú, ghi chú cho folder hay cho từng từ, tìm kiếm trong ghi chú, tự tra phiên âm khi gõ (chỉ khi bấm nút), tra hàng loạt cho từ cũ. Đã qua `challenger`, chốt #65–#67.

## Có thể làm sau (chưa cam kết)
- Dán nhanh danh sách từ (mỗi dòng `từ<TAB>nghĩa<TAB>ví dụ`).
- Học gộp nhiều file / cả folder.
- Ôn riêng các từ hay sai.

## Luồng người dùng
```
Home (Folder + Streak)
  └─ Folder "IELTS Environment"
       └─ File "Unit 1" ──► Danh sách từ (thêm/sửa/xóa)
                               ├─ Notes (đầu trang, thu gọn được)
                               └─ [Learn] ──► Phiên học (mỗi câu ghi nhận ngày học) ──► Kết quả
```
Chi tiết từng màn hình: [ui.md](ui.md).
