# Tiến độ

> File này được nạp tự động mỗi phiên. Giữ ngắn: chỉ trạng thái hiện tại, checklist và 5 mục nhật ký gần nhất.

## Đang ở đâu
- **Giai đoạn:** 0 — Chuẩn bị (gần xong)
- **Việc tiếp theo:** người dùng tạo repo public `vocab` trên GitHub (trống) → `git remote add origin git@github.com:nquynhtran/vocab.git && git push -u origin main` → bật Pages (Settings → Pages → Source: GitHub Actions) → kiểm tra CI xanh và mở link
- **Đang vướng:** chờ người dùng tạo repo

## Kế hoạch
Mỗi giai đoạn xong khi: test xanh, CI xanh, đã deploy, không còn vấn đề nghiêm trọng đã biết, người dùng dùng thử OK. Khi nào gọi agent: xem CLAUDE.md.

- [ ] **0. Chuẩn bị** — mở được link GitHub Pages
  - [x] Cài Node.js 24 LTS qua `nvm`, ghi `.nvmrc`
  - [x] `git init`, `.gitignore`; git identity và SSH key GitHub đã có sẵn
  - [ ] Tạo repo public `vocab` trên GitHub, push
  - [x] Vite 8 + React 19 + TS strict (`base: '/vocab/'`), oxlint, Prettier, Vitest; `npm run check` xanh
  - [x] CSP chỉ chèn vào bản build production (plugin trong `vite.config.ts`)
  - [x] Workflow `.github/workflows/deploy.yml`: `npm ci` → check → audit → build → deploy
  - [ ] Bật Pages (Source: GitHub Actions), CI xanh, mở được link
  - [x] Hook `.claude/hooks/format.sh` tự chạy Prettier sau Edit/Write; allowlist các lệnh `npm run` kiểm tra/build
- [ ] **1. Tầng dữ liệu** — test CRUD + ràng buộc pass ([data-model.md](docs/data-model.md), [architecture.md](docs/architecture.md))
- [ ] **2. Quản lý từ vựng** — tạo folder → file → từ, tải lại không mất ([ui.md](docs/ui.md))
- [ ] **3. Learn** — học một file đến khi thuộc hết ([learn-algorithm.md](docs/learn-algorithm.md))
- [ ] **4. Streak** — đủ các test trong [streak.md](docs/streak.md)
- [ ] **5. Sao lưu** — khôi phục toàn bộ dữ liệu từ file backup
- [ ] **6. Hoàn thiện** — phím tắt, dark mode, README; dùng thử 1 tuần
- [ ] **7. Cloud & iPhone** — dùng chung dữ liệu máy tính ↔ iPhone ([cloud-sync.md](docs/cloud-sync.md))

## Nhật ký (5 mục gần nhất, mới nhất trên cùng)
- 2026-10-22 — Thêm agent `reviewer`, `challenger`; mở rộng `/save-progress` (rà soát + dọn dẹp + tóm tắt chuyển phiên).
- 2026-10-22 — Soát lại thiết kế: tách mức trong phiên khỏi `box` lưu DB, chuẩn hóa NFC, unique index, CSP chỉ ở production, bổ sung bước xác thực GitHub.
- 2026-10-22 — Chốt thiết kế, tách tài liệu theo chủ đề trong `docs/`, tạo PROGRESS.md và skill `/save-progress`.
