# Tiến độ

> File này được nạp tự động mỗi phiên. Giữ ngắn: chỉ trạng thái hiện tại, checklist và 5 mục nhật ký gần nhất.

## Đang ở đâu
- **Giai đoạn:** 2 xong và đã deploy. Tiếp theo là **giai đoạn 7 (cloud)**, làm trước Learn (quyết định #31).
- **Việc tiếp theo:** đọc `docs/cloud-sync.md` → gọi `challenger` soát kế hoạch, nhất là cách đưa dữ liệu local hiện có lên cloud → chốt với người dùng → hướng dẫn người dùng tạo project Supabase (gói miễn phí) rồi mới code.
- **Đang vướng:** không. Người dùng chưa thử bản có loại từ + nút 🔊.
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
- [ ] **3. Learn** — học một file đến khi thuộc hết ([learn-algorithm.md](docs/learn-algorithm.md))
- [ ] **4. Streak** — đủ các test trong [streak.md](docs/streak.md)
- [ ] **5. Sao lưu** — khôi phục toàn bộ dữ liệu từ file backup
- [ ] **6. Hoàn thiện** — phím tắt, dark mode, README; dùng thử 1 tuần

## Nhật ký (5 mục gần nhất, mới nhất trên cùng)
- 2026-10-22 — Rà soát lại giai đoạn 2: gom code lặp, đọc màn Folder trong một transaction, Dexie v2 (#32) chặn tab cũ xóa loại từ, sửa giọng đọc; 86 test.
- 2026-10-22 — Feedback giai đoạn 2: thêm loại từ, phát âm en-GB; chốt làm cloud trước Learn (#29–31).
- 2026-10-22 — Xong giai đoạn 2: UI folder/file/từ, 84 test, qua `reviewer` (6 điểm, đã sửa hết).
- 2026-10-22 — Xong giai đoạn 1: domain + DexieRepository, qua `challenger` và `reviewer`; README tiếng Anh; thêm `LESSONS.md`.
- 2026-10-22 — Xong giai đoạn 0: Node 24, Vite 8 + React 19 + TS, CI/CD lên GitHub Pages chạy xanh.
