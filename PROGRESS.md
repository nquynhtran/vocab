# Tiến độ

> File này được nạp tự động mỗi phiên. Giữ ngắn: chỉ trạng thái hiện tại, checklist và 5 mục nhật ký gần nhất.

## Đang ở đâu
- **Giai đoạn:** 1 xong (tầng dữ liệu, chưa nối vào UI). Sắp vào giai đoạn 2.
- **Việc tiếp theo:** Giai đoạn 2 — đọc `docs/ui.md`, cài React Router (`HashRouter`), tạo `RepositoryContext` trong `src/app/` (tạo `VocabDb` với `onVersionChange` → hiện "A new version is available. Reloading…" rồi reload), sau đó làm màn Home (folder).
- **Đang vướng:** không

## Kế hoạch
Mỗi giai đoạn xong khi: test xanh, CI xanh, đã deploy, không còn vấn đề nghiêm trọng đã biết, người dùng dùng thử OK. Khi nào gọi agent: xem CLAUDE.md.

- [x] **0. Chuẩn bị** — mở được link GitHub Pages
  - [x] Cài Node.js 24 LTS qua `nvm`, ghi `.nvmrc`
  - [x] `git init`, `.gitignore`; git identity và SSH key GitHub đã có sẵn
  - [x] Tạo repo public `vocab` trên GitHub, push qua SSH
  - [x] Vite 8 + React 19 + TS strict (`base: '/vocab/'`), oxlint, Prettier, Vitest; `npm run check` xanh
  - [x] CSP chỉ chèn vào bản build production (plugin trong `vite.config.ts`)
  - [x] Workflow `.github/workflows/deploy.yml`: `npm ci` → check → audit → build → deploy
  - [x] Bật Pages, CI xanh, link trả về 200 kèm CSP và đủ asset
  - [x] Hook `.claude/hooks/format.sh` tự chạy Prettier sau Edit/Write; allowlist các lệnh `npm run` kiểm tra/build
- [x] **1. Tầng dữ liệu** — test CRUD + ràng buộc pass ([data-model.md](docs/data-model.md), [architecture.md](docs/architecture.md))
  - [x] `domain/`: `text.ts` (normalizeText, toKey, compareNames), `schemas.ts` (Zod), `errors.ts`
  - [x] `data/`: interface `Repository`, `VocabDb` v1 (đủ bảng), `DexieRepository` CRUD + xóa dây chuyền + `findTermsByWord`; 47 test
  - [x] `recordAnswer`, đếm từ/% thuộc, export/import để ở giai đoạn 2–5 (bảng đã có sẵn ở v1)
- [ ] **2. Quản lý từ vựng** — tạo folder → file → từ, tải lại không mất ([ui.md](docs/ui.md))
- [ ] **3. Learn** — học một file đến khi thuộc hết ([learn-algorithm.md](docs/learn-algorithm.md))
- [ ] **4. Streak** — đủ các test trong [streak.md](docs/streak.md)
- [ ] **5. Sao lưu** — khôi phục toàn bộ dữ liệu từ file backup
- [ ] **6. Hoàn thiện** — phím tắt, dark mode, README; dùng thử 1 tuần
- [ ] **7. Cloud & iPhone** — dùng chung dữ liệu máy tính ↔ iPhone ([cloud-sync.md](docs/cloud-sync.md))

## Nhật ký (5 mục gần nhất, mới nhất trên cùng)
- 2026-10-22 — Xong giai đoạn 1: domain + DexieRepository, qua `challenger` và `reviewer`; README tiếng Anh; thêm `LESSONS.md`.
- 2026-10-22 — Xong giai đoạn 0: Node 24, Vite 8 + React 19 + TS, CI/CD lên GitHub Pages chạy xanh.
- 2026-10-22 — Thêm agent `reviewer`, `challenger`; mở rộng `/save-progress` (rà soát + dọn dẹp + tóm tắt chuyển phiên).
- 2026-10-22 — Soát lại thiết kế: tách mức trong phiên khỏi `box` lưu DB, chuẩn hóa NFC, unique index, CSP chỉ ở production, bổ sung bước xác thực GitHub.
- 2026-10-22 — Chốt thiết kế, tách tài liệu theo chủ đề trong `docs/`, tạo PROGRESS.md và skill `/save-progress`.
