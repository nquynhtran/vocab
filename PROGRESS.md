# Tiến độ

> File này được nạp tự động mỗi phiên. Giữ ngắn: chỉ trạng thái hiện tại, checklist và 5 mục nhật ký gần nhất.

## Đang ở đâu
- **Giai đoạn:** 6. Thiết kế lại (#86–#89) xong cả 6 bước, đã soát lại (`reviewer` + bản build có CSP), **đã deploy** (f39d5df, CI xanh, trang thật có bản mới). Đang chờ người dùng dùng thử trên máy tính và iPhone.
- **Việc tiếp theo:** hỏi người dùng kết quả dùng thử bản mới; có góp ý thì sửa theo. Sau đó: README (chỉ mô tả cái đã có), rồi dùng thử 1 tuần để đóng giai đoạn 6.
- **Đang vướng:** không. Chụp ảnh: script WebDriver tự viết (không có selenium), geckodriver bản snap không `kill` được từ đây; tối bằng pref `layout.css.prefers-color-scheme.content-override` = 0. Không có `gh`: xem CI qua `api.github.com/repos/nquynhtran/vocab/actions/runs?head_sha=<SHA đầy đủ>`. 🔊 không kêu trong Simple Browser của VS Code. `npm run build` cần `VITE_SUPABASE_*` (giả cũng được). iPhone iOS cũ tạo folder lỗi chưa rõ (cloud-sync.md#iphone). Để sau theo thỏa thuận: tách hook khỏi `TermForm`, `saved!` ở `FilePage`, so `updatedAt` phụ thuộc đồng hồ máy, công cụ tự chặn import sai tầng (hiện kiểm tay, đang đúng). Test tốc độ `pronunciation.test.ts` nếu CI đỏ đúng test đó thì nới ngưỡng.

## Kế hoạch
Mỗi giai đoạn xong khi: test xanh, CI xanh, đã deploy, không còn vấn đề nghiêm trọng đã biết, người dùng dùng thử OK. Khi nào gọi agent: xem CLAUDE.md. Thứ tự làm: 0 → 1 → 2 → **7** → 3 → 3b → 4 → 5 → 6.

- [x] **0. Chuẩn bị** — Node 24 (nvm), Vite 8 + React 19 + TS strict, CI/CD lên GitHub Pages, CSP production
- [x] **1. Tầng dữ liệu** — domain + `DexieRepository`, test CRUD + ràng buộc ([data-model.md](docs/data-model.md))
- [x] **2. Quản lý từ vựng** — folder → file → từ, tải lại không mất ([ui.md](docs/ui.md))
  - [x] `HashRouter`, `RepositoryContext` (ở `shared/`), `VocabDb` + `onVersionChange` → reload
  - [x] Home / Folder / File; đổi tên tại chỗ; xóa bằng `window.confirm` kèm số lượng; `getFolderContents`
  - [x] Cảnh báo trùng khi gõ (#27); ghi xong luôn tải lại (bị xóa ở tab khác → "no longer exists")
  - [x] Theo feedback: loại từ (#29, Dexie v2 theo #32), nút 🔊 en-GB (#30)
- [x] **7. Cloud & iPhone** — dùng chung dữ liệu máy tính ↔ iPhone ([cloud-sync.md](docs/cloud-sync.md)): `challenger` #33–37, Export JSON, Supabase (Singapore, tắt đăng ký) + SQL/RLS + pgTAP, `SupabaseRepository` + test hợp đồng, đăng nhập (#43), nhập backup (#46), manifest + icon, deploy; mỗi bước qua `reviewer`
- [x] **3. Learn** — học một file đến khi thuộc hết ([learn-algorithm.md](docs/learn-algorithm.md)). `challenger` #50–#54; domain, `recordAnswer`/`get_learn_data`, màn Learn, mỗi bước qua `reviewer`; deploy. Đợt 1 theo góp ý (#56–#64): đan xen câu viết, thanh hai màu, loại từ + ví dụ trong câu hỏi, chạm để nghe, gạch đỏ chính tả, menu ⋯, học tiếp sau Stop (Continue / Start over ở màn Stop). Người dùng dùng thử: ổn, sẽ báo lỗi dần khi dùng
- [x] **3b. Ghi chú file + phiên âm** (đợt 2, [scope.md](docs/scope.md)): thiết kế → `challenger` → đổi cấu trúc dữ liệu một lần → deploy
  - [x] Thiết kế + `challenger` (11 điểm, nhận hết); người dùng chốt #65–#67 (10 000 ký tự, Notes đầu trang, nháp trên máy, IPA kiểu Cambridge)
  - [x] Domain → data + SQL → UI, qua `reviewer` 3 lượt; chạy app thật trên Firefox + Supabase local, CSP thử trên bản build
  - [x] Sau khi tự soát: tách nâng `min_client_version` (#68), cảnh báo trước khi ghi đè ghi chú (#69), tách phiên âm chạy tuyến tính
  - [x] Deploy: `db push` thêm cột → `git push` + CI xanh
  - [x] Migration nâng `min_client_version` 3 (`db push`, đọc lại trên cloud ra 3)
  - [x] Người dùng dùng thử: điện thoại và máy tính đều ổn, sau khi sửa hai lỗi (#70)
- [x] **4. Streak** — chuỗi ngày, kỷ lục, lịch tháng trên Home ([streak.md](docs/streak.md)). `challenger` + người dùng chọn hiển thị (#71–#74); đọc qua RPC `list_study_days`; sửa đăng xuất nhầm do 401 về muộn (#75); `reviewer` 3 lượt; deploy; người dùng xác nhận trên máy tính và iPhone
- [x] **5. Sao lưu** — khôi phục toàn bộ dữ liệu từ file backup ([backup.md](docs/backup.md)). `challenger` + người dùng chốt #76–#79; `replaceAll` (Dexie + RPC `replace_all`), sửa gốc lỗi không mã ở `runRequest` (#81), mục Restore trên Home (#80), mỗi bước qua `reviewer`; deploy; người dùng xác nhận Export → Restore trên máy tính và iPhone
- [ ] **6. Hoàn thiện** — thứ tự: ví dụ trong Learn → gói code → dark mode + thiết kế → README, Settings (nếu cần) → dùng thử.
  - [x] Ví dụ trong Learn theo góp ý: che cả dạng chia có quy tắc (#82), ví dụ đầy đủ ở màn tóm tắt (#83); `reviewer` (4 điểm, đã sửa), chụp màn thật hai cỡ; deploy (CI xanh)
  - [x] Người dùng thử: ổn. Cụm 2 chữ ("take away") vẫn hay mất ví dụ, người dùng cho bỏ qua nếu khó; nguyên nhân có thể là dạng bất quy tắc ("took away") hoặc cụm bị tách ("take it away"), chưa xem dữ liệu thật
  - [x] Gói code (#84, #85): giữ supabase-js; Dexie `import()` sau màn đầu; tách file `react` + `vendor`. Lúc mở app 215 → 186 kB nén, deploy chỉ đổi code app thì tải lại ~25 kB. Deploy 5cbf9b5, người dùng xác nhận trên iPhone
  - [x] Thiết kế lại bước 1–4 (#86, #87): màu/chữ/icon + dark mode, Settings, Home/Folder dạng thẻ, trang File; người dùng duyệt từng bước
  - [x] Bước 5–6 (Learn thu gọn #88, màn trống/lỗi/đăng nhập #89), người dùng duyệt ảnh; soát lại cả đợt, deploy f39d5df
  - [ ] Người dùng dùng thử bản thiết kế mới (máy tính + iPhone)
  - Còn lại: phím tắt còn lại (nếu cần; 1–4 và Enter đã có, #55); README; dùng thử 1 tuần

## Nhật ký (5 mục gần nhất, mới nhất trên cùng)
- 2026-11-11 — Deploy thiết kế mới (23 commit, f39d5df), CI xanh, kiểm tra trang thật. Ghi #88, #89; đổi tiêu đề design.md thành "Bố cục màn hình (#86)".
- 2026-11-11 — Soát lại cả đợt thiết kế lại theo yêu cầu: `reviewer` (8 điểm, không có lỗi nghiêm trọng, nhận hết) + tự thử bản build có CSP. Sửa: ô streak lỗi nhấp nháy mỗi lần focus (do `useAsync.reload` ở bước 6 → tách `retry`), khóa Cancel/Escape khi đang lưu, không cướp focus, test chạy thật `theme.js`, tách `RevealHeader`, 3 chỗ tài liệu lệch. Mỗi sửa có test đã phá thử. Chưa có công cụ tự chặn import sai tầng (kiểm bằng tay, đang đúng).
- 2026-11-11 — Bước 6 (#86): `EmptyState` (Home/Folder trống có nút "Create your first …", Learn file trống, NotFound), `LoadError` có Try again (`useAsync.reload` hiện Loading khi thử lại sau lỗi), câu mất mạng riêng cho lỗi đọc, thẻ đăng nhập có icon app. Phá thử test Try again; thử bản build (đường dẫn icon). `reviewer` bỏ qua (giao diện; thay đổi `useAsync` một dòng, có test).
- 2026-11-11 — Bước 5 (#86): Learn ra ngoài `Layout`, thanh đầu riêng (‹ về File, tên file một dòng, Stop không viền), cao 44 px như trang khác. Sửa test "Back to list" vốn sẽ xanh giả vì tên file giờ ở cả thanh đầu Learn; phá thử test mới. `reviewer` bỏ qua (chỉ giao diện + route). 16 commit chưa push.
- 2026-11-11 — Thiết kế lại bước 3–4 (#86): Home/Folder dạng thẻ, trang File mới, `ListenWord` dùng chung với Learn; sửa lệch cột tiêu đề bảng từ. `reviewer` bỏ qua (chỉ giao diện); phá thử test mới. Bài học: chạy `npm run check` đủ trước mỗi commit. Chưa push.
