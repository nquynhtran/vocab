# Bài học (lỗi của Claude, không lặp lại)

> Nạp tự động mỗi phiên. Chỉ ghi lỗi thật sự do Claude gây ra. Mỗi mục 1–2 dòng: **lỗi → cách tránh**. Trùng bài học cũ thì đánh dấu `(lặp lại ×n)` thay vì thêm dòng mới.

## Test
- Viết test không thể đỏ: schema có `.transform` thì `parse` luôn qua, nên "parse được" không chứng minh gì → so `parse(x)` với chính `x`; với test quan trọng, phá code thử xem test có đỏ không. (lặp lại ×7: giai đoạn 5: test `pg_locks` "cùng key với import_snapshot" vẫn xanh khi bỏ hẳn lệnh khóa vì hàm được gọi cũng lấy key đó → tên test chỉ hứa đúng điều nó kiểm được; streak: test "đổi giờ mùa hè" trong bộ chỉ chạy ở múi giờ không đổi giờ; test pgTAP "folder của B không chứa từ của A" mà folder rỗng và khóa ngoại đã chặn sẵn; màn Learn: "bấm hai lần" mà nút đã bị khóa, "phím trong hộp đăng nhập" lúc câu hỏi đã khóa, "giữ focus" bằng `fireEvent.click` vốn không chuyển focus; 3b: "nhãn giọng không lan sang dòng cùng cấp" với dữ liệu mà có lan hay không cũng ra cùng đáp án; "không cảnh báo" kiểm bằng chữ cũng nằm trong hộp cảnh báo → chọn dữ liệu sao cho code sai cho kết quả khác)
- Bỏ sót test cho lớp phòng thủ (unique index, kiểm tra cha khi đổi tên; khóa ngoại kèm `user_id` mới test ở một bảng) vì lớp trước đã chặn → mỗi lớp chặn phải có test riêng đánh thẳng vào nó, ở mọi bảng. (lặp lại ×3: xóa bản lưu khi học xong bị `resumeSession` trả `undefined` che mất; khi phá thử, phá theo mọi cách, không chỉ một)
- Test quyền theo danh sách object cố định → object do migration sau thêm không được kiểm → duyệt mọi object trong schema.
- Test lời hứa "giữ chữ trong form khi mất phiên" bằng `FakeApp` tự viết → bỏ sót trang thật thay cả trang bằng `LoadError` khi tải lại hỏng → lời hứa về hành vi của UI phải test trên trang thật (`App` + repository), không chỉ trên bản giả của nó.
- Test chờ "thấy ô Note" rồi bắn `visibilitychange`, trong khi listener gắn trong `useEffect` chạy sau → CI chậm thì mất sự kiện, test lúc đỏ lúc xanh → chờ đúng điều kiện bước sau cần (`await act(async () => {})` để effect chạy xong), không chờ một dấu hiệu gần giống. (lặp lại ×3: đếm `mounts` ngay khi hộp đăng nhập biến mất; 3b: kiểm ô nháp ngay khi thấy "Unsaved draft restored.", trước khi effect chạy, nên code đồng bộ sai vẫn xanh; khi sửa một test kiểu này, rà luôn mọi test cùng mẫu trong file)
- Cùng một quy tắc có hai bản (`progressAfter` + SQL `record_answer`) mà nhánh "đúng, không lên hộp" chỉ test ở domain, bộ hợp đồng chỉ kiểm `studyDays` → 3 lỗi SQL vẫn xanh; test "một bậc mỗi ngày" bắt đầu ở hộp 4 nên trần hộp 5 che mất quy tắc → mỗi nhánh của quy tắc có hai bản phải có test trong bộ chạy cho cả hai, so cả bản ghi (`toStrictEqual`), và chọn dữ liệu đầu sao cho không giới hạn nào khác che kết quả.
- Viết helper test rối (`Object.create` để ghi đè method) → thêm tham số cho helper.

## UI
- Giữ kết quả tra cứu theo input (`{ key, locations }`) rồi dùng lại khi gõ lại đúng input đó → hiện dữ liệu cũ, thiếu bản ghi vừa thêm → bỏ kết quả mỗi khi input đổi; kết quả chỉ hợp lệ cho lần tra sau lần đổi cuối.

- Xóa `value` của ô chọn file sau khi đọc (để chọn lại cùng file vẫn nhận) → ô hiện "No file chosen" cạnh nút Import của file đó → xóa lúc mở hộp chọn (`onClick`), không phải sau khi đọc; sửa góp ý xong thì tự hình dung lại màn hình.

- Nghe phím ở `window` (phím 1–4) → `inert` của lớp phủ đăng nhập không chặn, gõ trong hộp Sign in chọn luôn đáp án bên dưới → listener toàn cục phải tự bỏ qua khi phần tử của nó nằm trong `[inert]` (và khi đang gõ trong ô nhập).

- Soát giao diện trên màn rộng chỉ chụp form thêm từ, không mở form sửa tại dòng, nên không thấy `.term` 4 cột trong media query ghi đè `.term--editing` → mỗi lần đổi form dùng chung, chụp mọi nơi dùng nó, ở cả hai cỡ màn hình; quy tắc thay đổi bố cục phải kiểm tra thứ tự với media query viết sau.

## Thư viện
- Đặt tên lỗi tự định nghĩa là `NotFoundError`: Dexie bọc lại lỗi có `name` trùng tên lỗi DOM của IndexedDB, nên `instanceof` hỏng → không dùng tên lỗi DOM (`NotFound`, `Constraint`, `Data`, `Abort`…) cho lỗi ném trong transaction.

- `escapeRegExp` thoát cả `-` trong regex có cờ `u` → `\-` là cú pháp sai, mọi từ có gạch nối làm vỡ màn Learn; test chỉ thử `C++` → regex dựng từ input người dùng: test với mọi loại ký tự người dùng thật sự gõ (gạch nối, `/`, nháy, dấu), và chỉ thoát đúng ký tự cú pháp.

- `jsonb_populate_recordset` lặng lẽ bỏ key lạ và cho `null` key thiếu → hàm nhận JSON phải tự kiểm tra đúng bộ key.

## Nhất quán
- Ghi `ConnectionError` là "không đọc hay lưu được gì" → sai với thao tác ghi: request có thể đã áp dụng, chỉ mất phản hồi, thử lại sẽ tạo bản trùng → với lỗi mạng của thao tác ghi, luôn xét trường hợp "đã ghi nhưng mất phản hồi". (lặp lại ×3: `DataAlreadyExistsError` báo "nothing was imported" trong khi lần nhập trước có thể đã thành công; `replaceAll` chỉ coi status 0 là lỗi mạng, sót trang lỗi HTML 502/504 của proxy đến sau khi đã commit → lỗi không có mã SQLSTATE cũng là "có thể đã ghi")
- Lưu kết quả của một hàm vào DB (`toKey` → `nameKey`) mà không ghi rằng đổi hàm thì phải migration tính lại → mỗi dữ liệu dẫn xuất được lưu phải ghi rõ nguồn và điều kiện tính lại.
- Code ngược mục tiêu chính mình ghi trong tài liệu (`localeCompare(undefined)` trong khi cam kết "mọi thiết bị cùng thứ tự"; `validateBackup` lặng lẽ chuẩn hóa ngay sau khi ghi #35 "khác là lỗi") → đọc lại lý do đã ghi trước khi chọn tham số. (lặp lại ×3: mapper ghi lý do "key có thể lệch chữ" nhưng bỏ cột key mà không kiểm)
- Chép lý do kỹ thuật của `challenger` vào code và `decisions.md` mà không tự suy lại (khóa advisory "để Import không lọt vào lúc kho vừa bị xóa", trong khi bản xóa chưa commit thì không ai thấy) → kết luận của agent đúng chưa chắc lý do đúng; tự suy lại cơ chế trước khi ghi.
- Viết tài liệu mô tả tính năng chưa làm như đã có (README nói có xuất JSON) → chỉ mô tả cái đã có, cái chưa có thì ghi "planned".

- Thêm trường mà không tăng version Dexie vì "dữ liệu cũ vẫn đọc được" → chỉ xét chiều đọc, quên code cũ ở tab khác ghi đè cả bản ghi làm mất trường mới → đổi cấu trúc là tăng version, xét cả chiều đọc lẫn chiều ghi.
- Test "tab cũ nhận versionchange" khai báo schema v1 thiếu bảng → Dexie tự nâng version nên test xanh cả khi thiếu code → bản giả của phiên bản cũ phải đúng y bản đã phát hành; phá code thử để chắc test đỏ được.

## Công cụ
- `a && b; git commit && git push`: `a` hỏng (sed sai dấu phân cách) thì `&&` chỉ bỏ qua tới `;`, commit/push vẫn chạy với nội dung thiếu → lệnh ghi ra ngoài (commit, push, deploy) chạy riêng, sau khi đã thấy bước trước thành công.
- Ghi lệnh kiểm tra `TZ=...` vào tài liệu mà cấu hình test ghi đè `TZ`, nên lệnh chạy vẫn xanh ở múi giờ cũ → trước khi ghi một lệnh kiểm tra vào tài liệu, chạy đúng lệnh đó và thấy nó đỏ được.
- Sửa rủi ro đăng xuất nhầm bằng cách chặn đúng một nơi gửi request (ô streak), trong khi nguyên nhân là `expireSession` không phân biệt 401 của phiên nào; mọi request đều gặp → trước khi vá, tìm nơi quyết định gây hại rồi hỏi còn đường nào khác đi tới đó. (lặp lại ×2: giai đoạn 5, lỗi 502 không mã chỉ sửa trong `replaceAll` trong khi `runRequest` dùng chung cho mọi thao tác ghi) Bản sửa gốc lần đầu lại coi mọi lỗi "không thử lại được" là hết phiên (429, trang lỗi proxy) → với thao tác gây hại, liệt kê đúng trường hợp được phép, không loại trừ.
- Sửa chỗ chậm mà chỉ đo đúng mẫu đã biết, báo "xử lý triệt để" → `reviewer` tìm ra mẫu khác (nhiều giá trị × nhiều nhãn) làm hết bộ nhớ → với dữ liệu không tin cậy, rà mọi vòng lặp lồng và bản sao mảng, không chỉ regex.
- Báo "xanh" và "vài mili giây" cho test tốc độ khi mới chạy một lần, chưa đo; giới hạn 500 ms sát với thời gian thật 350–460 ms nên test chập chờn → đo trước khi nói con số; test thời gian so tỉ lệ giữa hai kích thước trên cùng máy.
- Báo `db push` "chỉ thêm hai cột" khi migration còn nâng `min_client_version`, và thử chạy lên cloud thật bằng `yes |` mà chưa hỏi → trước lệnh ghi lên hệ thống thật, đọc lại toàn bộ migration, kể đủ tác động, hỏi người dùng, không tự trả lời câu xác nhận.
- Nâng `min_client_version` cùng lúc thêm cột, trước khi deploy → app đang chạy bị khóa nếu CI đỏ → với bước khó quay lại, hỏi "nếu bước sau hỏng thì sao" (#68).
- `pkill -f "<lệnh>"` khớp luôn dòng lệnh của chính shell đang chạy nó (exit 144), các lệnh sau trong cùng shell không chạy → dừng tiến trình nền bằng ID/PID, hoặc chạy `pkill` một mình. (lặp lại ×2: dọn worker vitest sau khi phá thử)
- Thêm `/// <reference types="node" />` vào một file test trong `src/` → mở kiểu Node cho cả project app (`tsconfig.app.json` cố ý chỉ có `vite/client`) → trước khi thêm kiểu hay cấu hình, xem nó áp dụng cho phạm vi nào; test cần Node thì để ngoài project app.
- Đưa mật khẩu test công khai vào `seed.sql` và chỉ cấm một lệnh (`db push --include-seed`), sót `db reset --linked` → với file nguy hiểm nếu chạy nhầm chỗ, cho chính file tự kiểm tra môi trường thay vì chỉ dựa vào tài liệu.
- Ghi `config.toml` của Supabase local theo tên tùy chọn mà không chạy thử luồng thật: `[auth.email] enable_signup = false` tắt luôn đăng nhập email, khác cloud → sau khi đổi cấu hình, thử đúng luồng sẽ dùng (đăng nhập thật, `/auth/v1/settings`).
- Vòng chờ CI lọc `head_sha` bằng SHA rút gọn → API không khớp, vòng lặp không bao giờ dừng → dùng SHA đầy đủ (`git rev-parse HEAD`) và cho vòng chờ thoát cả khi không tìm thấy kết quả hoặc quá thời gian.
- Thử app thật ngay sau `test:supabase` mà không dọn và nạp lại dữ liệu: bộ test đã xóa dữ liệu mẫu và để lại folder sai, nên ảnh chụp không kiểm tra được thứ cần xem → nạp dữ liệu mẫu ngay trước mỗi lần thử, và đọc lại con số trên ảnh trước khi kết luận.
- Phá code thử để kiểm tra test trên file chưa commit rồi khôi phục bằng `git checkout` → không có tác dụng với file chưa track → chép file ra scratchpad trước khi phá, hoặc commit trước. (lặp lại ×2: file đã track nhưng có sửa chưa commit, `git checkout` xóa luôn phần sửa thật)
- Deploy giai đoạn 3: `db push` khi mới chạy `npm run check` (59 test cloud bị bỏ qua, CI cũng không chạy pgTAP), dựa vào lần chạy xanh từ mấy commit trước → trước mọi `db push`, chạy `npm run test:supabase` trên đúng commit sẽ deploy.
