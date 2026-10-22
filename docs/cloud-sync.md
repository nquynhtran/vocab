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
- Migration đầu: `supabase/migrations/20261022121518_initial_schema.sql`. Test pgTAP: `supabase/tests/database/`, chạy `npx supabase start` rồi `npm run test:supabase`. Test giả lập người dùng bằng `set local role authenticated` + `request.jwt.claims`, không cần khóa nào.
- **Khóa ngoại gồm `user_id`** (`(user_id, folder_id) → folders(user_id, id)`): Postgres kiểm tra khóa ngoại không qua RLS, khóa đơn sẽ cho gắn dòng vào folder của người khác.
- Thu hồi rồi cấp quyền tường minh (bảng và `EXECUTE` của hàm), vì Supabase local mặc định cấp hết cho `anon`/`PUBLIC`. `authenticated` không có `TRUNCATE` (bỏ qua RLS). **Mỗi migration mới** tạo bảng/hàm cũng phải revoke/grant như vậy; test duyệt mọi object trong `public` sẽ đỏ nếu quên.
- Tên constraint là hợp đồng với client: `folders_name_key_unique`, `files_name_key_unique` → `DuplicateNameError`.
- CHECK chỉ là lưới an toàn (độ dài đếm theo ký tự, `box`, số ≥ 0, `part_of_speech`). Danh sách `part_of_speech` lặp lại `PARTS_OF_SPEECH`: đổi danh sách phải thêm migration SQL; bộ test hợp đồng (bước 4) tạo từ với mọi giá trị để bắt lệch.
- `import_snapshot(payload)`: payload gồm đủ 5 mảng `folders, files, terms, progress, study_days`, mỗi phần tử là dòng snake_case có **đúng đủ** các cột (trống thì `null`), gồm `name_key`/`word_key` do client tính, không có `user_id`. Lỗi: `VC001` "Cloud already has data", `22023` thiếu mảng hoặc sai bộ key (`jsonb_populate_recordset` lặng lẽ bỏ key lạ, nên phải tự kiểm tra). Khóa advisory theo user để hai lần nhập đồng thời không cùng lọt.
- `export_backup()`: một câu SQL (một snapshot), trả `{ folders, files, terms, progress, study_days }` gồm cả `user_id`, `name_key`, `null`; mapper bỏ đi, client tự thêm `schemaVersion`, `exportedAt`.
- `app_config`: đúng một dòng, `min_client_version = 1`; chỉ `authenticated` đọc được, nên client kiểm tra version **sau khi đăng nhập** (chưa đăng nhập thì `anon` bị từ chối, không phải lỗi mạng).
- Chưa có: RPC `record_answer` (giai đoạn 3, migration mới); bảng `meta` (`migratedAt` chỉ ở local; `lastBackupAt` tính ở giai đoạn 5).
- `supabase/config.toml` (chỉ cho local): tắt đăng ký như cloud; tắt realtime, storage, edge functions, analytics cho nhẹ.

## Khác biệt so với Dexie (phải có trong test hợp đồng)
PostgREST mỗi request là một transaction riêng, nên không "kiểm tra rồi ghi" trong cùng transaction được:
- Lớp chặn chính là ràng buộc DB. Lỗi `23505` (unique) theo tên constraint → `DuplicateNameError`; `23503` (khóa ngoại) → `EntityNotFoundError`. Trên cloud đây là chuyện bình thường (hai máy cùng ghi), không phải bug như `ConstraintError` của Dexie.
- Update/delete luôn kèm `.select()` để đếm số dòng: update 0 dòng → `EntityNotFoundError`; delete 0 dòng → no-op như Dexie.
- Đọc cần một snapshot (`getFolderContents`, `findTermsByWord`, `exportBackup`) → một request embed hoặc một view/RPC, không ghép nhiều request; riêng `exportBackup` là một RPC đọc mọi bảng trong một transaction, để backup không trộn trạng thái trước và sau một lần ghi từ máy khác.
- Thao tác nhiều bảng (`recordAnswer`, nhập snapshot) là hàm Postgres gọi qua RPC, `SECURITY INVOKER` để RLS vẫn áp dụng; `user_id` lấy từ `auth.uid()` trong hàm, không lấy từ payload.
- Lỗi mạng và phiên hết hạn (401) có lớp lỗi riêng; UI báo lỗi và giữ nguyên nội dung form đang gõ.
- PostgREST cắt ngầm SELECT ở `max_rows` = 1000 dòng: đọc danh sách (`listTerms`, `findTermsByWord`) phải phân trang hoặc báo lỗi khi chạm giới hạn, có test hợp đồng. `export_backup` không bị vì trả một giá trị jsonb.
- Chuỗi Zod nhận nhưng Postgres từ chối: ký tự `\u0000` (lỗi `22P05`) và surrogate UTF-16 lẻ (JSON không hợp lệ). Bước 4 quyết định: chặn ở schema domain hay chuyển lỗi thành thông báo rõ.

## Validate dữ liệu tải về (#35)
Dữ liệu từ cloud là dữ liệu từ biên: **validate khi đọc**, ngoại lệ của #24. Không tin vào CHECK của Postgres. Mapper riêng (có test), theo thứ tự:
1. snake_case → camelCase, bỏ `user_id`, `name_key`, `word_key`;
2. `null` → bỏ trường (schema chỉ nhận `undefined` cho trường không bắt buộc);
3. thời gian: `new Date(x).toISOString()`. PostgREST trả `+00:00` và số chữ số thập phân thay đổi, còn `z.iso.datetime()` chỉ nhận `Z`; không nới schema vì sắp xếp `newestFirst` so chuỗi;
4. parse bằng schema domain (`TermSchema`...) và so kết quả với đầu vào: khác nhau (ví dụ dòng sửa tay chưa chuẩn hóa) là lỗi, không lặng lẽ sửa.

Một dòng hỏng → cả thao tác báo lỗi rõ ràng (fail fast), không bỏ qua dòng.

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
- Bộ test hợp đồng (hiện ở test của `DexieRepository`) tách thành bộ dùng chung nhận factory. CI chạy trên Dexie; `npm run test:supabase` chạy tay trên Supabase CLI local (Docker) trước mỗi lần deploy có đổi SQL. Test RLS, quyền, ràng buộc và RPC nằm ở pgTAP (`supabase/tests/database/`), cũng chạy bằng `npm run test:supabase`.

## Cấu hình & vận hành
- Project: ref `rmbssnyoamugirqzdsef`, region `ap-southeast-1` (Singapore), gói Free. Đã tắt đăng ký mới và anonymous sign-in (kiểm tra qua `/auth/v1/settings`: `disable_signup: true`), có một user tạo từ dashboard.
- Lúc tạo project đã **bỏ** "Automatically expose new tables" và **bật** "automatic RLS": migration phải `GRANT` quyền tường minh cho `authenticated` (không cấp cho `anon`) và vẫn tự `enable row level security` cho từng bảng, vì Supabase CLI local không có hai cấu hình này của dashboard.
- CSP: thêm `https://<ref>.supabase.co` vào `connect-src`; không thêm `wss:` vì không dùng realtime.
- URL và khóa publishable đưa vào build qua biến của GitHub Actions (không phải secret, nhưng để ngoài code cho dễ đổi).
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
5. Đăng nhập, kiểm tra `min_client_version`, Dexie v3.
6. Màn chuyển dữ liệu (lỗi validate hiện vài lỗi đầu kèm đường dẫn trong `fieldErrors`, không nối hết thành một câu dài); CSP, biến build, deploy; chuyển dữ liệu thật.
7. Manifest, thử trên iPhone; quyết định giữ project hoạt động.
