# Giai đoạn 7: Đăng nhập, cloud & iPhone

Chỉ đọc khi làm giai đoạn 7. **Làm ngay sau giai đoạn 2, trước Learn** (quyết định #31); giữ số 7 để không phải đổi các chỗ tham chiếu.

## Vấn đề
Không đăng nhập thì dữ liệu nằm riêng trong trình duyệt của từng máy: từ thêm trên máy tính không có trên iPhone và ngược lại. Ngoài ra, Safari trên iPhone tự xóa dữ liệu của trang web không mở trong 7 ngày.

## Giải pháp: Supabase (gói miễn phí, Postgres + Auth)
- Đăng nhập email + mật khẩu, một tài khoản duy nhất; tắt đăng ký sau khi tạo.
- **Row Level Security** trên mọi bảng: mỗi dòng có `user_id`, policy chỉ cho `auth.uid() = user_id`. Khóa `anon` được phép nằm trong frontend vì quyền do RLS kiểm soát. Không bao giờ đưa khóa `service_role` vào frontend hay repo.
- Ràng buộc ở [data-model.md](data-model.md) chuyển thành khóa ngoại, `ON DELETE CASCADE`, `UNIQUE`, `CHECK` trong Postgres.
- Trùng tên: lưu cột `name_key`/`word_key` do client tính bằng `toKey` của domain, `UNIQUE (user_id, name_key)`. **Không** dùng index trên biểu thức `lower(...)`: `lower()` và `\s` của Postgres khác JS, local và cloud sẽ hiểu "trùng" khác nhau. Sắp xếp cũng dùng `compareNames` của domain, không dựa vào `ORDER BY` theo collation.
- Thao tác nhiều bảng (`recordAnswer`, nhập backup) là hàm Postgres gọi qua RPC, chạy trong một transaction.
- `SupabaseRepository` cài đặt cùng interface với `DexieRepository` ([architecture.md](architecture.md#quy-tắc-repository)). UI và domain không đổi.
- Chuyển dữ liệu: kế hoạch cũ là xuất JSON từ bản local → nhập vào bản cloud, nhưng sao lưu (giai đoạn 5) giờ làm **sau** cloud. **Cần chốt khi làm:** cách đưa dữ liệu đang có trong IndexedDB của máy tính lên cloud (ví dụ làm sớm phần xuất/nhập, hoặc nút "Upload local data" một lần).
- Bảng `terms` có cột `part_of_speech` nullable, `CHECK` thuộc `PARTS_OF_SPEECH` (#29).
- App cần mạng; học offline không nằm trong phạm vi.
- **Cần kiểm tra lại khi làm:** gói miễn phí của Supabase (tính đến 2025) tự tạm dừng project không có truy cập trong 7 ngày. Dữ liệu không mất, nhưng phải vào trang quản trị bấm khôi phục. Nếu vẫn còn quy định này, cân nhắc một GitHub Actions chạy định kỳ gọi API để giữ project hoạt động.
- Dữ liệu trên cloud nên quy tắc xóa 7 ngày của Safari không còn ảnh hưởng.

## iPhone
- PWA (`vite-plugin-pwa`): cài qua Safari → Chia sẻ → *Thêm vào MH chính*.
- Kiểm tra trên Safari iOS: bàn phím che ô nhập, safe area (tai thỏ), kích thước chạm.
