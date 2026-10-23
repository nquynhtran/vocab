# Nhật ký quyết định

Mỗi dòng: ngày · quyết định · lý do ngắn. Đổi quyết định cũ thì thêm dòng mới ghi "thay cho #n", không xóa dòng cũ.

| # | Ngày | Quyết định | Lý do |
|---|------|-----------|-------|
| 1 | 2026-10-22 | Chỉ có chế độ Learn, hiển thị từ dạng list | Người dùng chỉ cần vậy |
| 2 | 2026-10-22 | Chỉ hỏi chiều Nghĩa → Từ tiếng Anh | Theo yêu cầu, chiều ngược lại để sau |
| 3 | 2026-10-22 | Web tĩnh trên GitHub Pages, repo public | Miễn phí, không cần mở VS Code để học; người dùng đã có tài khoản GitHub |
| 4 | 2026-10-22 | Giai đoạn 0–6 lưu IndexedDB, chưa đăng nhập | Có app dùng được sớm, ít thứ phải cài |
| 5 | 2026-10-22 | Giai đoạn 7 thêm đăng nhập + Supabase | Người dùng thêm từ trên cả máy tính và iPhone, cần chung dữ liệu |
| 6 | 2026-10-22 | Ưu tiên máy tính, iPhone ở giai đoạn 7, CSS responsive từ đầu | Người dùng dùng iPhone, chấp nhận làm sau |
| 7 | 2026-10-22 | Thuật toán: mức kiểu Quizlet + ưu tiên kiểu Leitner | Đơn giản, đủ dùng; có thể đổi sang FSRS |
| 8 | 2026-10-22 | Streak cần ≥ 10 câu/ngày | Tránh giữ streak cho có; đổi được qua hằng số |
| 9 | 2026-10-22 | Chưa tạo subagent riêng; dùng skill `/save-progress` và `/code-review` có sẵn | Dự án nhỏ, subagent khởi động lại từ đầu tốn token hơn lợi ích |
| 10 | 2026-10-22 | Mức 0/1/2 chỉ tồn tại trong phiên; DB chỉ lưu `box`. `box` tăng tối đa 1 lần/phiên. Thay một phần cho #7 | Thiết kế cũ lưu mức vào DB: học xong một lần thì phiên sau kết thúc ngay; và `box` tăng vọt trong một phiên làm mất ý nghĩa Leitner |
| 11 | 2026-10-22 | Ghi kết quả câu sai/câu viết khi bấm Tiếp tục | "Tôi đã đúng" không phải hoàn tác dữ liệu đã lưu |
| 12 | 2026-10-22 | Đã thuộc = `box ≥ 3` | Cần định nghĩa rõ cho "% đã thuộc" |
| 13 | 2026-10-22 | Làm trực tiếp trên `main` (trunk-based) | Một người làm, PR không mang lại thêm giá trị |
| 14 | 2026-10-22 | Thêm agent `reviewer` (sau mỗi mục có code) và `challenger` (trước mỗi giai đoạn). Bỏ `/code-review` khỏi quy trình. Thay cho #9 | Người dùng yêu cầu; lần soát thiết kế thủ công đã tìm ra lỗi nghiêm trọng, chứng tỏ một góc nhìn mới có giá trị. Chỉ gọi ở mốc cố định để hạn chế token |
| 15 | 2026-10-22 | Chưa tạo agent `tester`; tự viết test cùng code. Xem lại ở giai đoạn 3 | Test viết cùng lúc với code thì rẻ hơn; `reviewer` đã kiểm tra độ phủ test |
| 16 | 2026-10-22 | Gọi agent theo đánh giá lợi ích/chi phí, không theo mốc cứng. Thay một phần cho #14 | Người dùng muốn Claude tự biết dùng công cụ gì lúc nào; việc nhỏ không đáng tốn token cho agent |
| 17 | 2026-10-22 | Chữ giao diện toàn bộ bằng tiếng Anh, không làm i18n | Người dùng chọn; tài liệu vẫn tiếng Việt |
| 18 | 2026-10-22 | Dùng oxlint thay ESLint | Template Vite hiện tại mặc định oxlint; nhanh hơn, có sẵn luật React hooks, không cần cấu hình |
| 19 | 2026-10-22 | Bật `noUncheckedIndexedAccess` trong TypeScript | Bắt kiểm tra khi lấy phần tử mảng (chọn từ, đáp án nhiễu), tránh lỗi `undefined` |
| 20 | 2026-10-22 | Push qua SSH key có sẵn, không cài `gh` | Máy đã có SSH key kết nối GitHub; bớt một công cụ |
| 21 | 2026-10-22 | `nameKey`/`wordKey` không có trong kiểu domain, chỉ có trong bản ghi DB; giai đoạn 7 lưu cột key do client tính | Key là chi tiết lưu trữ; một hàm `toKey` duy nhất để local và cloud hiểu "trùng" giống nhau |
| 22 | 2026-10-22 | Tên IndexedDB là `vocab-app`, cố định | Origin GitHub Pages dùng chung cho mọi repo của tài khoản |
| 23 | 2026-10-22 | `versionchange` → `close({ disableAutoOpen: true })` | Mặc định Dexie tự mở lại, tab cũ sẽ ghi dữ liệu sai cấu trúc vào DB mới |
| 24 | 2026-10-22 | Validate khi ghi, không validate lại khi đọc từ DB; có test bảo đảm bản ghi repository tạo ra parse được qua schema | Mọi lần ghi đều qua repository; dữ liệu cũ đi qua migration có test |
| 25 | 2026-10-22 | Cảnh báo từ trùng cả trong cùng file, không chỉ file khác; vẫn cho thêm | Người dùng chọn; trùng trong cùng file thường là nhập nhầm, nhưng từ nhiều nghĩa vẫn hợp lệ |
| 26 | 2026-10-22 | Xác nhận xóa bằng `window.confirm` | Người dùng chọn; đơn giản, iPhone hiện hộp thoại hệ thống |
| 27 | 2026-10-22 | Cảnh báo từ trùng hiện ngay khi gõ, không chặn nút Add | Thấy ngay trước khi gõ nghĩa; không thêm bước xác nhận |
| 28 | 2026-10-22 | Dùng `react-router` (v8) | Đã chọn `HashRouter` ở architecture.md; v8 gộp hết vào một gói |
| 29 | 2026-10-22 | Thêm `partOfSpeech` (danh sách cố định, không bắt buộc, một loại mỗi từ). Không thêm version Dexie | Người dùng yêu cầu. Danh sách giúp hiển thị đồng nhất. Trường không có index và không bắt buộc, nên dữ liệu cũ vẫn hợp lệ, không cần migration (có test đọc bản ghi cũ). Backup chưa phát hành nên `schemaVersion` vẫn là 1 |
| 30 | 2026-10-22 | Phát âm bằng Web Speech API (`speechSynthesis`), giọng en-GB, chỉ trong danh sách từ. Thay một phần cho mục "âm thanh" trong Không làm | Người dùng yêu cầu, chọn giọng Anh-Anh. Miễn phí, offline, không thư viện, không nới CSP, đọc được cả cụm từ; đổi lại giọng đọc tùy thiết bị |
| 31 | 2026-10-22 | Làm đồng bộ cloud (giai đoạn 7) ngay sau giai đoạn 2, trước Learn | Người dùng muốn dùng cả máy tính và iPhone ngay; làm sau thì phải viết `recordAnswer` hai lần và chuyển dữ liệu local lên cloud |
| 32 | 2026-10-22 | Thêm Dexie version 2 (giữ nguyên index). Thay cho phần "không thêm version Dexie" của #29 | `reviewer` chỉ ra: không tăng version thì tab còn chạy bản cũ không reload, và `updateTerm` cũ ghi đè cả bản ghi nên xóa mất `partOfSpeech`. #29 chỉ xét chiều đọc, bỏ sót chiều ghi |
| 33 | 2026-10-22 | Chuyển dữ liệu local lên cloud: làm sớm Export JSON (lõi giai đoạn 5) + RPC `import_snapshot` một transaction, từ chối khi cloud đã có dữ liệu; bản cloud mở Dexie v3 để tab cũ reload; không tự xóa IndexedDB | Người dùng chọn, theo `challenger`. Có bản sao an toàn trước khi chuyển; (Ý định dùng lại RPC cho "Replace all" đã bỏ, xem #38.) Chỉ máy tính có dữ liệu nên không cần gộp |
| 34 | 2026-10-22 | Chặn client cũ: ghi đủ mọi cột client biết (xóa thì gửi `null`), cột mới phải nullable/có default, bảng `app_config.min_client_version` để client cũ tự reload; trigger từ chối ghi chỉ thêm khi đổi cấu trúc kiểu phá vỡ | Người dùng chọn dạng nhẹ. Supabase không có `versionchange` như Dexie (#32); bắt mọi lệnh ghi qua RPC thì nặng, không đáng với một người dùng |
| 35 | 2026-10-22 | Dữ liệu đọc từ cloud được validate khi đọc (mapper → schema domain), một dòng hỏng thì báo lỗi cả thao tác. Ngoại lệ của #24 | Cloud là biên: có thể sửa tay trên dashboard, PostgREST trả `null` và giờ dạng `+00:00` khác domain |
| 36 | 2026-10-22 | PWA chỉ có manifest + icon, không service worker | App cần mạng; service worker giữ bản cũ lâu trên iPhone, làm hỏng cách chặn client cũ (#34) |
| 37 | 2026-10-22 | Test SQL (RLS, ràng buộc, RPC) bằng Supabase CLI local trên Docker, chạy tay `npm run test:supabase`; CI chỉ chạy bộ hợp đồng trên Dexie | Người dùng chọn cài Docker. Lỗi RLS hay RPC không lọt lên bản thật; không cần project thứ hai hay secret trong CI |
| 38 | 2026-10-22 | `import_snapshot` chỉ dùng cho lần chuyển dữ liệu đầu; "Replace all" (giai đoạn 5) có RPC riêng xóa + nhập trong một transaction. Payload phải có đúng đủ bộ cột của từng bảng | Theo `reviewer`: xóa bằng request riêng rồi mới nhập thì nhập lỗi sẽ mất dữ liệu, trái data-model "lỗi thì giữ nguyên". `jsonb_populate_recordset` bỏ qua key gõ sai, làm mất loại từ/ví dụ mà không báo |
| 39 | 2026-10-22 | Danh sách có thể vượt 1000 dòng (`listTerms`, `getFolderContents`) đọc qua RPC trả `jsonb`; các select khác (folder, file trong folder, từ trùng) chạm 1000 thì báo lỗi, không phân trang. Thêm `@supabase/supabase-js` | Thử thực tế: PostgREST cắt ở `max_rows` cả embed lồng nhau, folder 20 unit × 60 từ sẽ đếm sai mà không báo. Phân trang nhiều request không còn là một snapshot. RPC một câu SQL vừa là snapshot vừa không bị cắt |
| 40 | 2026-10-22 | Schema domain từ chối `\u0000` và surrogate UTF-16 lẻ ở mọi ô chữ | Zod nhận nhưng Postgres từ chối (`22P05`, JSON hỏng). Chặn ở domain thì local và cloud cùng hành vi, lỗi hiện cạnh ô nhập; không đổi `normalizeText`/`toKey` nên không cần tính lại key |
| 41 | 2026-10-22 | `exportBackup` của `SupabaseRepository` chỉ chuyển dạng (bước 1–3 của #35), không validate. Mọi lần đọc khác đều validate | Đúng hợp đồng của interface: bản sao an toàn phải tải được cả khi có dòng lệch; nhập lại mới validate. Ngoại lệ có chủ đích của #35 |
| 42 | 2026-10-23 | Hai máy cùng sửa một bản ghi: bản ghi sau thắng (last-write-wins), không khóa lạc quan theo `updated_at` | Một người dùng, hiếm khi sửa cùng một từ trên hai máy cùng lúc; khóa lạc quan thêm nhánh lỗi "đã bị sửa ở máy khác" cho mọi form. Xem lại nếu có nhiều người dùng chung dữ liệu |
| 43 | 2026-10-23 | Mất phiên (401) khi đang dùng: giữ app trên trang (`inert`) và phủ hộp đăng nhập lên trên; đăng nhập tài khoản khác thì dựng lại app. Kiểm tra `min_client_version` xong mới hiện app | Giữ nội dung form mà không phải lưu nháp ở đâu; không để dữ liệu người trước hiện cho người sau; code cũ không kịp ghi trước khi bị chặn |
| 44 | 2026-10-23 | Chưa có nút thử lại khi ghi gặp `ConnectionError`; người dùng xem danh sách vừa tải lại rồi tự bấm lại | YAGNI: muốn thử lại an toàn phải truyền id cũ qua interface `Repository`. Folder/file trùng đã có `DuplicateNameError` chặn |
| 45 | 2026-10-23 | Bước 5 commit ở máy, chưa push; push cùng bước 6 | Người dùng chọn. Push là deploy, mà bản cloud chưa dùng được khi chưa chuyển dữ liệu; Dexie v3 phải lên cùng bản cloud thì tab cũ mới reload (#33). Không thêm chế độ local tạm |
| 46 | 2026-10-23 | Chuyển dữ liệu lên cloud = **nhập file JSON** đã Export từ bản local, qua `Repository.importIntoEmpty` (cả Dexie lẫn Supabase, chỉ vào kho trống). Thay bước "bản cloud đọc thẳng IndexedDB" của #33; không có `meta.migratedAt`, không nút xóa bản local | Người dùng chọn, theo `challenger`. File đã chắc chắn nằm trên đĩa (tự tải sau `await` có thể bị chặn hay hủy mà app không biết); ít code; giai đoạn 5 dùng lại phần đọc/validate/báo lỗi file. IndexedDB để nguyên làm bản sao thứ hai. Không có nút "đánh dấu đã xong": cloud có dữ liệu không có nghĩa lần nhập của mình đã thành công |
