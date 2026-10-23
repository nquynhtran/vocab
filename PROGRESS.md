# Tiến độ

> File này được nạp tự động mỗi phiên. Giữ ngắn: chỉ trạng thái hiện tại, checklist và 5 mục nhật ký gần nhất.

## Đang ở đâu
- **Giai đoạn:** 7 (cloud), bước 5 xong và đã commit ở máy, **chưa push** (#45: push là deploy, phải push cùng bước 6). Bản trên Pages vẫn là bản local.
- **Việc tiếp theo:** người dùng thử `npm run dev` (cần `npx supabase start`; đăng nhập `contract@test.local` / `contract-test-password`). Sau đó làm bước 6 của `docs/cloud-sync.md`: màn chuyển dữ liệu (Dexie → `import_snapshot`, `meta.migratedAt`), CSP `connect-src`, biến build `VITE_SUPABASE_*` trên GitHub Actions (build phải báo lỗi nếu thiếu), `supabase link` + `db push` (kiểm `max_rows` = 1000), rồi mới push.
- **Đang vướng:** không. Build có cảnh báo chunk > 500 kB (supabase-js), chưa xử lý.
- **Câu hỏi mở (để giai đoạn 3):** có hiện loại từ làm gợi ý trong câu hỏi Learn không.

## Kế hoạch
Mỗi giai đoạn xong khi: test xanh, CI xanh, đã deploy, không còn vấn đề nghiêm trọng đã biết, người dùng dùng thử OK. Khi nào gọi agent: xem CLAUDE.md. Thứ tự làm: 0 → 1 → 2 → **7** → 3 → 4 → 5 → 6.

- [x] **0. Chuẩn bị** — Node 24 (nvm), Vite 8 + React 19 + TS strict, CI/CD lên GitHub Pages, CSP production
- [x] **1. Tầng dữ liệu** — domain + `DexieRepository`, test CRUD + ràng buộc ([data-model.md](docs/data-model.md))
- [x] **2. Quản lý từ vựng** — folder → file → từ, tải lại không mất ([ui.md](docs/ui.md))
  - [x] `HashRouter`, `RepositoryContext` (ở `shared/`), `VocabDb` + `onVersionChange` → reload
  - [x] Home / Folder / File; đổi tên tại chỗ; xóa bằng `window.confirm` kèm số lượng; `getFolderContents`
  - [x] Cảnh báo trùng khi gõ (#27); ghi xong luôn tải lại (bị xóa ở tab khác → "no longer exists")
  - [x] Theo feedback: loại từ (#29, Dexie v2 theo #32), nút 🔊 en-GB (#30)
- [ ] **7. Cloud & iPhone** — dùng chung dữ liệu máy tính ↔ iPhone ([cloud-sync.md](docs/cloud-sync.md))
  - [x] Qua `challenger`, chốt #33–37 (chuyển dữ liệu, client cũ, validate khi đọc, không service worker, test bằng Supabase CLI)
  - [x] Export JSON trên bản local (`exportBackup`, `validateBackup`), qua `reviewer`
  - [x] Tài khoản + project Supabase (Singapore, đã tắt đăng ký); Docker đã cài
  - [x] Supabase CLI (devDependency); SQL + RLS + `app_config` + `import_snapshot`/`export_backup`, 66 test pgTAP, qua `reviewer`
  - [x] Mapper + `SupabaseRepository` + test hợp đồng chung (cả `max_rows` 1000, mọi `PARTS_OF_SPEECH`), RPC đọc #39, qua `reviewer`
  - [x] Đăng nhập (`AuthGate`, mất phiên giữ form #43), `min_client_version`, Dexie v3; qua `reviewer` (7 điểm, đã sửa hết)
  - [ ] Màn chuyển dữ liệu; CSP, biến build, `db push`; push + deploy (#45)
  - [ ] Manifest, thử trên iPhone; giữ project hoạt động
- [ ] **3. Learn** — học một file đến khi thuộc hết ([learn-algorithm.md](docs/learn-algorithm.md))
- [ ] **4. Streak** — đủ các test trong [streak.md](docs/streak.md)
- [ ] **5. Sao lưu** — khôi phục toàn bộ dữ liệu từ file backup
- [ ] **6. Hoàn thiện** — phím tắt, dark mode, README; dùng thử 1 tuần

## Nhật ký (5 mục gần nhất, mới nhất trên cùng)
- 2026-10-23 — Tự rà soát bước 4: `summarizeFiles` dùng chung (DRY), mapper giữ cột khóa (`nameColumns`), `ConnectionError` không còn hứa "chưa lưu" (thử lại phải dùng lại id, bước 5), #42 last-write-wins, ghi việc kiểm `max_rows` khi link; 151 test; CI xanh.
- 2026-10-23 — Giai đoạn 7 bước 5: `SupabaseAuth` + `AuthGate` (kiểm version mỗi lần đăng nhập, mất phiên thì phủ hộp đăng nhập, giữ app), `useAsync` giữ dữ liệu khi tải lại hỏng, `CLIENT_VERSION` + chặn reload lặp, Dexie v3, `errorMessage` nhận lỗi cloud; #43–45; `reviewer` 7 điểm đã sửa; 191 test + 79 pgTAP + 52 test cloud. Commit ở máy, chưa push.
- 2026-10-22 — Giai đoạn 7 bước 4: `SupabaseRepository` + mapper (validate cả key), bộ hợp đồng dùng chung (Dexie trong CI, Supabase qua `npm run test:supabase`), RPC `list_terms`/`get_folder_contents` vì `max_rows` cắt cả embed; #39–41; sửa `config.toml` chặn đăng nhập email, seed tự kiểm tra môi trường; `reviewer` 8 điểm, đã sửa hết; 149 test + 79 pgTAP + 50 test cloud; CI xanh.
- 2026-10-22 — Giai đoạn 7 bước 3: Supabase CLI + config local, migration đầu (khóa ngoại kèm `user_id`, RLS, quyền tường minh, `import_snapshot` kiểm tra đúng bộ key, `export_backup` một snapshot), 66 test pgTAP qua `reviewer`; #38; CI xanh. Chưa `supabase link`.
- 2026-10-22 — Giai đoạn 7: `challenger` soát kế hoạch, chốt #33–37; Export JSON + `validateBackup` qua `reviewer` (114 test, đã deploy); tạo project Supabase, tắt đăng ký; cài Docker.
- 2026-10-22 — Rà soát lại giai đoạn 2: gom code lặp, đọc màn Folder trong một transaction, Dexie v2 (#32) chặn tab cũ xóa loại từ, sửa giọng đọc; 86 test.
