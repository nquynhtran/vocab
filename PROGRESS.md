# Tiến độ

> File này được nạp tự động mỗi phiên. Giữ ngắn: chỉ trạng thái hiện tại, checklist và 5 mục nhật ký gần nhất.

## Đang ở đâu
- **Giai đoạn:** 3 xong (2026-11-04). Bắt đầu 3b.
- **Việc tiếp theo:** 3b: viết thiết kế ghi chú file + phiên âm (data-model.md, ui.md, scope.md đã có ý tưởng), gồm đổi cấu trúc ở Dexie (version mới), backup `schemaVersion` 3, migration Supabase; rồi gọi `challenger` trước khi code.
- **Đang vướng:** không. Build có cảnh báo chunk > 500 kB (supabase-js), để giai đoạn 6. 🔊 không kêu trong Simple Browser của VS Code. `npm run build` ở máy cần `VITE_SUPABASE_*` (xem cloud-sync.md). iPhone iOS cũ của người dùng tạo folder bị lỗi chưa rõ nguyên nhân (cloud-sync.md#iphone); người dùng sẽ cập nhật máy.

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
- [ ] **3b. Ghi chú file + phiên âm** (đợt 2, [scope.md](docs/scope.md)): thiết kế → `challenger` → đổi cấu trúc dữ liệu một lần → deploy
- [ ] **4. Streak** — đủ các test trong [streak.md](docs/streak.md)
- [ ] **5. Sao lưu** — khôi phục toàn bộ dữ liệu từ file backup
- [ ] **6. Hoàn thiện** — phím tắt còn lại (nếu cần; 1–4 và Enter đã có, #55), dark mode + làm lại thiết kế cho đẹp hơn (người dùng muốn, 2026-11-04; có thể gửi ảnh app mẫu; giao diện mới từ giờ chỉ dùng biến màu `--color-*`, bóng đổ menu ⋯ đang viết thẳng màu); dark mode mặc định theo máy (`prefers-color-scheme`); màn Settings chỉ làm khi có ≥ 2–3 thứ người dùng thật sự muốn chỉnh (ứng viên: giao diện tự động/sáng/tối, số từ mỗi vòng, tài khoản + Sign out, gom xuất/khôi phục backup về đây), người dùng ghi lại nhu cầu khi dùng; README; tối ưu gói code (709 kB, nén 208 kB, chủ yếu supabase-js: xem có code bản local như Dexie bị gói vào không, tách phần chưa cần lúc mở app; người dùng nhờ ghi lại 2026-11-04); dùng thử 1 tuần

## Nhật ký (5 mục gần nhất, mới nhất trên cùng)
- 2026-11-04 — **Xong giai đoạn 3** (người dùng xác nhận dùng ổn). Dọn PROGRESS.
- 2026-11-04 — Màn sau Stop: Continue / Start over / Back to list; học xong hết mới chúc mừng + Study again (#64); "ôn riêng từ hay sai" ghi vào scope "có thể làm sau"; 375 test, đã deploy.
- 2026-11-03 — Theo góp ý: bỏ câu hỏi Continue / Start over, mở Learn là học tiếp phiên dở luôn (#63); bỏ `lastStudied`, giữ `savedAt` trong bản lưu (khỏi lên version 2); 374 test, đã deploy.
- 2026-11-03 — Tự soát đợt 1: `reviewer` soát bù #56 (không lỗi) và #59 (Tab không đóng menu mở bằng chuột; Safari không focus nút nên Escape không tới → đóng theo `onBlur` có `relatedTarget`, bấm thì focus ⋯; đã sửa, thử thêm trên Firefox thật); chạy app thật qua geckodriver + Supabase local; người dùng thử trên điện thoại OK; 377 test, đã deploy.
- 2026-11-03 — Đợt 1 phần B: menu ⋯ tự viết (`shared/RowMenu.tsx`, bấm ra ngoài chỉ đóng, không kéo focus); học tiếp sau Stop (`domain/learn/resume.ts` + `sessionStore.ts`, một effect ghi/xóa, ghi hỏng thì xóa bản cũ, bản vô dụng cũng xóa); người dùng chọn luôn hỏi kèm "last studied N days ago" (#62); `challenger` 7 điểm (chính: "Study again" sau Stop xóa mất phiên), `reviewer` 5 điểm (chính: test xóa-khi-xong bị lớp khác che, ghi LESSONS); 375 test. Deploy cả đợt 1.
