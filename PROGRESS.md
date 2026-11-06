# Tiến độ

> File này được nạp tự động mỗi phiên. Giữ ngắn: chỉ trạng thái hiện tại, checklist và 5 mục nhật ký gần nhất.

## Đang ở đâu
- **Giai đoạn:** 4 (Streak), đã deploy (`db push`, push `44aa949`, CI xanh, trang thật đã có code mới), chờ người dùng dùng thử.
- **Việc tiếp theo:** người dùng thử trên máy tính và iPhone (số có tự cập nhật khi mở lại app không).
- **Đang vướng:** không. Build có cảnh báo chunk > 500 kB (supabase-js), để giai đoạn 6. 🔊 không kêu trong Simple Browser của VS Code. `npm run build` ở máy cần `VITE_SUPABASE_*` (xem cloud-sync.md). iPhone iOS cũ của người dùng tạo folder bị lỗi chưa rõ nguyên nhân (cloud-sync.md#iphone); người dùng sẽ cập nhật máy. Đã thỏa thuận để sau: tách hook khỏi `TermForm`, `saved!` ở `FilePage`, so `updatedAt` phụ thuộc đồng hồ máy.

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
- [ ] **4. Streak** — đủ các test trong [streak.md](docs/streak.md)
  - [x] Thiết kế + `challenger`; người dùng chọn phần hiển thị (#71–#74)
  - [x] Domain, `listStudyDays` + RPC, ô streak + lịch; qua `reviewer` (4 điểm nên sửa + 3 điểm nhỏ đã sửa, 2 điểm chấp nhận); 591 test + `test:zone` + 141 pgTAP + 84 hợp đồng xanh
  - [x] Sửa đăng xuất nhầm do 401 về muộn (#75), theo yêu cầu soát lại; qua `reviewer` 2 lượt
  - [x] Deploy: `db push` một hàm đọc → `git push` + CI xanh
  - [ ] Người dùng dùng thử
- [ ] **5. Sao lưu** — khôi phục toàn bộ dữ liệu từ file backup; quyết hai câu hỏi đang mở (#74)
- [ ] **6. Hoàn thiện** — phím tắt còn lại (nếu cần; 1–4 và Enter đã có, #55), dark mode + làm lại thiết kế cho đẹp hơn (người dùng muốn, 2026-11-04; có thể gửi ảnh app mẫu; giao diện mới từ giờ chỉ dùng biến màu `--color-*`, bóng đổ menu ⋯ đang viết thẳng màu); dark mode mặc định theo máy (`prefers-color-scheme`); màn Settings chỉ làm khi có ≥ 2–3 thứ người dùng thật sự muốn chỉnh (ứng viên: giao diện tự động/sáng/tối, số từ mỗi vòng, tài khoản + Sign out, gom xuất/khôi phục backup về đây), người dùng ghi lại nhu cầu khi dùng; README; tối ưu gói code (709 kB, nén 208 kB, chủ yếu supabase-js: xem có code bản local như Dexie bị gói vào không, tách phần chưa cần lúc mở app; người dùng nhờ ghi lại 2026-11-04); dùng thử 1 tuần

## Nhật ký (5 mục gần nhất, mới nhất trên cùng)
- 2026-11-06 — Người dùng yêu cầu soát lại: rủi ro 401 về muộn đăng xuất luôn phiên mới; chặn ở ô streak là vá triệu chứng nên gỡ, sửa tại `expireSession` (#75, hỏi lại máy chủ, chỉ lỗi Auth 401/403 mới đăng xuất). Tách lại commit chưa push.
- 2026-11-05 — Viết xong Streak theo #71–#74; `reviewer` nêu cả lệnh kiểm tra múi giờ ghi trong tài liệu không có tác dụng (`TZ` bị cấu hình ghi đè) → thêm `test:zone` vào `check`. Thử trên Firefox thật: màn rộng và khung 375 px. Chưa deploy.
- 2026-11-04 — Người dùng xác nhận form Edit trên máy tính và phiên âm ở "This round" đã ổn → đóng 3b.
- 2026-11-04 — Theo #68, sau khi xác nhận Pages đã chạy client 3: migration riêng nâng `min_client_version` lên 3; `check`, 136 pgTAP + 78 hợp đồng cloud trên đúng commit, `db push --dry-run` chỉ một migration, `db push`, đọc lại trên cloud ra 3.
- 2026-11-04 — Theo góp ý sau khi dùng thử (điện thoại ổn): form sửa từ tại dòng trên máy tính bị bó vào một cột (`.term` 4 cột ghi đè `.term--editing`, có từ trước 3b) → đã sửa; phiên âm hiện ở danh sách tóm tắt (#70). 515 test, thử trên Firefox thật.
