# Giao diện

Giai đoạn 0–6 ưu tiên máy tính, nhưng CSS **responsive ngay từ đầu** để giai đoạn 7 (iPhone) chỉ cần tinh chỉnh.

## Ngôn ngữ
- **Toàn bộ chữ trên giao diện bằng tiếng Anh.** Tài liệu và trao đổi với người dùng vẫn bằng tiếng Việt.
- Nội dung người dùng nhập (nghĩa, ví dụ) có thể là tiếng Việt; font phải hiển thị đủ dấu tiếng Việt.
- Không làm đa ngôn ngữ (i18n). Chữ giao diện viết thẳng trong component (YAGNI).
- `<html lang="en">`.

## Màn hình
1. **Home**: danh sách folder, nút "New folder", ô streak (🔥 N-day streak, "Today: 4/10 answers") và lịch nhỏ.
2. **Folder**: danh sách file (tên, số từ, % mastered), nút "New file".
3. **File**: bảng từ (Term (loại từ) 🔊 · Meaning · Example), từ mới nhất trên cùng, form thêm từ ở đầu bảng, nút **Learn** (ẩn khi file trống, thay bằng "Add some terms to start learning").
4. **Learn**: một câu hỏi mỗi lần, thanh tiến độ (số từ đã đạt mức 2 / tổng), nút "Stop". Phản hồi đúng/sai ngay; câu sai và câu viết có màn phản hồi với nút **Continue** (và **"I was right"** nếu câu viết bị chấm sai).
5. **Tóm tắt vòng**: các từ vừa học, đúng/sai; nút "Next round".
6. **Kết thúc phiên**: số câu đúng/sai, các từ sai nhiều nhất trong phiên; nút "Study again" và "Back to list".

Đường dẫn (`HashRouter`): `#/` Home · `#/folders/:folderId` Folder · `#/files/:fileId` File · đường dẫn khác → "Page not found" kèm link về Home.

## Thao tác
- Xóa folder / file / từ luôn hỏi xác nhận bằng `window.confirm` có sẵn của trình duyệt, ghi rõ sẽ xóa bao nhiêu thứ bên trong (ví dụ `Delete folder "IELTS" and its 3 files (120 terms)?`; folder/file trống thì chỉ `Delete folder "IELTS"?`).
- Đổi tên folder/file và sửa từ: sửa ngay tại dòng (form thay chỗ dòng đó), `Escape` hoặc "Cancel" để hủy.
- Thêm từ: thêm xong thì xóa form và đưa con trỏ về ô Term để nhập liên tục.
- Cảnh báo từ trùng hiện **ngay khi gõ** ô Term (chờ ~300 ms sau lần gõ cuối, bỏ qua kết quả cũ về muộn), cả khi thêm và khi sửa (khi sửa không so với chính nó). Không chặn nút Add.
- Lỗi nhập (`ValidationError`, `DuplicateNameError`) hiện cạnh ô nhập. Sau mỗi lần ghi (kể cả lỗi) trang tải lại, nên thứ đang mở đã bị xóa ở tab khác (`EntityNotFoundError`) → trang "no longer exists" kèm link về Home. Lỗi không lường trước → "Something went wrong. Please try again.".
- Ô **Part of speech** là `<select>` đặt sau ô Term, mặc định trống. Danh sách hiện loại từ dạng viết tắt sau từ, ví dụ `run (v.)`.
- Nút 🔊 (`Listen to "run"`) đọc từ bằng `speechSynthesis`, `lang = en-GB`. Trình duyệt không hỗ trợ thì ẩn nút. Bấm lần nữa khi đang đọc thì đọc lại từ đầu.
- Nút **Learn** chỉ xuất hiện sau khi làm xong Learn.

## Responsive
- Viết CSS cho màn hẹp (~375px) trước, mở rộng bằng `min-width`. Nội dung rộng tối đa ~720px, căn giữa.
- Nút bấm cao ≥ 44px. Đáp án trắc nghiệm xếp dọc, rộng hết chiều ngang.
- Ô viết đáp án: `autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"`, để bàn phím điện thoại không tự sửa đáp án.
- Dùng `dvh` thay `vh`, để câu hỏi và ô nhập không bị bàn phím che.

## Phím tắt (máy tính)
Phím `1`–`4` chọn đáp án trắc nghiệm, `Enter` gửi câu viết / sang câu tiếp theo.
