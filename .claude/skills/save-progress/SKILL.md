---
name: save-progress
description: Rà soát và cập nhật toàn bộ ghi chú dự án (PROGRESS.md, docs/, decisions.md), dọn phần lỗi thời, rồi tạo bản tóm tắt để chuyển phiên. Dùng khi người dùng nói lưu tiến độ, chuyển phiên, tạm dừng, khi xong một mục checklist, hoặc khi phiên đã dài.
---

Mục tiêu: sau khi chạy, một phiên mới chỉ cần đọc PROGRESS.md là làm tiếp được, và tài liệu không mâu thuẫn với code hay với nhau.

## 1. Kiểm chứng trạng thái thật
`git status`, `git log --oneline -10`, và `npm run check` nếu đã có code. Không đánh dấu việc gì là xong nếu chưa kiểm chứng.

## 2. Gom những gì chưa được ghi
Đọc lại phiên hiện tại, liệt kê:
- Quyết định đã chốt với người dùng nhưng chưa có trong `docs/decisions.md`.
- Thay đổi thiết kế chưa cập nhật vào file chủ đề trong `docs/`.
- Câu hỏi còn treo, việc đã hứa làm sau.

## 3. Rà soát và cập nhật toàn bộ tài liệu
Đọc hết `docs/*.md`, `CLAUDE.md`, `PROGRESS.md` (tổng dưới ~500 dòng nên đọc hết được):
- Ghi các mục ở bước 2 vào đúng chỗ. Quyết định mới ghi vào `decisions.md`; nếu thay quyết định cũ thì ghi "thay cho #n", không xóa dòng cũ.
- Tìm mâu thuẫn: giữa các file với nhau, giữa tài liệu và code thật (tên hàm, tên trường, cấu trúc thư mục). Sửa theo cái đúng; không chắc cái nào đúng thì hỏi người dùng.
- Kiểm tra link nội bộ còn trỏ đúng file và heading.
- Mục lục `docs/README.md` khớp với các file đang có.

## 4. Dọn dẹp
- Xóa nội dung lỗi thời: tính năng đã bỏ, ghi chú tạm, TODO đã xong, câu hỏi đã có câu trả lời.
- File tài liệu dài quá ~150 dòng → tách theo chủ đề, cập nhật mục lục.
- PROGRESS.md: nhật ký chỉ giữ 5 dòng mới nhất; toàn file dưới 50 dòng.
- **Code:** chỉ liệt kê các ứng viên cần dọn (code chết, file thừa, dependency không dùng) cho người dùng, **không tự xóa code** (Chesterton's Fence). Chỉ làm khi đang cuối một giai đoạn.

## 5. Cập nhật PROGRESS.md
- **Đang ở đâu:** giai đoạn; **một** việc tiếp theo cụ thể (file, lệnh); điều đang vướng.
- Tick `[x]` các mục đã kiểm chứng ở bước 1.
- Thêm một dòng nhật ký `YYYY-MM-DD — việc đã làm` lên đầu.

## 6. Báo cáo
Bằng tiếng Việt, ngắn:
- Đã cập nhật / dọn những gì (mỗi ý một dòng).
- Việc tiếp theo.
- Nếu đang chuyển phiên: thêm **bản tóm tắt để dán sang phiên mới** trong một khối code. Chỉ ghi những gì *không có* trong file (PROGRESS.md đã tự nạp): việc đang làm dở, giả thuyết đang kiểm tra, điều người dùng vừa dặn. Tối đa ~10 dòng, mở đầu bằng "Tiếp tục dự án vocab."
