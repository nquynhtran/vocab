# Tiến độ

> File này được nạp tự động mỗi phiên. Giữ ngắn: chỉ trạng thái hiện tại, checklist và 5 mục nhật ký gần nhất.

## Đang ở đâu
- **Giai đoạn:** 3b, đã deploy đủ (cột mới + `min_client_version` 3 trên cloud, code mới trên Pages); chỉ còn chờ người dùng xác nhận trên bản thật.
- **Việc tiếp theo:** người dùng thử lại form Edit trên máy tính và phiên âm ở "This round". OK thì tick mục cuối của 3b, sang giai đoạn 4: gọi `challenger` soát [streak.md](docs/streak.md) trước khi viết code.
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
  - [x] Thiết kế + `challenger` (11 điểm, nhận hết); người dùng chốt #65–#67 (10 000 ký tự, Notes đầu trang, nháp trên máy, IPA kiểu Cambridge)
  - [x] Domain → data + SQL → UI, qua `reviewer` 3 lượt; chạy app thật trên Firefox + Supabase local, CSP thử trên bản build
  - [x] Sau khi tự soát: tách nâng `min_client_version` (#68), cảnh báo trước khi ghi đè ghi chú (#69), tách phiên âm chạy tuyến tính
  - [x] Deploy: `db push` thêm cột → `git push` + CI xanh
  - [x] Migration nâng `min_client_version` 3 (`db push`, đọc lại trên cloud ra 3)
  - [ ] Người dùng dùng thử: điện thoại đã ổn; máy tính chờ xác nhận sau hai lỗi đã sửa (#70)
- [ ] **4. Streak** — đủ các test trong [streak.md](docs/streak.md)
- [ ] **5. Sao lưu** — khôi phục toàn bộ dữ liệu từ file backup
- [ ] **6. Hoàn thiện** — phím tắt còn lại (nếu cần; 1–4 và Enter đã có, #55), dark mode + làm lại thiết kế cho đẹp hơn (người dùng muốn, 2026-11-04; có thể gửi ảnh app mẫu; giao diện mới từ giờ chỉ dùng biến màu `--color-*`, bóng đổ menu ⋯ đang viết thẳng màu); dark mode mặc định theo máy (`prefers-color-scheme`); màn Settings chỉ làm khi có ≥ 2–3 thứ người dùng thật sự muốn chỉnh (ứng viên: giao diện tự động/sáng/tối, số từ mỗi vòng, tài khoản + Sign out, gom xuất/khôi phục backup về đây), người dùng ghi lại nhu cầu khi dùng; README; tối ưu gói code (709 kB, nén 208 kB, chủ yếu supabase-js: xem có code bản local như Dexie bị gói vào không, tách phần chưa cần lúc mở app; người dùng nhờ ghi lại 2026-11-04); dùng thử 1 tuần

## Nhật ký (5 mục gần nhất, mới nhất trên cùng)
- 2026-11-04 — Theo #68, sau khi xác nhận Pages đã chạy client 3: migration riêng nâng `min_client_version` lên 3; `check`, 136 pgTAP + 78 hợp đồng cloud trên đúng commit, `db push --dry-run` chỉ một migration, `db push`, đọc lại trên cloud ra 3.
- 2026-11-04 — Theo góp ý sau khi dùng thử (điện thoại ổn): form sửa từ tại dòng trên máy tính bị bó vào một cột (`.term` 4 cột ghi đè `.term--editing`, có từ trước 3b) → đã sửa; phiên âm hiện ở danh sách tóm tắt (#70). 515 test, thử trên Firefox thật.
- 2026-11-04 — Deploy 3b theo #68: `db push` chỉ thêm cột, push `1b59a81` (lần đầu GitHub báo lỗi do sự cố, thử lại được), CI xanh, trang thật có Wiktionary trong CSP. Chưa nâng `min_client_version`.
- 2026-11-04 — Tự soát 3b theo yêu cầu người dùng, phát hiện test tốc độ chập chờn, báo sai tác động `db push`, nguy cơ khóa app, ghi đè ghi chú không báo → sửa (#68, #69), `reviewer` lượt 3 (10 điểm, chính: bản sao nhãn làm hết bộ nhớ) đã sửa; kiểm chứng clone sạch, CSP có đối chứng trên Firefox. Còn để sau: tách hook khỏi `TermForm`, `saved!` ở `FilePage`, so `updatedAt` phụ thuộc đồng hồ máy.
- 2026-11-04 — Code 3b: domain (`normalizeMultilineText`, backup v3 dạng bảng, `pickPronunciation` thử trên wikitext thật), data (Dexie v5, `updateFileNotes`, migration SQL, `wiktionary.ts`, CSP), UI (Notes đầu trang + nháp, Look up, phiên âm ở danh sách và màn phản hồi). `reviewer`: treo tab với wikitext hỏng (regex bậc hai), nhãn giọng sai thứ tự, kết quả tra lọt vào form trống, ghi chú cũ sau khi lưu → đã sửa. 495 test + 136 pgTAP + 78 hợp đồng cloud.