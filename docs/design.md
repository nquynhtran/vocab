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
- *(Planned, bước Settings)* chọn tay System / Light / Dark: lưu `localStorage` của máy (`vocab-theme`), đặt `data-theme` trên `<html>` bằng file `public/theme.js` chạy trong `<head>` trước khi trang hiện, để không chớp trắng. File ngoài chứ không inline vì CSP `script-src 'self'`. Không lưu lên cloud: mỗi máy một sở thích.

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
2. *(Planned)* Màn **Settings** (`#/settings`, icon ⚙ trên thanh đầu): Appearance, Backup (Export + Restore chuyển từ Home), Account (email, Sign out).
3. *(Planned)* Home: ô streak + folder dạng thẻ; tạo mới thu vào nút "+ New folder". Folder: file dạng thẻ có thanh % mastered.
4. *(Planned)* File: tên, số từ, nút Learn nổi bật → Notes → "+ Add term" (file trống thì mở sẵn; mở rồi giữ mở để nhập liên tục) → danh sách từ, chạm vào từ để nghe.
5. *(Planned)* Learn: thanh đầu thu gọn khi đang học (không Settings/Sign out).
6. *(Planned)* Đăng nhập, trang lỗi, màn trống có hướng dẫn kèm nút hành động.
