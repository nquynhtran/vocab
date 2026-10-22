# Thuật toán Learn

## Tham khảo
- **Quizlet Learn**: mỗi vòng ~7 từ. Từ đi qua các mức *chưa học → quen (đúng trắc nghiệm) → thuộc (viết đúng)*. Sai thì hạ mức, hỏi lại sau vài câu. Một phiên kết thúc khi mọi từ trong bộ đều thuộc.
- **Leitner**: hộp 1→5. Đúng lên hộp, sai về hộp 1. Hộp thấp được ôn nhiều hơn.
- **SM-2 / FSRS** (Anki): lịch ôn theo đường cong quên. Chính xác hơn, phức tạp hơn nhiều.

**Chọn:** hai tầng tách biệt (KISS):
- **Trong phiên** (chỉ trong bộ nhớ, không lưu): mức `0 → 1 → 2` kiểu Quizlet.
- **Giữa các phiên** (lưu DB): hộp Leitner `box` + số lần sai, dùng để sắp thứ tự và tính "đã thuộc".

Thuật toán đặt sau interface `TermSelector` (Strategy), sau này đổi sang FSRS (`ts-fsrs`) chỉ thay một module.
Code ở `src/domain/learn/`, là **hàm thuần**: nhận state, trả state mới. Thời gian và hàm random truyền vào làm tham số để test cố định được kết quả.

## Tiến độ lưu cho mỗi từ (`TermProgress`)
| Trường | Ý nghĩa |
|--------|---------|
| `box` | 1..5. Từ chưa có `TermProgress` coi như `box 1` |
| `correctCount`, `wrongCount` | Tổng số câu đúng / sai |
| `lastWrongAt`, `lastStudiedAt` | Thời điểm sai / học gần nhất |

**Đã thuộc** = `box ≥ MASTERED_BOX` (= 3), tức đã qua ít nhất 2 phiên liên tiếp không sai. Dùng để tính "% đã thuộc" của file.

**Cập nhật `box`** (mỗi từ tối đa một lần tăng mỗi phiên, để việc trả lời nhiều câu trong một phiên không làm hộp tăng vọt):
- Trả lời sai bất kỳ lúc nào → `box = 1` ngay.
- Từ đạt mức 2 trong phiên mà **không sai lần nào trong phiên đó** → `box + 1` (tối đa 5).

## Một phiên học
1. **Phạm vi phiên:** mọi từ trong file. Mức khởi đầu trong phiên: `box ≥ 3` → mức 1 (vào thẳng câu viết), còn lại → mức 0.
2. **Thứ tự** ưu tiên giảm dần:
   `priority = (6 − box) × 10 + min(wrongCount, 5) × 3 + min(sốNgàyChưaHọc, 30) + (chưa học bao giờ ? 5 : 0) + random(0..3)`
   Giới hạn `min(...)` để một từ sai nhiều từ rất lâu không chiếm mãi vị trí đầu; `sốNgàyChưaHọc` đưa dần từ lâu không ôn lên trước.
3. **Vòng:** lấy tối đa 7 từ chưa đạt mức 2, theo thứ tự trên.
4. **Câu hỏi theo mức.** Luôn hiện **Nghĩa**, trả lời bằng **từ tiếng Anh**:
   - mức 0 → **trắc nghiệm** 4 đáp án.
   - mức 1 → **viết**. Nếu ví dụ chứa từ cần đoán (không phân biệt hoa thường) thì hiện ví dụ với từ đó che bằng `____`. Nếu không tìm thấy từ trong ví dụ (ví dụ dùng dạng chia khác) thì **không hiện ví dụ**, tránh lộ đáp án.
5. **Chấm:** đúng → mức + 1. Sai → mức 0, hiện đáp án đúng, **chèn lại từ đó sau 2–3 câu**; vòng còn ít câu hơn thì đặt cuối vòng.
6. Hết vòng → màn tóm tắt vòng → vòng tiếp. **Phiên kết thúc** khi mọi từ trong file đạt mức 2 trong phiên, hoặc người học bấm dừng.

## Ghi kết quả
- Trắc nghiệm đúng: ghi ngay, tự sang câu sau ~0.8 giây.
- Câu sai hoặc câu viết: hiện màn phản hồi; kết quả được ghi khi bấm **Continue** (hoặc Enter). Nhờ vậy nút **"I was right"** chỉ cần đổi kết quả trước khi ghi, không phải hoàn tác dữ liệu đã lưu.
- Ghi qua một lệnh `repository.recordAnswer(...)`: cập nhật `TermProgress` và `StudyDay` trong một transaction. Thoát giữa chừng chỉ mất câu đang ở màn phản hồi.

## Chấm câu viết
- Chuẩn hóa: `toKey` của `domain/text.ts` (NFC, trim, gộp khoảng trắng, chữ thường, nháy cong → nháy thẳng), sau đó bỏ thêm dấu câu ở hai đầu.
- Từ (đã chuẩn hóa) ≥ 5 ký tự và lệch đúng 1 ký tự (Levenshtein = 1) → **gần đúng**: tính đúng nhưng hiện chỗ sai chính tả.
- Nút **"I was right"**: đổi kết quả câu vừa chấm sai thành đúng (dùng khi máy chấm sai, ví dụ từ đồng nghĩa).

## Trường hợp biên
| Tình huống | Xử lý |
|-----------|-------|
| File < 4 từ | Lấy đáp án nhiễu từ file khác cùng folder; vẫn thiếu thì giảm số lựa chọn (tối thiểu 2); chỉ có 1 lựa chọn thì hỏi viết |
| File trống | Không vào được Learn |
| Hai từ cùng nghĩa (sau chuẩn hóa) | Không dùng làm đáp án nhiễu của nhau |
| Hai mục cùng `word` (từ nhiều nghĩa) | Đáp án trắc nghiệm không lặp `word` |
| Từ bị sửa/xóa ở tab khác khi đang học | Không xử lý đặc biệt; `recordAnswer` cho từ đã bị xóa thì bỏ qua và không báo lỗi |
