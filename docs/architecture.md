# Kiến trúc

## Triển khai
Web tĩnh, **không có backend** (giai đoạn 0–6).
- **Hosting:** GitHub Pages, link dạng `https://<username>.github.io/vocab/` (Vite cần `base: '/vocab/'`). Mỗi lần push lên `main`, GitHub Actions chạy lint → test → build → deploy.
- **Git:** làm việc trực tiếp trên `main` (trunk-based, phù hợp một người). CI đỏ thì không deploy.
- **Node:** phiên bản ghi trong `.nvmrc`; CI đọc cùng file đó, để máy local và CI giống nhau.
- **Repo public** (GitHub Pages miễn phí yêu cầu vậy). Chỉ code là public; từ vựng nằm trong trình duyệt, không bao giờ lên GitHub.
- **Lưu trữ:** Supabase (Postgres + Auth) từ giai đoạn 7, xem [cloud-sync.md](cloud-sync.md). `DexieRepository` (IndexedDB) vẫn giữ: chạy bộ test hợp đồng và test UI trong CI; bản cloud chỉ mở DB (version mới nhất, hiện là v4) để tab cũ reload.

## Rủi ro
| Rủi ro | Xử lý |
|--------|-------|
| Xóa dữ liệu trình duyệt → mất từ vựng | Xuất/nhập JSON, `navigator.storage.persist()`, nhắc sao lưu nếu > 7 ngày chưa xuất |
| Máy tính và iPhone không dùng chung dữ liệu | Giải quyết ở giai đoạn 7 ([cloud-sync.md](cloud-sync.md)), làm ngay sau giai đoạn 2 (#31) |
| Đổi cấu trúc dữ liệu | Version Dexie + migration ([data-model.md](data-model.md#migration)) |
| Repo Pages khác cùng origin `nquynhtran.github.io` đụng IndexedDB | Tên DB riêng `vocab-app`, không bao giờ đổi |

## Công nghệ
| Thành phần | Chọn | Lý do |
|-----------|------|-------|
| Ngôn ngữ | TypeScript `strict` | Bắt lỗi kiểu từ lúc viết |
| UI | React + Vite | Phổ biến, build nhanh |
| Router | React Router `HashRouter` | GitHub Pages không rewrite URL |
| CSDL | Dexie | Transaction, index, migration theo version |
| Validate | Zod | Một schema cho form, file nhập và kiểu TS |
| Test | Vitest + Testing Library + fake-indexeddb | Unit test domain, test repository |
| Cloud | `@supabase/auth-js` + `@supabase/postgrest-js` | Hai phần của client chính thức app dùng: Auth, PostgREST + RPC; `src/data/supabaseClient.ts` ghép lại thay `createClient` của supabase-js, vốn luôn gói cả realtime, storage, functions (#84, [cloud-sync.md](cloud-sync.md)) |
| Chất lượng | oxlint + Prettier | oxlint là mặc định của template Vite, nhanh, không cần cấu hình; chạy trong CI |
| CI/CD | GitHub Actions → GitHub Pages | Tự động hoàn toàn |

Thêm thư viện mới → ghi lý do vào [decisions.md](decisions.md).

**Gói code** (#84): thư viện nằm ở file riêng (`vendor`), deploy chỉ đổi code app thì trình duyệt dùng lại bản đã tải. Dexie được `import()` sau khi app đã hiện, vì bản cloud chỉ mở DB để tab cũ reload. Đo lại: `npm run build` rồi xem cỡ từng file trong `dist/assets`.

## Cấu trúc thư mục
```
src/
  domain/      # Kiểu, Zod schema, logic thuần. Không import React/Dexie
    day.ts     #   ngày địa phương `localDay` (Learn + streak)
    learn/     #   thuật toán học
    streak/    #   tính chuỗi ngày
  data/        # Repository interface, DexieRepository, SupabaseRepository + mapper, bộ test hợp đồng; Auth, CLIENT_VERSION; tra Wiktionary (3b)
  features/    # UI theo tính năng: auth/ folders/ files/ terms/ learn/ streak/ backup/
  shared/      # Component, hook dùng chung; RepositoryContext + useRepository, SignOutContext, PronunciationLookupContext (3b)
  app/         # Router, layout, AuthGate, khởi tạo (main.tsx tạo client Supabase + SupabaseRepository, mở VocabDb bản mới nhất)
```
`scripts/make-icons.mjs`: vẽ icon PNG trong `public/` (chạy tay, xem [cloud-sync.md](cloud-sync.md#iphone)). `supabase/` (ngoài `src/`): `migrations/` (SQL, không sửa file đã đẩy lên), `tests/database/` (pgTAP), `config.toml` và `seed.sql` (chỉ cho Supabase local). Chi tiết: [cloud-sync.md](cloud-sync.md#sql-đã-có-supabase).

**Phụ thuộc một chiều:** `app → features, shared` · `features → shared, domain, data` (riêng `HomePage` ghép ô của `features/backup` và `features/streak`, vì Home là nơi các tính năng này hiện ra) · `shared → domain, data` · `data → domain` · `domain` không phụ thuộc gì. `RepositoryContext` nằm ở `shared/` (không ở `app/`) để `features` không phải import ngược `app`. Test cạnh file: `foo.ts` ↔ `foo.test.ts`.

## Quy tắc `Repository`
Để giai đoạn 7 thay `DexieRepository` bằng `SupabaseRepository` mà không sửa UI hay domain:
- Mọi phương thức `async`, trả về plain object; không lộ kiểu của Dexie/Supabase.
- Thao tác cần toàn vẹn gói thành **một** phương thức, ví dụ `deleteFolder(id)` (xóa dây chuyền) hay `recordAnswer(answer)` (cập nhật tiến độ + ngày học). UI không tự ghép nhiều lệnh ghi. Dexie dùng transaction, Supabase dùng hàm Postgres (RPC).
- UI không dùng `liveQuery`; ghi xong thì tải lại qua repository.
- `id` do client sinh (`crypto.randomUUID()`).
- UI lấy repository qua React Context (Dependency Injection), test truyền bản giả vào.
- Interface tách theo thực thể (`FolderRepository`, `FileRepository`, `TermRepository`…), `Repository` ghép tất cả lại. Component chỉ khai báo phần nó dùng; bản giả trong test chỉ cần cài phần đó.
- **Test hợp đồng (LSP):** `src/data/repositoryContract.ts` là bộ test hành vi dùng chung (lỗi, thứ tự, xóa dây chuyền, xóa không tồn tại là no-op, >1000 dòng), nhận factory tạo repository trên kho trống. Chỉ đi qua repository (kiểm tra bảng bằng `exportBackup()`); test riêng của từng kho để ở file test của nó. Thứ tự sắp xếp (`data/ordering.ts`) và `RepositoryDeps` (`data/deps.ts`) dùng chung để hai bản cài đặt không lệch nhau.
