# Vocab — Ghi chú dự án

App học từ vựng cá nhân (chỉ có chế độ Learn kiểu Quizlet). Giao tiếp với người dùng bằng tiếng Việt.
Stack: TypeScript strict · React + Vite · Dexie (IndexedDB) · Zod · Vitest · GitHub Pages. Giai đoạn 7 chuyển sang Supabase.

@PROGRESS.md
@docs/README.md

## Cách làm việc
- Đầu phiên: xem "Đang ở đâu" ở trên rồi làm tiếp. Chỉ mở file tài liệu liên quan theo mục lục `docs/README.md`, không đọc hết.
- Xong một mục checklist hoặc trước khi chuyển phiên: chạy `/save-progress`.
- Thiết kế thay đổi → sửa tài liệu trước hoặc cùng lúc với code. Tài liệu và code không được lệch nhau.
- **Phiên dài → chủ động nhắc đổi phiên.** Dấu hiệu: vừa xong một giai đoạn; đã làm nhiều mục checklist trong cùng phiên; đã đọc nhiều file lớn; hoặc ngữ cảnh đã bị tóm tắt tự động. Khi đó dừng ở điểm an toàn (test xanh, đã commit), chạy `/save-progress` và đưa bản tóm tắt để người dùng dán sang phiên mới.

## Dùng công cụ đúng lúc
Tự quyết định dùng gì, dựa trên lợi ích so với chi phí; không chờ người dùng nhắc, cũng không gọi theo thói quen. Mỗi lần gọi agent tốn token vì agent đọc lại ngữ cảnh từ đầu.
- `challenger` — gọi khi sai lầm đắt: trước một giai đoạn có logic hoặc dữ liệu (1, 3, 4, 5, 7), trước khi chốt quyết định thiết kế khó đảo ngược. Không cần cho việc cài đặt, sửa giao diện nhỏ, đổi chữ.
- `reviewer` — gọi khi code có rủi ro: logic `domain/`, tầng `data/`, migration, xuất/nhập, xử lý input. Thay đổi nhỏ, rõ ràng (CSS, đổi tên, cấu hình) thì tự soát là đủ.
- `/save-progress` — khi xong một mục checklist, trước khi chuyển phiên.
- Kết quả của agent là ý kiến, không phải lệnh: tự kiểm chứng từng điểm trước khi sửa, điểm nào không đồng ý thì nói rõ lý do với người dùng.
- Khi gọi hoặc bỏ qua một agent ở chỗ người dùng có thể thắc mắc, nói ngắn gọn lý do.

## Nguyên tắc bắt buộc

### 1. Hiểu trước, sửa sau
- **Chesterton's Fence**: chưa hiểu vì sao code tồn tại thì không xóa, không sửa.
- Sửa bug: **Tái hiện → Nguyên nhân gốc (5 Whys) → Phân tích tác động → Viết test tái hiện bug → Sửa → Chạy lại toàn bộ test**. Không vá triệu chứng.
- Trước khi sửa một hàm hoặc kiểu dữ liệu, tìm mọi nơi đang dùng nó.

### 2. Thiết kế
- **KISS, YAGNI**: chỉ làm đúng phạm vi trong `docs/scope.md`. Tính năng mới → cập nhật tài liệu trước.
- **DRY**: logic chỉ ở một nơi. Zod schema là nguồn duy nhất cho kiểu và validate.
- **Separation of Concerns**, phụ thuộc một chiều: `features → domain, data` · `data → domain` · `domain` không import React hay Dexie.
- **Dependency Inversion**: UI chỉ dùng interface `Repository` (quy tắc ở `docs/architecture.md`). Thuật toán học nằm sau `TermSelector` (Strategy).
- **Single Responsibility**: hàm và module nhỏ, mỗi thứ một việc. Logic là hàm thuần; thời gian và random truyền vào làm tham số.
- **Composition over Inheritance**, **Law of Demeter**, **Least Astonishment**.
- CSS luôn responsive (viết cho màn hẹp trước), dù đang ưu tiên máy tính.

### 3. Toàn vẹn dữ liệu
- Ghi nhiều bảng → **một transaction**, đóng gói trong một phương thức repository.
- Validate mọi đầu vào ở biên: form, file JSON nhập vào, dữ liệu DB version cũ. **Fail fast**, báo lỗi rõ ràng.
- **Immutability**: không mutate state hay tham số; trả về object mới.
- Đổi cấu trúc dữ liệu → thêm version Dexie + migration có test (và tăng `schemaVersion` của file backup). Không phá dữ liệu và backup cũ.

### 4. Bảo trì
- Tên rõ nghĩa. Comment giải thích **tại sao**, không phải cái gì.
- Test: bắt buộc cho mọi logic ở `domain/`; repository test bằng fake-indexeddb; UI test cho luồng chính.
- `npm run check` phải xanh trước khi báo xong. CI phải xanh.
- **Conventional Commits** (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`). Refactor tách commit riêng (**Boy Scout Rule**).

### 5. Bảo mật
Chi tiết ở `docs/security.md`. Tóm tắt: không `dangerouslySetInnerHTML`/`eval`; file nhập là dữ liệu không tin cậy; không có secret trong repo; quyền CI tối thiểu.
