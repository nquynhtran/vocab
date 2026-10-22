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
