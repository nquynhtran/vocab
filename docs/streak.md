# Streak

- Một ngày là "đã học" khi `answeredCount ≥ STREAK_MIN_ANSWERS` (= 10), cộng dồn mọi phiên, mọi file trong ngày. Tính mọi câu đã ghi, đúng hay sai đều được. Mục đích: không giữ streak bằng cách trả lời 1 câu cho có.
- Chưa đạt thì hiện "Today: 4/10 answers".
- Ngày theo **giờ địa phương**, lưu `YYYY-MM-DD`. Tính bằng `localDay(now)` (domain, dùng chung với Learn), từng câu theo lúc trả lời: phiên qua nửa đêm thì câu sau nửa đêm thuộc ngày mới. Đổi múi giờ hay đồng hồ máy sai: chấp nhận, theo đồng hồ máy. Mọi hàm tính ngày nhận `today` làm tham số (không gọi `new Date()` bên trong), để test được.
- **Streak hiện tại:** đếm lùi các ngày liên tiếp đã học, bắt đầu từ hôm nay; nếu hôm nay chưa đạt thì bắt đầu từ hôm qua, để streak không "mất" từ sáng sớm.
- **Kỷ lục:** chuỗi dài nhất từng có.
- Hiển thị: 🔥 streak hiện tại, kỷ lục, lịch tháng đánh dấu ngày đã học.

## Test bắt buộc
Chưa học ngày nào · chỉ học hôm nay · học hôm qua chưa học hôm nay · bỏ một ngày · chuỗi qua cuối tháng / cuối năm · ngày chưa đủ 10 câu · kỷ lục lớn hơn chuỗi hiện tại.
