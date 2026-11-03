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
3. **File**: bảng từ (Term (loại từ) /phiên âm/ 🔊 · Meaning · Example), từ mới nhất trên cùng, form thêm từ ở đầu bảng, nút **Learn** (ẩn khi file trống, thay bằng "Add some terms to start learning"). Đầu trang (trên form thêm từ) là mục **Notes** ([dưới đây](#ghi-chú-file-f8)), để file nhiều từ không phải cuộn tới cuối.
4. **Learn** (`#/files/:fileId/learn`): có phiên dừng dở trên máy này thì học tiếp phiên đó, không hỏi ([learn-algorithm.md](learn-algorithm.md#học-tiếp-sau-khi-dừng-58)). Một câu hỏi mỗi lần, nghĩa kèm loại từ viết tắt như ở trang File (#61), thanh tiến độ hai màu ("3 learned · 4 familiar / 12"), nút "Stop" (ở màn câu hỏi và màn lỗi lưu; màn phản hồi chỉ có Continue). Trắc nghiệm: đúng → tô xanh, sang câu sau; sai → màn phản hồi tô đỏ đáp án đã chọn, tô xanh đáp án đúng. Câu viết luôn có màn phản hồi: đúng / gần đúng (hiện chữ đã gõ và chữ đúng) / sai (hiện đáp án đúng, kèm nút **"I was right"**). Màn phản hồi có 🔊 đọc từ đúng và phiên âm của từ đúng nếu có (cả hai không hiện lúc đang hỏi để khỏi lộ đáp án) và nút **Continue** được focus sẵn. Lưu hỏng → "Your answer could not be saved." + **Retry** / **Stop** ([learn-algorithm.md](learn-algorithm.md#recordanswer)).
5. **Tóm tắt vòng**: các từ vừa học kèm số lần đúng/sai trong vòng; chạm vào từ (cả chữ lẫn 🔊 nhỏ, mờ phía sau là một nút) để nghe đọc; nút "Next round".
6. **Kết thúc phiên** (học hết, hoặc bấm Stop): số câu đúng/sai, tối đa 5 từ sai nhiều nhất trong phiên (chỉ từ sai ≥ 1 lần); học xong hết: chúc mừng + "Study again" (đọc lại dữ liệu, mở phiên mới) và "Back to list" (về trang File); bấm Stop: "Continue" (mở lại trang, học tiếp phiên dở), "Start over" (xóa phiên dở, mở phiên mới, không hỏi xác nhận vì hộp Leitner vẫn giữ) và "Back to list" (#64). Không đặt Start over ở màn câu hỏi để khỏi bấm nhầm. Danh sách từ chạm để nghe như màn tóm tắt vòng. Có dòng "Terms count as mastered once you get them right on 2 different days." để "learned" ở đây không bị hiểu là "% mastered" ở trang Folder.

Đường dẫn (`HashRouter`): `#/` Home · `#/folders/:folderId` Folder · `#/files/:fileId` File · `#/files/:fileId/learn` Learn · đường dẫn khác → "Page not found" kèm link về Home.

## Thao tác
- Mỗi hàng folder / file / từ có nút **⋯** (`More actions for "run"`) mở menu nhỏ: Rename (Edit với từ) và Delete (#59). Menu tự viết (không dùng `popover` vì iOS cũ): `Escape` thì đóng và trả focus về nút ⋯; bấm ra ngoài hoặc `Tab` thì chỉ đóng (focus đi theo chỗ vừa bấm, không bị kéo về); mở bằng bàn phím (hoặc mũi tên xuống trên nút ⋯) thì focus mục đầu, mũi tên lên/xuống để chọn, quay vòng. Component `shared/RowMenu.tsx`. Trên điện thoại nút ⋯ nằm góc phải trên của thẻ từ. Một component dùng chung cho cả ba loại hàng. Mục trong menu cao ≥ 44px.
- Xóa folder / file / từ luôn hỏi xác nhận bằng `window.confirm` có sẵn của trình duyệt, ghi rõ sẽ xóa bao nhiêu thứ bên trong (ví dụ `Delete folder "IELTS" and its 3 files (120 terms)?`; folder/file trống thì chỉ `Delete folder "IELTS"?`).
- Đổi tên folder/file và sửa từ: sửa ngay tại dòng (form thay chỗ dòng đó), `Escape` hoặc "Cancel" để hủy.
- Thêm từ: thêm xong thì xóa form và đưa con trỏ về ô Term để nhập liên tục.
- Cảnh báo từ trùng hiện **ngay khi gõ** ô Term (chờ ~300 ms sau lần gõ cuối, bỏ qua kết quả cũ về muộn), cả khi thêm và khi sửa (khi sửa không so với chính nó). Không chặn nút Add.
- Lỗi nhập (`ValidationError`, `DuplicateNameError`) hiện cạnh ô nhập. Sau mỗi lần ghi (kể cả lỗi) trang tải lại, nên thứ đang mở đã bị xóa ở tab khác (`EntityNotFoundError`) → trang "no longer exists" kèm link về Home. Lỗi cloud (`ConnectionError`, `SessionExpiredError`, `InvalidStoredDataError`) có câu báo riêng, hiện như lỗi nhập và form giữ nguyên chữ; nếu lần tải lại sau đó cũng hỏng thì trang giữ dữ liệu cũ kèm dòng "This page could not be refreshed…". Lỗi không lường trước → "Something went wrong. Please try again.".
- Form thêm/sửa từ bật kiểm tra chính tả có sẵn của trình duyệt (gạch đỏ) ở ô **Term** và **Example** (`spellcheck="true" lang="en"`), tắt ở ô **Meaning** vì thường là tiếng Việt (#60). Ô trả lời ở màn Learn vẫn tắt (xem Responsive).
- Ô **Part of speech** là `<select>` đặt sau ô Term, mặc định trống. Danh sách hiện loại từ viết tắt, chữ nghiêng nhỏ sau từ (`run` *v.*), rê chuột thấy tên đầy đủ; ô chọn ghi `verb (v.)`.
- Ô **Pronunciation** đặt sau Part of speech, một dòng, không bắt buộc, `spellcheck="false"` (ký tự IPA toàn bị gạch đỏ), placeholder `/rʌn/`. Bên cạnh là nút **Look up** (khóa khi ô Term trống hoặc đang tra; đang tra thì ghi "Looking up…"). Tra được → điền vào ô (ghi đè chữ cũ, vì bấm nút là chủ ý), người dùng vẫn sửa được trước khi Add. Không tìm thấy → "No pronunciation found."; lỗi mạng/hết giờ → "Couldn't reach the dictionary. Type it in or try again."; cả hai kèm link "Search Cambridge Dictionary ↗" (tab mới, `encodeURIComponent`) để tự chép (#66). Câu báo nằm dưới ô, chữ thường không đỏ, không chặn nút Add/Save. Kết quả chỉ dùng nếu ô Term vẫn đúng chữ đã tra, **ô Pronunciation vẫn đúng chữ lúc bấm** (người dùng tự gõ trong lúc chờ thì không bị ghi đè), và form chưa gửi/chưa hủy; khác thì bỏ (LESSONS: kết quả cũ về muộn). Look up là `type="button"` để không gửi form. Test UI bắt buộc: sửa Meaning của một từ có phiên âm → phiên âm còn nguyên (`TermForm` liệt kê trường bằng tay ở cả lúc gửi lẫn lúc reset; phá thử để chắc test đỏ được). Gõ lại ô Term thì xóa câu báo. Chi tiết tra: [pronunciation-lookup.md](pronunciation-lookup.md).
- Danh sách từ hiện phiên âm sau loại từ, chữ nhỏ màu nhạt, đúng như đã lưu (`run` *v.* /rʌn/ 🔊). Trên điện thoại xuống dòng được, không cắt.
- Nút 🔊 (`Listen to "run"`) đọc từ bằng `speechSynthesis`, `lang = en-GB`. Trình duyệt không hỗ trợ thì ẩn nút. Bấm lần nữa khi đang đọc thì đọc lại từ đầu.

## Ghi chú file (F8)
- `<details>` có sẵn của trình duyệt, tiêu đề **Notes**, đầu trang File (dưới tên file, trên form thêm từ), mặc định **đóng**; mở/đóng không lưu lại (YAGNI). Có ghi chú thì tiêu đề kèm số ký tự mờ (`Notes · 1,234 characters`) để biết bên trong có gì mà không phải mở.
- Xem: chữ thường, `white-space: pre-wrap; overflow-wrap: anywhere` (giữ xuống dòng, URL dài không làm tràn màn hẹp), render dạng text qua React. Trống thì "No notes yet.". Nút **Edit notes** (trống thì **Add notes**).
- Sửa: `<textarea>` cao ~12 dòng, kéo giãn được, `spellcheck="false"` (ghi chú có thể bằng tiếng Việt, và chữ dán vào thì gạch đỏ chỉ thêm rối); dưới ô là bộ đếm `1,234 / 10,000`, vượt giới hạn thì bộ đếm đỏ kèm câu báo, nút Save vẫn bấm được và báo `ValidationError` như các form khác. **Không** dùng thuộc tính `maxLength`: dán đoạn dài sẽ bị cắt im lặng. Nút **Save** / **Cancel**; `Escape` không hủy (dễ bấm nhầm mất cả đoạn dài), chỉ nút Cancel. Lưu xong trở về chế độ xem. Lỗi ghi (`ConnectionError`, mất phiên) → giữ nguyên chữ trong ô như các form khác (#43).
- Bộ đếm dùng `value.length` (cùng đơn vị với Zod); chuẩn hóa (NFC, trim) chỉ làm khi lưu nên số có thể giảm chút sau khi lưu, không sao. Số in bằng `toLocaleString('en')` cố định (`1,234`), không theo ngôn ngữ máy, để mọi thiết bị giống nhau.
- Chữ trong ô sửa là state riêng, **chỉ khởi tạo từ `file.notes` lúc bấm Edit**; trang tải lại sau lần lưu hỏng (đổi object `file`) không được ghi đè chữ đang gõ (#43). Test trên `App` thật + repository, không trên bản giả (LESSONS).
- **Bản nháp** (#65): mỗi lần sửa chữ trong ô thì lưu tạm vào `localStorage` của máy đó (khóa `vocab-notes-draft:<fileId>`, `{ text }`), cùng khuôn `sessionStore.ts` của Learn. Save thành công hoặc Cancel thì xóa nháp; Save hỏng thì giữ. Mở trang File mà còn nháp của file đó → Notes tự mở ở chế độ sửa với chữ nháp, kèm "Unsaved draft restored.". Lý do: trên iPhone chuyển sang Safari chép bài rồi quay lại, trang có thể đã bị tải lại (iOS bỏ trang khỏi bộ nhớ, hoặc `min_client_version` đổi). Không đọc/ghi được `localStorage` (chế độ riêng tư, đầy) → bỏ qua, vẫn sửa được bình thường. Nháp hỏng hình dạng → xóa. File bị xóa thì nháp còn lại vô hại (không bao giờ mở lại); không dọn. Rời trang khi đang sửa không hỏi (nháp đã giữ).

## Responsive
- Viết CSS cho màn hẹp (~375px) trước, mở rộng bằng `min-width`. Nội dung rộng tối đa ~720px, căn giữa.
- Nút bấm cao ≥ 44px. Đáp án trắc nghiệm xếp dọc, rộng hết chiều ngang.
- Ô viết đáp án: `autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"`, để bàn phím điện thoại không tự sửa đáp án.
- Dùng `dvh` thay `vh`, để câu hỏi và ô nhập không bị bàn phím che.

## Phím tắt (máy tính)
Phím `1`–`4` chọn đáp án trắc nghiệm (bỏ qua khi đang gõ trong ô nhập), `Enter` gửi câu viết / bấm Continue (nút được focus sẵn). Đã làm cùng màn Learn (giai đoạn 3).
