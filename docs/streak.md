# Streak

Đã qua `challenger` (2026-11-05), quyết định #71–#74.

## Quy tắc tính
- Một ngày là "đã học" khi `answeredCount ≥ STREAK_MIN_ANSWERS` (= 10), cộng dồn mọi phiên, mọi file trong ngày. Tính mọi câu đã ghi, đúng hay sai đều được. Mục đích: không giữ streak bằng cách trả lời 1 câu cho có.
- Ngày theo **giờ địa phương**, lưu `YYYY-MM-DD`. Tính bằng `localDay(now)` (domain, dùng chung với Learn), từng câu theo lúc trả lời: phiên qua nửa đêm thì câu sau nửa đêm thuộc ngày mới. Đổi múi giờ hay đồng hồ máy sai: chấp nhận, theo đồng hồ máy. Mọi hàm tính ngày nhận `today` làm tham số (không gọi `new Date()` bên trong), để test được.
- **Streak hiện tại:** đếm lùi các ngày liên tiếp đã học, bắt đầu từ hôm nay; nếu hôm nay chưa đạt thì bắt đầu từ hôm qua, để streak không "mất" từ sáng sớm.
- **Kỷ lục:** chuỗi dài nhất từng có. Luôn tính lại từ `study_days`, không lưu riêng, nên đổi `STREAK_MIN_ANSWERS` (#8) thì cả lịch sử tính lại theo ngưỡng mới, không cần migration. Luôn có `kỷ lục ≥ streak hiện tại`.
- **Ngày sau `today`** (máy khác lệch múi giờ, đồng hồ sai): bỏ qua khi tính streak, kỷ lục và lịch, không sửa hay xóa dữ liệu. Tới đúng ngày thì dòng đó tự được tính (#72).
- **Xóa từ, file, folder không đổi streak:** `study_days` không gắn với từ nào.
- Hàm thuần ở `domain/streak/`, chỉ làm việc với chuỗi `YYYY-MM-DD` và số năm, tháng; cộng ngày bằng `addDays` trong `domain/day.ts`, tính trên nửa đêm UTC như `daysBetween`. Không dùng `toISOString()` hay `getDay()` trên `Date` theo giờ máy: dễ lệch một ngày tùy múi giờ.

## Hiển thị (Home, #71)
Đặt trên danh sách folder, chữ giao diện như sau:
- Dòng streak: `🔥 5-day streak · Best 12`. Streak 0: `Start a streak today`, có kỷ lục thì thêm `· Best 12`.
- Dòng hôm nay: chưa đạt `Today: 4/10 answers`, đạt rồi `Today: 12 answers ✓`.
- **Lịch tháng** thu gọn sẵn (`<details>`, như Notes), bấm mới mở. Tuần bắt đầu từ **thứ Hai**. Nút `‹ ›` xem tháng khác, lùi không giới hạn, không đi quá tháng hiện tại; tháng hiển thị không lưu lại, mở lại trang về tháng hiện tại.
- Lịch chỉ đánh dấu ngày **đủ 10 câu**, tức ngày được tính vào streak. Ngày dưới 10 câu không đánh dấu. Ngày đã học không chỉ phân biệt bằng màu: có chữ cho trình đọc màn hình. Ô lịch không bấm được nên không cần cao 44px; 7 cột phải vừa màn 375px. Màu chỉ dùng biến `--color-*`.

## Đọc dữ liệu và làm mới (#73)
- `listStudyDays()` ở interface riêng trong `Repository`, Supabase đọc qua RPC `list_study_days()` trả `jsonb`, validate từng dòng bằng `StudyDaySchema` (#35). **Không** dùng select thường: mỗi ngày học thêm một dòng và không xóa được, nên sau khoảng 2,7 năm sẽ chạm giới hạn 1000 dòng (#39), ô streak hỏng hẳn.
- Hàm tải trả `{ summary, today }`: `today` lấy ngay sau khi có dữ liệu, để số và ngày luôn cùng một thời điểm. Không gọi `new Date()` lúc render.
- Tải lại khi: vào Home (rời Learn về là có), trang hiện lại (`visibilitychange`), cửa sổ được chọn lại (`focus`, vì hai cửa sổ cạnh nhau không có `visibilitychange`), và sau khi nhập backup. Tạo hay đổi tên folder không tải lại streak.
- Không đặt hẹn giờ nửa đêm (YAGNI): Home mở liên tục qua nửa đêm thì số cũ tới lần quay lại trang sau. Chấp nhận.
- Hai trường hợp số cũ khác cũng chấp nhận, vì hiếm và tự đúng lại ở lần quay lại trang sau: đăng nhập lại sau khi hết phiên (app giữ nguyên, không tải lại); về Home đúng lúc câu trả lời vừa rồi đang lưu.
- Đã thử trên iPhone thật (2026-11-06): quay lại app thì số tự cập nhật.

## Lỗi không được làm hỏng Home (#73)
- Tải streak **độc lập** với danh sách folder (hai `useAsync` riêng, không `Promise.all`): một dòng `study_days` hỏng hay mất mạng thì folder và các nút vẫn dùng được.
- Lỗi của ô streak chỉ hiện một dòng nhỏ, **không** `role="alert"`: người dùng không bấm gì, và mất mạng thì không báo lỗi lặp hai lần. Lần tải đầu hỏng: "Streak could not be loaded."; tải lại hỏng: giữ số cũ, kèm "Streak may be out of date.". Riêng dữ liệu đã lưu bị hỏng (`InvalidStoredDataError`) thì thêm câu báo chỗ hỏng và cách sửa, vì không chỗ nào khác trên trang cho biết.

## Test bắt buộc
- **Tính streak:** chưa học ngày nào · chỉ học hôm nay · học hôm qua chưa học hôm nay · bỏ một ngày · chuỗi qua cuối tháng / cuối năm / 29-2 · biên 9 và 10 câu · `answeredCount` 0 · hôm nay đạt, hôm qua không · hôm nay có 4 câu, chuỗi vẫn giữ · hôm qua chỉ 9 câu, hôm nay chưa học → 0 · đầu vào không sắp xếp · ngày tương lai, kể cả chỉ có ngày tương lai · kỷ lục lớn hơn và bằng chuỗi hiện tại.
- **Lịch:** tháng có 4, 5, 6 hàng · tháng bắt đầu vào thứ Hai và Chủ nhật · tháng 2 năm nhuận · không đi quá tháng hiện tại.
- **Múi giờ:** bộ test chạy ở giờ Việt Nam (`vite.config.ts`); `npm run check` (cả CI) chạy thêm test ngày và streak ở `America/New_York` (`npm run test:zone`), múi giờ phía tây UTC và có đổi giờ mùa hè. Không chạy cả `src/domain`: vài test Learn ghi dữ liệu cố định theo giờ Việt Nam. Đặt biến `TZ` trực tiếp không có tác dụng vì cấu hình ghi đè nó.
- **Repository:** bộ hợp đồng đọc 1001 dòng trên cả hai kho, dòng hỏng báo lỗi; pgTAP: người dùng B không thấy ngày của A.
- **UI trên `App` thật:** `Today` đúng số của hôm nay, không lấy nhầm dòng gần nhất · `listStudyDays` hỏng thì folder vẫn hiện · nhập backup xong ô đổi số · quay lại trang thì số mới.

## Deploy
Không đổi bảng hay cột, nên không cần Dexie version mới, `schemaVersion` hay nâng `min_client_version`; client cũ không gọi RPC mới. Thứ tự: `npm run test:supabase` trên đúng commit sẽ deploy → `db push --dry-run` → `db push` → push code. Làm ngược lại thì ô streak báo lỗi tới khi `db push`.

## Khôi phục backup (#74, đã chốt #76–#77)
Khôi phục ghi đè cả ngày học theo file; màn so sánh nêu số ngày sẽ mất. Kho còn ngày học mà không có folder vẫn khôi phục được vì Home chỉ còn một mục "Restore from backup". Chi tiết: [backup.md](backup.md).
