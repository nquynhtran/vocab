# Giao diện

Giai đoạn 0–6 ưu tiên máy tính, nhưng CSS **responsive ngay từ đầu** để giai đoạn 7 (iPhone) chỉ cần tinh chỉnh.

## Ngôn ngữ
- **Toàn bộ chữ trên giao diện bằng tiếng Anh.** Tài liệu và trao đổi với người dùng vẫn bằng tiếng Việt.
- Nội dung người dùng nhập (nghĩa, ví dụ) có thể là tiếng Việt; font phải hiển thị đủ dấu tiếng Việt.
- Không làm đa ngôn ngữ (i18n). Chữ giao diện viết thẳng trong component (YAGNI).
- `<html lang="en">`.

## Màn hình
0. **Sign in** (bản cloud): Email, Password, nút "Sign in". Mất phiên khi đang dùng → hộp "Sign in" phủ kín trang, app vẫn giữ nguyên bên dưới, kèm câu "You were signed out…" ([cloud-sync.md](cloud-sync.md#đăng-nhập--phiên-bước-5-4345)). Header có nút **Sign out**.
1. **Home**: danh sách folder, nút "New folder", ô streak (🔥 N-day streak, "Today: 4/10 answers") và lịch nhỏ; cuối trang là mục Backup với nút "Export JSON" (tải file `vocab-backup-YYYY-MM-DD.json`, ngày theo giờ máy). Khi chưa có folder nào: thêm mục "Import a backup" (chọn file → nút "Import 1 folder, 2 files, 30 terms"; lỗi file hiện tối đa 5 dòng kèm vị trí), xem [cloud-sync.md](cloud-sync.md#chuyển-dữ-liệu-local-lên-cloud-33-46).
2. **Folder**: danh sách file (tên, số từ, % mastered), nút "New file".
3. **File**: bảng từ (Term (loại từ) 🔊 · Meaning · Example), từ mới nhất trên cùng, form thêm từ ở đầu bảng, nút **Learn** (ẩn khi file trống, thay bằng "Add some terms to start learning").
4. **Learn** (`#/files/:fileId/learn`): có phiên dừng dở trên máy này thì hỏi Continue / Start over trước ([learn-algorithm.md](learn-algorithm.md#học-tiếp-sau-khi-dừng-58)). Một câu hỏi mỗi lần, thanh tiến độ hai màu ("3 learned · 4 familiar / 12"), nút "Stop" (ở màn câu hỏi và màn lỗi lưu; màn phản hồi chỉ có Continue). Trắc nghiệm: đúng → tô xanh, sang câu sau; sai → màn phản hồi tô đỏ đáp án đã chọn, tô xanh đáp án đúng. Câu viết luôn có màn phản hồi: đúng / gần đúng (hiện chữ đã gõ và chữ đúng) / sai (hiện đáp án đúng, kèm nút **"I was right"**). Màn phản hồi có 🔊 đọc từ đúng (không hiện lúc đang hỏi để khỏi lộ đáp án) và nút **Continue** được focus sẵn. Lưu hỏng → "Your answer could not be saved." + **Retry** / **Stop** ([learn-algorithm.md](learn-algorithm.md#recordanswer)).
5. **Tóm tắt vòng**: các từ vừa học kèm số lần đúng/sai trong vòng; chạm vào từ (cả chữ lẫn 🔊 nhỏ, mờ phía sau là một nút) để nghe đọc; nút "Next round".
6. **Kết thúc phiên** (học hết, hoặc bấm Stop): số câu đúng/sai, tối đa 5 từ sai nhiều nhất trong phiên (chỉ từ sai ≥ 1 lần); nút "Study again" (đọc lại dữ liệu, mở phiên mới) và "Back to list" (về trang File). Danh sách từ chạm để nghe như màn tóm tắt vòng. Có dòng "Terms count as mastered once you get them right on 2 different days." để "learned" ở đây không bị hiểu là "% mastered" ở trang Folder.

Đường dẫn (`HashRouter`): `#/` Home · `#/folders/:folderId` Folder · `#/files/:fileId` File · `#/files/:fileId/learn` Learn · đường dẫn khác → "Page not found" kèm link về Home.

## Thao tác
- Mỗi hàng folder / file / từ có nút **⋯** (`More actions for "run"`) mở menu nhỏ: Rename (Edit với từ) và Delete (#59). Menu tự viết (không dùng `popover` vì iOS cũ): bấm ra ngoài hoặc `Escape` thì đóng và trả focus về nút ⋯; mở bằng bàn phím thì focus mục đầu, mũi tên lên/xuống để chọn. Một component dùng chung cho cả ba loại hàng. Mục trong menu cao ≥ 44px.
- Xóa folder / file / từ luôn hỏi xác nhận bằng `window.confirm` có sẵn của trình duyệt, ghi rõ sẽ xóa bao nhiêu thứ bên trong (ví dụ `Delete folder "IELTS" and its 3 files (120 terms)?`; folder/file trống thì chỉ `Delete folder "IELTS"?`).
- Đổi tên folder/file và sửa từ: sửa ngay tại dòng (form thay chỗ dòng đó), `Escape` hoặc "Cancel" để hủy.
- Thêm từ: thêm xong thì xóa form và đưa con trỏ về ô Term để nhập liên tục.
- Cảnh báo từ trùng hiện **ngay khi gõ** ô Term (chờ ~300 ms sau lần gõ cuối, bỏ qua kết quả cũ về muộn), cả khi thêm và khi sửa (khi sửa không so với chính nó). Không chặn nút Add.
- Lỗi nhập (`ValidationError`, `DuplicateNameError`) hiện cạnh ô nhập. Sau mỗi lần ghi (kể cả lỗi) trang tải lại, nên thứ đang mở đã bị xóa ở tab khác (`EntityNotFoundError`) → trang "no longer exists" kèm link về Home. Lỗi cloud (`ConnectionError`, `SessionExpiredError`, `InvalidStoredDataError`) có câu báo riêng, hiện như lỗi nhập và form giữ nguyên chữ; nếu lần tải lại sau đó cũng hỏng thì trang giữ dữ liệu cũ kèm dòng "This page could not be refreshed…". Lỗi không lường trước → "Something went wrong. Please try again.".
- Form thêm/sửa từ bật kiểm tra chính tả có sẵn của trình duyệt (gạch đỏ) ở ô **Term** và **Example** (`spellcheck="true" lang="en"`), tắt ở ô **Meaning** vì thường là tiếng Việt (#60). Ô trả lời ở màn Learn vẫn tắt (xem Responsive).
- Ô **Part of speech** là `<select>` đặt sau ô Term, mặc định trống. Danh sách hiện loại từ dạng viết tắt sau từ, ví dụ `run (v.)`.
- Nút 🔊 (`Listen to "run"`) đọc từ bằng `speechSynthesis`, `lang = en-GB`. Trình duyệt không hỗ trợ thì ẩn nút. Bấm lần nữa khi đang đọc thì đọc lại từ đầu.

## Responsive
- Viết CSS cho màn hẹp (~375px) trước, mở rộng bằng `min-width`. Nội dung rộng tối đa ~720px, căn giữa.
- Nút bấm cao ≥ 44px. Đáp án trắc nghiệm xếp dọc, rộng hết chiều ngang.
- Ô viết đáp án: `autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"`, để bàn phím điện thoại không tự sửa đáp án.
- Dùng `dvh` thay `vh`, để câu hỏi và ô nhập không bị bàn phím che.

## Phím tắt (máy tính)
Phím `1`–`4` chọn đáp án trắc nghiệm (bỏ qua khi đang gõ trong ô nhập), `Enter` gửi câu viết / bấm Continue (nút được focus sẵn). Đã làm cùng màn Learn (giai đoạn 3).
