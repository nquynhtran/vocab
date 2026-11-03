# Tiến độ

> File này được nạp tự động mỗi phiên. Giữ ngắn: chỉ trạng thái hiện tại, checklist và 5 mục nhật ký gần nhất.

## Đang ở đâu
- **Giai đoạn:** 3 (Learn), đã deploy và người dùng dùng thử. Đang làm đợt 1 cải tiến theo góp ý (#56–#62).
- **Việc tiếp theo:** đợt 1 xong, người dùng dùng thử OK. Tiếp: 3b (ghi chú file + phiên âm, cần `challenger` trước).
- **Đang vướng:** không. Build có cảnh báo chunk > 500 kB (supabase-js), chưa xử lý. 🔊 không kêu trong Simple Browser của VS Code. `npm run build` ở máy cần `VITE_SUPABASE_*` (xem cloud-sync.md). iPhone iOS cũ của người dùng tạo folder bị lỗi chưa rõ nguyên nhân (cloud-sync.md#iphone); người dùng sẽ cập nhật máy.

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
- [ ] **3. Learn** — học một file đến khi thuộc hết ([learn-algorithm.md](docs/learn-algorithm.md))
  - [x] Qua `challenger`, chốt #50–#54 (tăng hộp tối đa 1 lần/ngày, chống ghi trùng + Retry, trắc nghiệm ghi ngay, không hiện loại từ, luôn lấy đáp án nhiễu cả folder)
  - [x] `lastPromotedDay`: schema domain, Dexie v4, backup `schemaVersion` 2 (+ nhận file v1), migration `learn.sql` (cột, `import_snapshot`, `min_client_version` 2), `CLIENT_VERSION` 2. Commit ở máy, **chưa push** (phải `db push` trước)
  - [x] `domain/learn/` + `domain/day.ts`: `localDay`, priority, vòng, chèn lại, đáp án nhiễu, che ví dụ, chấm câu viết, `applyAnswer`; test cố định `TZ` UTC+7; qua `reviewer` (1 nghiêm trọng: regex gạch nối, đã sửa + 5 nhỏ)
  - [x] `recordAnswer` + `getLearnData` (Dexie + bộ hợp đồng, `progressAfter` ở domain); `record_answer`/`get_learn_data` trong `learn.sql` + pgTAP; qua `reviewer` (2 điểm, đã sửa). Commit ở máy, **chưa push**
  - [x] Màn Learn + tóm tắt vòng/phiên + phím 1–4 (#55), `learnFlow.ts` thuần; qua `reviewer` (6 điểm đã sửa, 1 chấp nhận). Commit ở máy, **chưa push**
  - [x] Deploy (`db push` trước, `min_client_version` 2), người dùng dùng thử: "khá mượt"
  - [x] Đợt 1 phần A: đan xen câu viết + thanh hai màu (#56), loại từ trong câu hỏi (#61, thay #53), ví dụ trong trắc nghiệm (#57), chạm từ để nghe ở màn tóm tắt + dòng giải thích mastered, gạch đỏ chính tả ở form từ (#60). Commit ở máy, **chưa push**
  - [x] Đợt 1 phần B: học tiếp sau Stop (#58, #62, qua `challenger` 7 điểm + `reviewer` 5 điểm, đã sửa hết), menu ⋯ (#59); deploy
  - [x] Người dùng dùng thử đợt 1 trên điện thoại: bình thường, giao diện không tràn lề
- [ ] **3b. Ghi chú file + phiên âm** (đợt 2, [scope.md](docs/scope.md)): thiết kế → `challenger` → đổi cấu trúc dữ liệu một lần → deploy
- [ ] **4. Streak** — đủ các test trong [streak.md](docs/streak.md)
- [ ] **5. Sao lưu** — khôi phục toàn bộ dữ liệu từ file backup
- [ ] **6. Hoàn thiện** — phím tắt còn lại (nếu cần; 1–4 và Enter đã có, #55), dark mode, README; dùng thử 1 tuần

## Nhật ký (5 mục gần nhất, mới nhất trên cùng)
- 2026-11-03 — Theo góp ý: bỏ câu hỏi Continue / Start over, mở Learn là học tiếp phiên dở luôn (#63); bỏ `lastStudied`, giữ `savedAt` trong bản lưu (khỏi lên version 2); 374 test, đã deploy.
- 2026-11-03 — Tự soát đợt 1: `reviewer` soát bù #56 (không lỗi) và #59 (Tab không đóng menu mở bằng chuột; Safari không focus nút nên Escape không tới → đóng theo `onBlur` có `relatedTarget`, bấm thì focus ⋯; đã sửa, thử thêm trên Firefox thật); chạy app thật qua geckodriver + Supabase local; người dùng thử trên điện thoại OK; 377 test, đã deploy.
- 2026-11-03 — Đợt 1 phần B: menu ⋯ tự viết (`shared/RowMenu.tsx`, bấm ra ngoài chỉ đóng, không kéo focus); học tiếp sau Stop (`domain/learn/resume.ts` + `sessionStore.ts`, một effect ghi/xóa, ghi hỏng thì xóa bản cũ, bản vô dụng cũng xóa); người dùng chọn luôn hỏi kèm "last studied N days ago" (#62); `challenger` 7 điểm (chính: "Study again" sau Stop xóa mất phiên), `reviewer` 5 điểm (chính: test xóa-khi-xong bị lớp khác che, ghi LESSONS); 375 test. Deploy cả đợt 1.
- 2026-11-03 — Đợt 1 phần A: từ đúng trắc nghiệm quay lại thành câu viết sau 3–4 câu trong cùng vòng, vòng xong khi 7 từ đều thuộc; thanh tiến độ SVG hai màu (CSP chặn style nội tuyến); loại từ sau nghĩa (người dùng đổi ý, #61 thay #53; `PartOfSpeechLabel` sang `shared/`); ví dụ che từ ở cả trắc nghiệm (gom vào `Prompt`); chạm từ ở màn tóm tắt để nghe; `spellcheck` ở Term/Example. Không gọi `reviewer` (thay đổi nhỏ, phá code thử 5 chỗ đều đỏ). `git checkout` khi phá code thử xóa mất phần sửa chưa commit (ghi LESSONS). 341 test. Commit ở máy, **chưa push**.
- 2026-10-25 — Giai đoạn 3 bước 4: màn Learn (`features/learn/`: `learnFlow.ts` thuần, câu hỏi, phản hồi + I was right, lưu + Retry/Stop, tóm tắt vòng/phiên, phím 1–4), `summary.ts` ở domain, nút Learn ở trang File, `ListenButton` sang `shared/` (#55: Stop → màn kết thúc, 🔊 ở phản hồi, phím làm ngay); `reviewer`: phím lọt qua lớp phủ đăng nhập (`inert`), test mất phiên trên app thật, focus sau I was right, chữ Saving… (đã sửa, ghi LESSONS); 331 test. Commit ở máy, **chưa push**.
