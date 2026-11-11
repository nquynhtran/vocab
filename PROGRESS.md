# Tiến độ

> File này được nạp tự động mỗi phiên. Giữ ngắn: chỉ trạng thái hiện tại, checklist và 5 mục nhật ký gần nhất.

## Đang ở đâu
- **Giai đoạn:** 6 đang làm: xong ví dụ trong Learn và gói code.
- **Việc tiếp theo:** dark mode + thiết kế lại giao diện. Hỏi người dùng có ảnh app mẫu không, rồi đề xuất bảng màu `--color-*` (sáng/tối theo `prefers-color-scheme`) trong `src/index.css` trước khi sửa từng màn. Người dùng để Claude tự quyết thứ tự và chuyện kỹ thuật (xem memory).
- **Đang vướng:** không. geckodriver bản snap không `kill` được từ đây (chặn quyền), dùng cổng khác nếu còn chạy. 🔊 không kêu trong Simple Browser của VS Code. `npm run build` ở máy cần `VITE_SUPABASE_*` (xem cloud-sync.md). iPhone iOS cũ của người dùng tạo folder bị lỗi chưa rõ nguyên nhân (cloud-sync.md#iphone); người dùng sẽ cập nhật máy. Đã thỏa thuận để sau: tách hook khỏi `TermForm`, `saved!` ở `FilePage`, so `updatedAt` phụ thuộc đồng hồ máy. Test tốc độ ở `pronunciation.test.ts` từng đỏ một lần khi máy rất tải (`reviewer`, 1 lõi); nếu CI đỏ đúng test đó thì nới ngưỡng.

## Kế hoạch
Mỗi giai đoạn xong khi: test xanh, CI xanh, đã deploy, không còn vấn đề nghiêm trọng đã biết, người dùng dùng thử OK. Khi nào gọi agent: xem CLAUDE.md. Thứ tự làm: 0 → 1 → 2 → **7** → 3 → 3b → 4 → 5 → 6.

- [x] **0. Chuẩn bị** — Node 24 (nvm), Vite 8 + React 19 + TS strict, CI/CD lên GitHub Pages, CSP production
- [x] **1. Tầng dữ liệu** — domain + `DexieRepository`, test CRUD + ràng buộc ([data-model.md](docs/data-model.md))
- [x] **2. Quản lý từ vựng** — folder → file → từ, tải lại không mất ([ui.md](docs/ui.md))
  - [x] `HashRouter`, `RepositoryContext` (ở `shared/`), `VocabDb` + `onVersionChange` → reload
  - [x] Home / Folder / File; đổi tên tại chỗ; xóa bằng `window.confirm` kèm số lượng; `getFolderContents`
  - [x] Cảnh báo trùng khi gõ (#27); ghi xong luôn tải lại (bị xóa ở tab khác → "no longer exists")
  - [x] Theo feedback: loại từ (#29, Dexie v2 theo #32), nút 🔊 en-GB (#30)
- [x] **7. Cloud & iPhone** — dùng chung dữ liệu máy tính ↔ iPhone ([cloud-sync.md](docs/cloud-sync.md))
  - [x] Qua `challenger`, chốt #33–37 (chuyển dữ liệu, client cũ, validate khi đọc, không service worker, test bằng Supabase CLI)
  - [x] Export JSON trên bản local (`exportBackup`, `validateBackup`), qua `reviewer`
  - [x] Tài khoản + project Supabase (Singapore, đã tắt đăng ký); Docker đã cài
  - [x] Supabase CLI (devDependency); SQL + RLS + `app_config` + `import_snapshot`/`export_backup`, 66 test pgTAP, qua `reviewer`
  - [x] Mapper + `SupabaseRepository` + test hợp đồng chung (cả `max_rows` 1000, mọi `PARTS_OF_SPEECH`), RPC đọc #39, qua `reviewer`
  - [x] Đăng nhập (`AuthGate`, mất phiên giữ form #43), `min_client_version`, Dexie v3; qua `reviewer` (7 điểm, đã sửa hết)
  - [x] Nhập backup vào tài khoản trống (#46, qua `challenger` + `reviewer`); CSP, biến build; `db push`; deploy (#45). Không chuyển dữ liệu (#47)
  - [x] Manifest + icon (`scripts/make-icons.mjs`), thử trên iPhone (máy khác OK); giữ project bằng việc dùng app (#48); CI xếp hàng trên `main` (#49)
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
  - Còn lại: phím tắt còn lại (nếu cần; 1–4 và Enter đã có, #55), dark mode + làm lại thiết kế cho đẹp hơn (người dùng muốn, 2026-11-04; danh sách từ trong file chạm vào từ để nghe như màn tóm tắt vòng, để Claude thiết kế, 2026-11-10; có thể gửi ảnh app mẫu; giao diện mới từ giờ chỉ dùng biến màu `--color-*`, bóng đổ menu ⋯ đang viết thẳng màu); dark mode mặc định theo máy (`prefers-color-scheme`); màn Settings chỉ làm khi có ≥ 2–3 thứ người dùng thật sự muốn chỉnh (ứng viên: giao diện tự động/sáng/tối, số từ mỗi vòng, tài khoản + Sign out, gom xuất/khôi phục backup về đây), người dùng ghi lại nhu cầu khi dùng; README; dùng thử 1 tuần

## Nhật ký (5 mục gần nhất, mới nhất trên cùng)
- 2026-11-11 — Gói code: thử tự ghép auth-js + postgrest-js (#84), cân lại thì quay về supabase-js (#85); giữ Dexie tải sau + file `react`/`vendor`. `reviewer`, test:supabase, thử bản build; deploy, người dùng xác nhận trên iPhone.
- 2026-11-10 — Giai đoạn 6 bắt đầu bằng góp ý về ví dụ trong Learn (#82, #83), `reviewer`, chụp màn thật; đã deploy, người dùng xác nhận ổn.
- 2026-11-10 — Người dùng xác nhận Export → Restore ổn trên máy tính và iPhone → đóng giai đoạn 5.
- 2026-11-08 — Sửa gốc lỗi không mã cho mọi request (#81) + giao diện Restore (#80), `reviewer` hai lượt, thử app thật; `statement_timeout` cloud 8 s như local. Người dùng đồng ý → đã deploy.
- 2026-11-08 — Viết tầng dữ liệu khôi phục backup (`replaceAll`, migration `replace_all` chưa `db push`); `reviewer` 3 điểm đã sửa; check + 156 pgTAP + 94 hợp đồng cloud xanh. 6 commit chưa push (4 ghi chú + refactor + feat), đi cùng lần deploy giai đoạn 5.
