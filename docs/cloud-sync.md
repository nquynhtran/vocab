# Giai đoạn 7: Đăng nhập, cloud & iPhone

Chỉ đọc khi làm giai đoạn 7. **Làm ngay sau giai đoạn 2, trước Learn** (quyết định #31); giữ số 7 để không phải đổi các chỗ tham chiếu. Kế hoạch đã qua `challenger`, các điểm khó đã chốt ở #33–#38.

## Vấn đề
Không đăng nhập thì dữ liệu nằm riêng trong trình duyệt của từng máy: từ thêm trên máy tính không có trên iPhone và ngược lại. Ngoài ra, Safari trên iPhone tự xóa dữ liệu của trang web không mở trong 7 ngày.

## Giải pháp: Supabase (gói miễn phí, Postgres + Auth)
- Đăng nhập email + mật khẩu, một tài khoản duy nhất. Tắt đăng ký mới và anonymous sign-in sau khi tạo tài khoản.
- **Row Level Security** trên mọi bảng: mỗi dòng có `user_id uuid not null default auth.uid()`. Đủ 4 policy select/insert/update/delete dạng `to authenticated using ((select auth.uid()) = user_id)` (insert/update thêm `with check`). Thiếu policy `select` thì `update ... select()` trả rỗng và bị hiểu nhầm là "không tồn tại". Khóa `anon`/publishable được phép nằm trong frontend vì quyền do RLS kiểm soát. Không bao giờ đưa khóa `service_role` vào frontend hay repo.
- SQL nằm trong `supabase/migrations/` của repo; không sửa schema bằng tay trên dashboard.
- Ràng buộc ở [data-model.md](data-model.md) chuyển thành khóa ngoại, `ON DELETE CASCADE`, `UNIQUE`, `CHECK` trong Postgres.
- Trùng tên: lưu cột `name_key`/`word_key` do client tính bằng `toKey` của domain, `UNIQUE (user_id, name_key)`. **Không** dùng index trên biểu thức `lower(...)`: `lower()` và `\s` của Postgres khác JS, local và cloud sẽ hiểu "trùng" khác nhau. Sắp xếp cũng dùng `compareNames` của domain, không dựa vào `ORDER BY` theo collation.
- `id` và `created_at`/`updated_at` do client gửi lên (giữ nguyên khi chuyển dữ liệu). **Không** đặt `DEFAULT now()` hay trigger `updated_at`.
- `SupabaseRepository` cài đặt cùng interface với `DexieRepository` ([architecture.md](architecture.md#quy-tắc-repository)), interface đã toàn `async` nên UI và domain không đổi.
- App cần mạng; học offline không nằm trong phạm vi.

## SQL đã có (`supabase/`)
- Migration: `20261022121518_initial_schema.sql` (bảng, RLS, `import_snapshot`, `export_backup`), `20261022124114_read_functions.sql` (`list_terms`, `get_folder_contents`, #39). Test pgTAP: `supabase/tests/database/`, chạy `npx supabase start` rồi `npm run test:supabase`. Test giả lập người dùng bằng `set local role authenticated` + `request.jwt.claims`, không cần khóa nào.
- **Khóa ngoại gồm `user_id`** (`(user_id, folder_id) → folders(user_id, id)`): Postgres kiểm tra khóa ngoại không qua RLS, khóa đơn sẽ cho gắn dòng vào folder của người khác.
- Thu hồi rồi cấp quyền tường minh (bảng và `EXECUTE` của hàm), vì Supabase local mặc định cấp hết cho `anon`/`PUBLIC`. `authenticated` không có `TRUNCATE` (bỏ qua RLS). **Mỗi migration mới** tạo bảng/hàm cũng phải revoke/grant như vậy; test duyệt mọi object trong `public` sẽ đỏ nếu quên.
- Tên constraint là hợp đồng với client: `folders_name_key_unique`, `files_name_key_unique` → `DuplicateNameError`.
- CHECK chỉ là lưới an toàn (độ dài đếm theo ký tự, `box`, số ≥ 0, `part_of_speech`). Danh sách `part_of_speech` lặp lại `PARTS_OF_SPEECH`: đổi danh sách phải thêm migration SQL; bộ test hợp đồng (bước 4) tạo từ với mọi giá trị để bắt lệch.
- `import_snapshot(payload)`: payload gồm đủ 5 mảng `folders, files, terms, progress, study_days`, mỗi phần tử là dòng snake_case có **đúng đủ** các cột (trống thì `null`), gồm `name_key`/`word_key` do client tính, không có `user_id`. Lỗi: `VC001` "Cloud already has data", `22023` thiếu mảng hoặc sai bộ key (`jsonb_populate_recordset` lặng lẽ bỏ key lạ, nên phải tự kiểm tra). Khóa advisory theo user để hai lần nhập đồng thời không cùng lọt.
- `export_backup()`: một câu SQL (một snapshot), trả `{ folders, files, terms, progress, study_days }` gồm cả `user_id`, `name_key`, `null`; mapper bỏ đi, client tự thêm `schemaVersion`, `exportedAt`.
- Thêm cột về sau: sửa cả danh sách cột trong `import_snapshot` (thiếu thì payload có cột mới bị từ chối, lỗi rõ chứ không mất dữ liệu).
- `user_id` trỏ `auth.users` với `on delete cascade`: xóa tài khoản trên dashboard là xóa hết dữ liệu. Export JSON trước nếu cần.
- `app_config`: đúng một dòng, `min_client_version = 1`; chỉ `authenticated` đọc được, nên client kiểm tra version **sau khi đăng nhập** (chưa đăng nhập thì `anon` bị từ chối, không phải lỗi mạng).
- Chưa có: RPC `record_answer` (giai đoạn 3, migration mới); bảng `meta` (`migratedAt` chỉ ở local; `lastBackupAt` tính ở giai đoạn 5).
- `list_terms(p_file_id)`, `get_folder_contents(p_folder_id)`: trả `jsonb` (không bị cắt ở `max_rows`, một snapshot). `get_folder_contents` trả `{ folder, files, terms: [{ file_id, box }] }` hoặc `null`; "đã thuộc" do client tính bằng `isMastered`, không lặp lại trong SQL.
- `supabase/config.toml` (chỉ cho local): tắt đăng ký bằng `[auth] enable_signup = false` như cloud. `[auth.email] enable_signup` phải để `true`: ở local nó bật/tắt cả nhà cung cấp email, `false` thì không đăng nhập được. Tắt realtime, storage, edge functions, analytics cho nhẹ.
- `supabase/seed.sql`: người dùng test `contract@test.local` cho bộ hợp đồng Vitest (đăng ký đã tắt). Chỉ chạy ở local (`start`, `db reset`); **không** dùng `db push --include-seed` hay `db reset --linked` (thiếu `--no-seed`), vì mật khẩu nằm công khai trong repo. File tự báo lỗi nếu JWT secret không phải secret demo của CLI local.

## Khác biệt so với Dexie (phải có trong test hợp đồng)
PostgREST mỗi request là một transaction riêng, nên không "kiểm tra rồi ghi" trong cùng transaction được:
- Lớp chặn chính là ràng buộc DB. Lỗi `23505` (unique) theo tên constraint → `DuplicateNameError`; `23503` (khóa ngoại) → `EntityNotFoundError`. Trên cloud đây là chuyện bình thường (hai máy cùng ghi), không phải bug như `ConstraintError` của Dexie.
- Hai máy cùng sửa một bản ghi: bản ghi sau thắng (#42).
- Update luôn kèm `.select()` để đếm số dòng: 0 dòng → `EntityNotFoundError`. Delete không cần đếm: 0 dòng là no-op như Dexie.
- Đọc cần một snapshot (`getFolderContents`, `findTermsByWord`, `exportBackup`) → một request embed hoặc một view/RPC, không ghép nhiều request; riêng `exportBackup` là một RPC đọc mọi bảng trong một transaction, để backup không trộn trạng thái trước và sau một lần ghi từ máy khác.
- Thao tác nhiều bảng (`recordAnswer`, nhập snapshot) là hàm Postgres gọi qua RPC, `SECURITY INVOKER` để RLS vẫn áp dụng; `user_id` lấy từ `auth.uid()` trong hàm, không lấy từ payload.
- Lỗi mạng (`status` 0) → `ConnectionError`; HTTP 401 (chưa đăng nhập, phiên hết hạn) → `SessionExpiredError`; lỗi khác → `Error` kèm mã Postgres. UI báo lỗi và giữ nguyên nội dung form đang gõ (bước 5). supabase-js tự thử lại **GET** 3 lần (chờ 1 + 2 + 4 s) khi mất mạng hoặc gặp 503/520, nên offline thì thao tác đọc mất ~7 s mới báo lỗi; POST (ghi, RPC) không thử lại.
- `ConnectionError` khi ghi **không** có nghĩa là chưa ghi: request có thể đã được áp dụng, chỉ mất phản hồi. Thử lại mù quáng sẽ tạo từ trùng (từ không có unique). Bước 5: nếu cho thử lại thì dùng **lại đúng id cũ** (id do client sinh), gặp trùng khóa chính (`*_pkey`) nghĩa là lần trước đã ghi được, đọc lại thay vì báo lỗi.
- Id không phải UUID: Postgres báo lỗi `22P02`, còn Dexie chỉ "không thấy". `SupabaseRepository` không gửi request: đọc trả `undefined`/`[]`, ghi báo `EntityNotFoundError`, xóa là no-op.
- PostgREST cắt ngầm SELECT ở `max_rows` = 1000 dòng, **kể cả embed lồng nhau** (đã thử). `listTerms`, `getFolderContents`, `exportBackup` đi qua RPC trả `jsonb`; `listFolders`, `listFiles`, `findTermsByWord` là select thường, nhận đủ 1000 dòng thì báo lỗi thay vì hiện thiếu (#39). Bộ hợp đồng có test 1001 từ.
- Chuỗi Zod nhận nhưng Postgres từ chối (`\u0000` → `22P05`, surrogate lẻ → `PGRST102`): schema domain chặn trước (#40).

## Validate dữ liệu tải về (#35)
Dữ liệu từ cloud là dữ liệu từ biên: **validate khi đọc**, ngoại lệ của #24. Không tin vào CHECK của Postgres. Mapper riêng (có test), theo thứ tự:
1. snake_case → camelCase, bỏ `user_id`, `name_key`, `word_key`;
2. `null` → bỏ trường (schema chỉ nhận `undefined` cho trường không bắt buộc);
3. thời gian: `new Date(x).toISOString()`. PostgREST trả `+00:00` và số chữ số thập phân thay đổi, còn `z.iso.datetime()` chỉ nhận `Z`; không nới schema vì sắp xếp `newestFirst` so chuỗi;
4. parse bằng schema domain (`TermSchema`...) và so kết quả với đầu vào: khác nhau (ví dụ dòng sửa tay chưa chuẩn hóa) là lỗi, không lặng lẽ sửa.

Một dòng hỏng → cả thao tác báo `InvalidStoredDataError` kèm vị trí (fail fast), không bỏ qua dòng. Mapper ở `src/data/supabaseRows.ts`: danh sách cột lấy từ shape của schema domain, nên khi đọc chỉ giữ cột domain biết, khi ghi luôn gửi đủ mọi cột (thiếu thì `null`, #34). Ngoại lệ: `exportBackup` chỉ làm bước 1–3, không validate (#41).

## Đăng nhập & phiên (bước 5, #43–#45)
- `main.tsx` chỉ chạy bản cloud: `data/supabaseClient.ts` đọc `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (thiếu thì báo lỗi ngay). `npm run dev` dùng `.env.development` (Supabase local, khóa demo công khai của CLI); bản build lấy biến của GitHub Actions (bước 6). Phiên lưu ở `localStorage` khóa `vocab-auth` (origin dùng chung với mọi repo Pages của tài khoản, như IndexedDB); `detectSessionInUrl: false` vì không dùng link đăng nhập và hash là của `HashRouter`.
- UI chỉ biết interface `Auth` (`data/auth.ts`: `subscribe`, `signIn`, `signOut`, `expireSession`), bản cài đặt `SupabaseAuth`; test dùng bản giả. Sai email/mật khẩu, quá nhiều lần thử, mất mạng khi đăng nhập → `SignInError` có câu báo riêng.
- `AuthGate` (`app/`): chưa biết phiên → "Loading…"; chưa đăng nhập → màn đăng nhập; **mỗi lần** đăng nhập (kể cả đăng nhập lại cùng tài khoản) → kiểm tra `min_client_version` **rồi mới** hiện hoặc mở lại app, để code cũ không kịp ghi. Kiểm tra lỗi → báo lỗi kèm nút Retry; phiên đổi thì lỗi cũ bị xóa.
- **Mất phiên khi đang dùng (401):** app **không bị gỡ** khỏi trang, chỉ bị `inert` và phủ hộp đăng nhập lên trên, nên chữ đang gõ trong form vẫn còn; form hiện "Your session has expired…". Đăng nhập lại cùng tài khoản thì bấm lưu lại là xong. Tài khoản khác → app dựng lại từ đầu (`key` là user id) ở `#/`, không hiện dữ liệu hay trang của người trước. Giữ được form là nhờ `useAsync`: lần tải lại sau một lần ghi hỏng cũng hỏng (401, mất mạng), nên tải lại thất bại thì **giữ dữ liệu cũ** và hiện "This page could not be refreshed…" thay vì thay cả trang bằng lỗi. Request bị 401 trong khi supabase-js vẫn tưởng còn phiên (phiên bị thu hồi trên server) → `expireSession()` xóa phiên ở máy để hộp đăng nhập hiện ra.
- Ghi lỗi mạng (`ConnectionError`): **không** có nút thử lại (#44). Form giữ nguyên nội dung, trang tải lại danh sách như mọi lần ghi, câu báo nói rõ có thể đã lưu. Nếu sau này thêm thử lại thì phải dùng lại đúng id cũ (xem mục trên).
- `CLIENT_VERSION` ở `data/clientVersion.ts`, đọc `app_config` lúc đăng nhập và mỗi khi `visibilitychange` sang visible (lỗi lúc này bỏ qua: thao tác kế tiếp sẽ báo). Thấp hơn → thay cả app bằng "A new version is available. Reloading…" rồi reload. Đã tự reload vì lý do này trong 5 phút gần nhất (`sessionStorage`) thì không tự reload nữa mà hiện nút Reload, tránh vòng lặp khi đặt `min_client_version` trước lúc bản mới lên Pages.
- Nút **Sign out** ở header (`scope: 'local'`: chỉ máy này): gỡ app ngay và về `#/`, cả khi không báo được cho server (supabase-js vẫn xóa phiên ở máy; refresh token còn hiệu lực trên server đến khi hết hạn).
- Dexie: `VocabDb` version 3 (giữ index) và `main.tsx` gọi `db.open()` ngay, để tab cũ còn chạy bản local nhận `versionchange` và reload sang bản cloud. Vì vậy v3 chỉ được phát hành cùng lúc với bản cloud: bước 5 **chưa push**, push cùng bước 6 (#45).

## Chuyển dữ liệu local lên cloud (#33)
Chỉ máy tính có dữ liệu (iPhone chưa dùng), nên chỉ chuyển một chiều, một lần, không gộp.
1. Làm sớm phần lõi của giai đoạn 5: `exportBackup()` của repository đọc hết dữ liệu trong một transaction ra đúng định dạng backup `schemaVersion: 1`; `validateBackup()` ở `domain/backup.ts` (Zod, tham chiếu, trùng `toKey`); nút **Export JSON** ở Home.
2. Màn chuyển dữ liệu: tải JSON về trước (bản sao an toàn độc lập với Supabase) → gọi RPC `import_snapshot(payload)`: một transaction, **từ chối nếu tài khoản đã có dữ liệu** ("Cloud already has data"), nên bấm hai lần không nhân đôi. "Replace all" của giai đoạn 5 cần RPC riêng xóa và nhập trong một transaction (#38). Chỉ chạy khi chưa dùng cloud ở máy khác: khóa advisory chặn hai lần nhập đồng thời, không chặn lệnh ghi thường.
3. Bản cloud vẫn mở `VocabDb` ở **version 3** (giữ nguyên index) lúc khởi động, để tab cũ còn chạy bản local nhận `versionchange` và reload. Nếu không, tab đó vẫn ghi vào IndexedDB, báo "đã lưu" nhưng từ không bao giờ lên cloud.
4. Không tự xóa IndexedDB; ghi `meta.migratedAt`, hiện "Local data was uploaded on …" kèm nút xóa thủ công sau khi người dùng đã kiểm tra trên cloud.

## Client cũ ghi đè cột mới (#34)
Cùng loại lỗi với #32. Không có `versionchange` cho Supabase, nên:
- **Không dùng service worker** (#36): bản cũ không bị cache lâu trên iPhone. GitHub Pages chỉ cache khoảng 10 phút.
- Insert/update luôn liệt kê **đủ mọi cột** client biết; trường bị xóa gửi `null` tường minh. Không upsert cả dòng. Cột mới phải nullable hoặc có default.
- Bảng `app_config(min_client_version int)`. Client có hằng số `CLIENT_VERSION`, đọc bảng lúc khởi động và mỗi khi `visibilitychange` sang visible; thấp hơn thì hiện "A new version is available. Reloading…" rồi reload.
- Chỉ khi đổi cấu trúc kiểu phá vỡ (đổi enum, đổi `toKey`, cột bắt buộc mới) mới thêm trigger kiểm tra header `x-client-version` (đặt trong `global.headers` của supabase-js) và từ chối ghi.

## Test (#37)
- Test mapper và chuyển lỗi: unit test, chạy trong CI.
- Bộ test hợp đồng `src/data/repositoryContract.ts`: CI chạy trên Dexie; `npm run test:supabase` chạy pgTAP rồi chạy bộ này trên Supabase local (`VOCAB_SUPABASE_TESTS=1`, đăng nhập bằng người dùng của `seed.sql`, mỗi test xóa sạch dữ liệu của người đó). Chạy tay trước mỗi lần deploy có đổi SQL hoặc `SupabaseRepository`. Không có Supabase thì phần này bị skip.
- Dịch lỗi (`ConnectionError`, 401, dòng hỏng, chạm `max_rows`) test bằng `fetch` giả, chạy trong CI.
- Test RLS, quyền, ràng buộc và RPC nằm ở pgTAP (`supabase/tests/database/`).

## Cấu hình & vận hành
- Project: ref `rmbssnyoamugirqzdsef`, region `ap-southeast-1` (Singapore), gói Free. Đã tắt đăng ký mới và anonymous sign-in (kiểm tra qua `/auth/v1/settings`: `disable_signup: true`), có một user tạo từ dashboard.
- Lúc tạo project đã **bỏ** "Automatically expose new tables" và **bật** "automatic RLS": migration phải `GRANT` quyền tường minh cho `authenticated` (không cấp cho `anon`) và vẫn tự `enable row level security` cho từng bảng, vì Supabase CLI local không có hai cấu hình này của dashboard.
- CSP: thêm `https://<ref>.supabase.co` vào `connect-src`; không thêm `wss:` vì không dùng realtime.
- URL và khóa publishable đưa vào build qua biến của GitHub Actions (không phải secret, nhưng để ngoài code cho dễ đổi).
- Khi `supabase link`: kiểm tra `max_rows` của project cloud (Settings → API) đúng bằng `MAX_ROWS = 1000` trong `supabaseRepository.ts`. Thấp hơn thì lớp chặn "chạm giới hạn thì báo lỗi" không còn tác dụng mà không báo gì.
- **Cần kiểm tra lại khi làm:** gói miễn phí có còn tự tạm dừng project không truy cập 7 ngày không, và có cho tải backup về không. Nếu dùng GitHub Actions chạy định kỳ để giữ project: repo public không có commit 60 ngày thì GitHub tắt workflow theo lịch, và workflow phải query thật vào DB. Phương án dự phòng: khôi phục thủ công trên dashboard, ghi trong README.
- Xóa dây chuyền trên cloud không hoàn tác được; giai đoạn 5 vẫn cần Export JSON định kỳ.

## iPhone
- Chỉ manifest + icon (không service worker, #36): cài qua Safari → Chia sẻ → *Thêm vào MH chính*. Cần thử trên máy thật. App trên màn hình chính có bộ nhớ riêng nên đăng nhập lại một lần.
- Kiểm tra trên Safari iOS: bàn phím che ô nhập, safe area (tai thỏ), kích thước chạm.

## Thứ tự làm
1. Export JSON trên bản local (`exportBackup`, `validateBackup`, nút Export), chưa cần Supabase.
2. Người dùng tạo tài khoản + project Supabase; cài Docker + Supabase CLI.
3. SQL: bảng, ràng buộc, RLS, `app_config`, `import_snapshot`.
4. Mapper + `SupabaseRepository` + bộ test hợp đồng dùng chung.
5. Đăng nhập, kiểm tra `min_client_version`, Dexie v3 (commit ở máy, chưa push, #45).
6. Màn chuyển dữ liệu (lỗi validate hiện vài lỗi đầu kèm đường dẫn trong `fieldErrors`, không nối hết thành một câu dài); CSP, biến build, deploy; chuyển dữ liệu thật.
7. Manifest, thử trên iPhone; quyết định giữ project hoạt động.
