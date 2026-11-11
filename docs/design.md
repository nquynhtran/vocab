# Hệ thống thiết kế

Giai đoạn 6 (#86, #87). Mọi giao diện chỉ dùng các biến ở `:root` của `src/index.css`; không viết thẳng màu, cỡ chữ hay khoảng cách lẻ. Chuẩn đối chiếu: WCAG 2.2 AA, 10 nguyên tắc của Nielsen, Apple HIG (vùng chạm, safe area).

## Màu (`--color-*`)
Hướng: trung tính, một màu nhấn chàm dịu. Chế độ tối dùng xám than, không đen tuyền (đỡ chói, bóng đổ còn thấy). Mọi cặp dưới đây đã đo theo công thức WCAG; đổi màu thì đo lại (chữ ≥ 4.5:1, viền ô nhập và phần đồ họa ≥ 3:1).

| Biến | Sáng | Tối | Dùng cho |
|------|------|-----|----------|
| `bg` | `#f6f7f9` | `#121419` | nền trang |
| `surface` | `#ffffff` | `#1c1f26` | thẻ, ô nhập, menu |
| `subtle` | `#eef0f3` | `#262a33` | hover, nền phụ, rãnh thanh tiến độ |
| `text` | `#1d2230` | `#e6e8ee` | chữ chính |
| `muted` | `#5a6070` | `#9da3b0` | chữ phụ (≥ 5.5:1 trên mọi nền) |
| `border` | `#e1e4ea` | `#2e333d` | đường kẻ trang trí |
| `control` | `#848a99` | `#6e7584` | viền ô nhập (≥ 3:1, WCAG 1.4.11) |
| `primary` | `#4f46e5` | `#8e95ff` | nút chính, link, focus |
| `on-primary` | `#ffffff` | `#12142a` | chữ trên nút chính |
| `primary-soft` | `#c3c8fa` | `#3a3f85` | phần "familiar" của thanh tiến độ (≥ 3:1 với `primary`) |
| `primary-bg` | `#eef0ff` | `#24274a` | nền được chọn / nhấn nhẹ |
| `success` / `success-bg` | `#16794a` / `#e6f4ec` | `#5cc98b` / `#16301f` | đúng, ngày đã học |
| `danger` / `danger-bg` | `#c42b3c` / `#fcebed` | `#f27a85` / `#3a1b20` | sai, xóa, lỗi |
| `warning-text` / `warning-bg` | `#6b4a00` / `#fdf3d7` | `#f1d27e` / `#352c12` | cảnh báo |

Chữ trên nền `success`/`danger` đặc dùng `surface` (đạt ở cả hai chế độ). Đúng/sai không chỉ báo bằng màu: luôn có chữ hoặc dấu ✓ ✗ (WCAG 1.4.1).

## Chế độ sáng/tối
- Mặc định theo máy (`prefers-color-scheme`). Bộ màu tối viết hai lần, đặt sát nhau: trong `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }` và trong `:root[data-theme='dark']`. Không dùng `light-dark()`: cần iOS 17.5, iPhone của người dùng có thể cũ hơn (cùng lý do với #59).
- `color-scheme` khai báo đúng chế độ, để phần trình duyệt tự vẽ (ô chọn file, `<select>`, thanh cuộn) cũng tối theo.
- Màu thanh trạng thái iPhone: hai thẻ `<meta name="theme-color">` có `media` sáng/tối, không cần JS.
- Chọn tay System / Light / Dark ở Settings: lưu `localStorage` của máy (`vocab-theme`), đặt `data-theme` trên `<html>` bằng file `public/theme.js` chạy trong `<head>` trước khi trang hiện, để không chớp trắng. File ngoài chứ không inline vì CSP `script-src 'self'`. Không lưu lên cloud: mỗi máy một sở thích.

## Chữ, khoảng cách, hình khối
- Cỡ chữ 5 mức: `--text-xs` 0.8125rem · `--text-sm` 0.875rem · `--text-md` 1rem · `--text-lg` 1.25rem · `--text-xl` 1.5rem. Ô nhập luôn ≥ 1rem (iOS không phóng to khi focus).
- Khoảng cách theo bước 4 px: `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-6` 24 · `--space-8` 32.
- Bo góc `--radius-sm` 6 px (ô nhỏ, ngày trong lịch) · `--radius` 10 px (nút, ô nhập, thẻ). Bóng `--shadow-card` (thẻ) và `--shadow-pop` (menu nổi); chế độ tối bóng đậm hơn.
- Vùng chạm ≥ 44 px (`--tap-size`). Nội dung rộng tối đa 720 px.

## Icon
Component `shared/Icon.tsx`: SVG viết tay, nét 2 px, `currentColor`, `aria-hidden` (nghĩa nằm ở `aria-label` của nút). Không dùng emoji (mỗi hệ điều hành vẽ một kiểu) và không thêm thư viện icon (chỉ cần vài cái). Dấu ✓ ✗ trong câu chữ vẫn là ký tự.

## Tương tác
- Viền focus thống nhất cho mọi phần tử bấm được: `:focus-visible` → `outline: 2px solid var(--color-primary)`, cách 2 px (chỉ khi dùng bàn phím).
- Hover chỉ đổi nền/viền nhẹ, có `transition` ngắn; `prefers-reduced-motion: reduce` tắt mọi chuyển động.
- `scrollbar-gutter: stable`: nội dung không xê dịch khi chuyển giữa trang ngắn và trang dài.
- iPhone mở từ màn hình chính: chừa `env(safe-area-inset-*)` ở hai bên và đáy.

## Bố cục màn hình (kế hoạch #86, làm dần)
1. Hệ thống thiết kế (file này).
2. Màn **Settings** (`#/settings`, icon ⚙ trên thanh đầu): Appearance, Backup (Export + Restore chuyển từ Home), Account (Sign out). Xem [ui.md](ui.md).
3. Home và Folder dạng thẻ (component dùng chung `shared/NamedItemRow.tsx`, `shared/ListHeader.tsx`):
   - Thứ tự Home: ô streak → hàng tiêu đề (`Your folders` + nút "+ New folder") → lưới thẻ. Folder: breadcrumb → hàng tiêu đề (tên folder + "+ New file") → lưới thẻ.
   - Lưới: 1 cột trên điện thoại, 2 cột từ 560 px. Cả thẻ là link (vùng bấm lớn), nút ⋯ không viền nằm bên phải, đổi tên vẫn sửa ngay trong thẻ. Hover: viền đậm hơn (`primary-soft`), không đổi bóng.
   - Thẻ folder: ô icon folder nền `primary-bg` + tên. Không hiện số file (`listFolders` không trả, thêm thì phải sửa cả hai repository; YAGNI).
   - Thẻ file: icon file, tên, `12 terms · 40% mastered`, thanh tiến độ mảnh (rãnh `border` như thanh của Learn, vì `subtle` gần như không thấy ở chế độ tối; phần đã thuộc `primary`), `aria-hidden` vì dòng chữ đã nói đủ.
   - Nút "+ New …" kiểu nút thường (màu nhấn để dành cho Learn). Bấm → nút ẩn, form hiện trong thẻ ngay dưới hàng tiêu đề, focus sẵn ô nhập; Create xong hoặc Cancel/`Escape` → form đóng, focus trả về nút, trừ khi người dùng đã chuyển focus đi chỗ khác trong lúc chờ (chỉ trả khi focus đã rơi về `body`). Trong lúc đang lưu, Cancel bị khóa và `Escape` không có tác dụng (cả form thêm từ, sửa tại dòng): form phải còn để hiện lỗi, kể cả câu "may or may not have been saved". Lỗi (tên trùng…) thì form giữ nguyên chữ.
4. File:
   - Breadcrumb chữ nhạt, không gạch chân (gạch chân khi rê chuột hoặc focus bằng phím).
   - Đầu trang: tên file + số từ; nút **Learn** (nút màu nhấn duy nhất trên trang) bên phải, trên điện thoại rộng hết hàng. File trống: thay bằng "Add some terms to start learning.".
   - Notes → hàng "Terms" + nút "+ Add term" (cùng kiểu `ListHeader`, hook `shared/useRevealedForm.ts`). Thêm xong form vẫn mở, focus về ô Term. Cancel/`Escape` đóng, focus về nút. File trống: form mở sẵn nhưng **không** tự focus (trên điện thoại sẽ bật bàn phím ngay khi vào trang).
   - Danh sách từ gom trong một thẻ, hàng ngăn bằng đường kẻ; nút ⋯ không viền; hàng tiêu đề cột có ô trống thay cột ⋯ để thẳng hàng. Hàng đang sửa tô nền `subtle`, form bên trong không viền (tránh thẻ trong thẻ).
   - Chạm vào chính từ để nghe (`shared/ListenWord.tsx`, dùng chung với màn tóm tắt của Learn): cả chữ lẫn icon loa nhỏ mờ phía sau là một nút. Bỏ nút 🔊 riêng; nút vẫn cao 44 px nhưng không làm dòng đầu cao thêm.
5. Learn (chế độ tập trung, như Quizlet/Duolingo): route nằm ngoài `Layout`, `features/learn/LearnFrame.tsx` dựng cả thanh đầu riêng lẫn `<main>`; thanh đầu cùng nền/viền/safe area với thanh thường: nút icon ‹ (`Back to file`, về trang File, vùng chạm 44 px) · tên file (`h1`, cỡ `lg`, cắt `…` một dòng để thanh không cao lên) · nút chữ Stop không viền như nút "Cancel" trên thanh iOS (chỉ ở màn câu hỏi, như trước; thanh cao 44 px như các trang khác). Không có tên app, ⚙. Lúc đang tải/lỗi chỉ có nút ‹. Thanh tiến độ ở ngay dưới, trong trang.
6. Đăng nhập, lỗi, màn trống (mẫu "blankslate"/"empty state" quen thuộc của GitHub, Material):
   - Component `shared/EmptyState.tsx`: khối căn giữa, viền nét đứt `border`, icon trong ô tròn nền `primary-bg`, tiêu đề cỡ `lg`, một câu giải thích chữ `muted`, nút hành động. Dùng cho:
     - Home chưa có folder: "No folders yet" · "Folders group your files, for example by course or topic." · nút chính **Create your first folder** (mở cùng form với nút "+ New folder" ở hàng tiêu đề) + link "Restore a backup" (sang Settings). Folder chưa có file: "No files yet" · "A file is one list of terms to learn, like a unit of a course." · **Create your first file**. Khối ẩn khi form tạo đang mở (form thay chỗ nó). Nút trong khối là nút chính vì đó là việc duy nhất nên làm, tên khác nút ở hàng tiêu đề để trình đọc màn hình không gặp hai nút cùng tên. Nút ở hàng tiêu đề không ẩn khi trống: đóng form thì focus về nó, và `write` không chờ tải lại xong, nên một nút chỉ có lúc trống có thể biến mất ngay sau khi nhận focus.
     - Learn với file trống: "No terms to learn" · "Add some terms to this file first." · link-nút **Add terms** (về trang File, nơi form mở sẵn).
     - Không tìm thấy (`NotFound`): tiêu đề là câu báo, nút **Back to your folders**.
     - Lỗi tải trang (`LoadError`): "Couldn't load this page" + câu lỗi (chữ thường, khối có `role="alert"`; mất mạng thì "Cannot reach the server. Check your connection, then try again.", vì câu chung nói về thao tác ghi) + nút **Try again** (gọi `retry` của `useAsync`: hiện "Loading…" trong lúc thử lại. `reload` thì không, vì ô streak gọi nó mỗi lần cửa sổ được focus, hiện Loading sẽ làm ô lỗi nhấp nháy).
   - File trống giữ như bước 4 (form thêm từ mở sẵn, câu "Add some terms to start learning." ở chỗ nút Learn): form đã là hành động, thêm khối nữa là thừa.
   - Đăng nhập (cả hộp phủ khi mất phiên): thẻ `surface` rộng tối đa 24rem, căn giữa ngang, cách đỉnh `space-8`; trên cùng icon app (`favicon.svg`) + "Vocab", rồi tiêu đề "Sign in", nút Sign in rộng hết thẻ. Màn "không tới được máy chủ" lúc mở app dùng cùng thẻ, kèm nút Retry.
