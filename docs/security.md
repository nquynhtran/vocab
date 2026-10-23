# Bảo mật

- **XSS:** không dùng `dangerouslySetInnerHTML`, `innerHTML`, `eval`. Nội dung người dùng chỉ render dạng text qua React.
- **Dữ liệu không tin cậy:** file JSON nhập vào và dữ liệu đọc từ DB version cũ đều validate bằng Zod trước khi dùng. File nhập ≤ 5 MB.
- **Secret:** không có secret nào trong code hay repo. Deploy dùng `GITHUB_TOKEN` của Actions.
- **Least Privilege:** workflow chỉ khai báo quyền cần thiết (`contents: read`, `pages: write`, `id-token: write`).
- **CSP:** thẻ meta Content-Security-Policy `default-src 'self'`, chỉ chèn vào **bản build production** (Vite dev server chèn `<style>` để hot reload, CSP chặt sẽ làm hỏng môi trường dev). Giai đoạn 7 thêm domain Supabase vào `connect-src`.
- **Dependency:** chỉ thêm thư viện thật sự cần; commit `package-lock.json`, CI cài bằng `npm ci`; CI chạy `npm audit --omit=dev --audit-level=high` (chỉ chặn lỗ hổng ở thư viện chạy trong app, không chặn deploy vì công cụ dev).
- **Phiên đăng nhập** nằm trong `localStorage` (khóa `vocab-auth`). Origin `nquynhtran.github.io` dùng chung cho mọi repo Pages của tài khoản, nên trang của repo khác đọc được token: chỉ đưa lên Pages code mình tin. Ô mật khẩu dùng `autocomplete="current-password"` để trình quản lý mật khẩu điền.
- Giai đoạn 7 (Supabase, RLS, khóa `anon`): xem [cloud-sync.md](cloud-sync.md).
