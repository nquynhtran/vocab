# Bài học (lỗi của Claude, không lặp lại)

> Nạp tự động mỗi phiên. Chỉ ghi lỗi thật sự do Claude gây ra. Mỗi mục 1–2 dòng: **lỗi → cách tránh**. Trùng bài học cũ thì đánh dấu `(lặp lại ×n)` thay vì thêm dòng mới.

## Test
- Viết test không thể đỏ: schema có `.transform` thì `parse` luôn qua, nên "parse được" không chứng minh gì → so `parse(x)` với chính `x`; với test quan trọng, phá code thử xem test có đỏ không. (lặp lại ×2: test pgTAP "folder của B không chứa từ của A" mà folder rỗng và khóa ngoại đã chặn sẵn)
- Bỏ sót test cho lớp phòng thủ (unique index, kiểm tra cha khi đổi tên; khóa ngoại kèm `user_id` mới test ở một bảng) vì lớp trước đã chặn → mỗi lớp chặn phải có test riêng đánh thẳng vào nó, ở mọi bảng. (lặp lại ×2)
- Test quyền theo danh sách object cố định → object do migration sau thêm không được kiểm → duyệt mọi object trong schema.
- Viết helper test rối (`Object.create` để ghi đè method) → thêm tham số cho helper.

## UI
- Giữ kết quả tra cứu theo input (`{ key, locations }`) rồi dùng lại khi gõ lại đúng input đó → hiện dữ liệu cũ, thiếu bản ghi vừa thêm → bỏ kết quả mỗi khi input đổi; kết quả chỉ hợp lệ cho lần tra sau lần đổi cuối.

## Thư viện
- Đặt tên lỗi tự định nghĩa là `NotFoundError`: Dexie bọc lại lỗi có `name` trùng tên lỗi DOM của IndexedDB, nên `instanceof` hỏng → không dùng tên lỗi DOM (`NotFound`, `Constraint`, `Data`, `Abort`…) cho lỗi ném trong transaction.

- `jsonb_populate_recordset` lặng lẽ bỏ key lạ và cho `null` key thiếu → hàm nhận JSON phải tự kiểm tra đúng bộ key.

## Nhất quán
- Lưu kết quả của một hàm vào DB (`toKey` → `nameKey`) mà không ghi rằng đổi hàm thì phải migration tính lại → mỗi dữ liệu dẫn xuất được lưu phải ghi rõ nguồn và điều kiện tính lại.
- Code ngược mục tiêu chính mình ghi trong tài liệu (`localeCompare(undefined)` trong khi cam kết "mọi thiết bị cùng thứ tự"; `validateBackup` lặng lẽ chuẩn hóa ngay sau khi ghi #35 "khác là lỗi") → đọc lại lý do đã ghi trước khi chọn tham số. (lặp lại ×3: mapper ghi lý do "key có thể lệch chữ" nhưng bỏ cột key mà không kiểm)
- Viết tài liệu mô tả tính năng chưa làm như đã có (README nói có xuất JSON) → chỉ mô tả cái đã có, cái chưa có thì ghi "planned".

- Thêm trường mà không tăng version Dexie vì "dữ liệu cũ vẫn đọc được" → chỉ xét chiều đọc, quên code cũ ở tab khác ghi đè cả bản ghi làm mất trường mới → đổi cấu trúc là tăng version, xét cả chiều đọc lẫn chiều ghi.
- Test "tab cũ nhận versionchange" khai báo schema v1 thiếu bảng → Dexie tự nâng version nên test xanh cả khi thiếu code → bản giả của phiên bản cũ phải đúng y bản đã phát hành; phá code thử để chắc test đỏ được.

## Công cụ
- Đưa mật khẩu test công khai vào `seed.sql` và chỉ cấm một lệnh (`db push --include-seed`), sót `db reset --linked` → với file nguy hiểm nếu chạy nhầm chỗ, cho chính file tự kiểm tra môi trường thay vì chỉ dựa vào tài liệu.
- Ghi `config.toml` của Supabase local theo tên tùy chọn mà không chạy thử luồng thật: `[auth.email] enable_signup = false` tắt luôn đăng nhập email, khác cloud → sau khi đổi cấu hình, thử đúng luồng sẽ dùng (đăng nhập thật, `/auth/v1/settings`).
- Vòng chờ CI lọc `head_sha` bằng SHA rút gọn → API không khớp, vòng lặp không bao giờ dừng → dùng SHA đầy đủ (`git rev-parse HEAD`) và cho vòng chờ thoát cả khi không tìm thấy kết quả hoặc quá thời gian.
- Phá code thử để kiểm tra test trên file chưa commit rồi khôi phục bằng `git checkout` → không có tác dụng với file chưa track → chép file ra scratchpad trước khi phá, hoặc commit trước.
