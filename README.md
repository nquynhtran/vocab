# Vocab

App học từ vựng tiếng Anh cá nhân, chỉ có chế độ Learn (trắc nghiệm + viết lại), kèm streak ngày học.

**Dùng app:** https://nquynhtran.github.io/vocab/

## Chạy trên máy
Cần Node.js theo `.nvmrc` (cài qua `nvm install`).

```bash
npm install
npm run dev      # chạy local
npm run check    # lint + format + typecheck + test
npm run build    # build bản production vào dist/
```

Mỗi lần push lên `main`, GitHub Actions tự kiểm tra và deploy lên GitHub Pages.

Tài liệu thiết kế: [docs/README.md](docs/README.md) · Tiến độ: [PROGRESS.md](PROGRESS.md)
