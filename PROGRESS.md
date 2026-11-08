# Tiến độ

> File này được nạp tự động mỗi phiên. Giữ ngắn: chỉ trạng thái hiện tại, checklist và 5 mục nhật ký gần nhất.

## Đang ở đâu
- **Giai đoạn:** 5, code xong và đã commit, chờ deploy.
- **Việc tiếp theo:** deploy giai đoạn 5 theo [backup.md](docs/backup.md#deploy). Code ở commit `ebaa744`: `test:supabase` xanh, `db push --dry-run` chỉ có `20261108120000_replace_all.sql`. Còn lại: **hỏi người dùng** → `npx supabase db push` → `git push` (SSH) → chờ CI (SHA đầy đủ) → người dùng Export rồi Restore chính file đó trên cloud (máy tính + iPhone).
- **Đang vướng:** không. Build có cảnh báo chunk > 500 kB (supabase-js), để giai đoạn 6. geckodriver bản snap không `kill` được từ đây (chặn quyền), dùng cổng khác nếu còn chạy. 🔊 không kêu trong Simple Browser của VS Code. `npm run build` ở máy cần `VITE_SUPABASE_*` (xem cloud-sync.md). iPhone iOS cũ của người dùng tạo folder bị lỗi chưa rõ nguyên nhân (cloud-sync.md#iphone); người dùng sẽ cập nhật máy. Đã thỏa thuận để sau: tách hook khỏi `TermForm`, `saved!` ở `FilePage`, so `updatedAt` phụ thuộc đồng hồ máy. Test tốc độ ở `pronunciation.test.ts` từng đỏ một lần khi máy rất tải (`reviewer`, 1 lõi); nếu CI đỏ đúng test đó thì nới ngưỡng.

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
- [ ] **5. Sao lưu** — khôi phục toàn bộ dữ liệu từ file backup ([backup.md](docs/backup.md))
  - [x] `challenger` (10 điểm, đã kiểm trong code); người dùng chốt #76–#79: ghi đè ngày học, nút tải bản sao, gộp Import thành một mục Restore, chưa nhắc sao lưu
  - [x] Đo payload: 6 MB nhập 1,4 s trên local (giới hạn 8 s); chưa đo cloud
  - [x] Tầng dữ liệu: `replaceAll` (Dexie + RPC `replace_all` dùng lại `import_snapshot`), hợp đồng + pgTAP, phá thử, `reviewer` (3 điểm, đã sửa: lỗi 502 không mã → `ConnectionError`)
  - [x] Sửa gốc lỗi không mã ở `runRequest` (#81), qua `reviewer`
  - [x] Giao diện Restore (`BackupSection`, `compareForRestore`, lỗi trong mục #80), UI test trên `App` thật, `reviewer` (5 điểm nhỏ, đã sửa), thử Firefox rộng + iframe 375 px trên Supabase local
  - [ ] Deploy (`db push` trước) → người dùng thử
- [ ] **6. Hoàn thiện** — phím tắt còn lại (nếu cần; 1–4 và Enter đã có, #55), dark mode + làm lại thiết kế cho đẹp hơn (người dùng muốn, 2026-11-04; có thể gửi ảnh app mẫu; giao diện mới từ giờ chỉ dùng biến màu `--color-*`, bóng đổ menu ⋯ đang viết thẳng màu); dark mode mặc định theo máy (`prefers-color-scheme`); màn Settings chỉ làm khi có ≥ 2–3 thứ người dùng thật sự muốn chỉnh (ứng viên: giao diện tự động/sáng/tối, số từ mỗi vòng, tài khoản + Sign out, gom xuất/khôi phục backup về đây), người dùng ghi lại nhu cầu khi dùng; README; tối ưu gói code (724 kB, nén 213 kB, chủ yếu supabase-js: xem có code bản local như Dexie bị gói vào không, tách phần chưa cần lúc mở app; người dùng nhờ ghi lại 2026-11-04); dùng thử 1 tuần

## Nhật ký (5 mục gần nhất, mới nhất trên cùng)
- 2026-11-08 — Sửa gốc lỗi không mã cho mọi request (#81) + giao diện Restore (#80), `reviewer` hai lượt, thử app thật; `statement_timeout` cloud 8 s như local. Chờ người dùng đồng ý `db push`.
- 2026-11-08 — Viết tầng dữ liệu khôi phục backup (`replaceAll`, migration `replace_all` chưa `db push`); `reviewer` 3 điểm đã sửa; check + 156 pgTAP + 94 hợp đồng cloud xanh. 6 commit chưa push (4 ghi chú + refactor + feat), đi cùng lần deploy giai đoạn 5.
- 2026-11-08 — Thiết kế giai đoạn 5 qua `challenger`; người dùng chọn cả 4 phương án gợi ý (#76–#79). Tài liệu mới `docs/backup.md`. Chưa có code.
- 2026-11-06 — Người dùng xác nhận Streak ổn trên máy tính và iPhone → đóng giai đoạn 4.
- 2026-11-06 — Người dùng yêu cầu soát lại: rủi ro 401 về muộn đăng xuất luôn phiên mới; chặn ở ô streak là vá triệu chứng nên gỡ, sửa tại `expireSession` (#75, hỏi lại máy chủ, chỉ lỗi Auth 401/403 mới đăng xuất). Tách lại commit chưa push.
