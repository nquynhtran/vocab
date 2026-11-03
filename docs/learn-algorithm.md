# Thuật toán Learn

## Tham khảo
- **Quizlet Learn**: mỗi vòng ~7 từ. Từ đi qua các mức *chưa học → quen (đúng trắc nghiệm) → thuộc (viết đúng)*. Sai thì hạ mức, hỏi lại sau vài câu. Một phiên kết thúc khi mọi từ trong bộ đều thuộc.
- **Leitner**: hộp 1→5. Đúng lên hộp, sai về hộp 1. Hộp thấp được ôn nhiều hơn.
- **SM-2 / FSRS** (Anki): lịch ôn theo đường cong quên. Chính xác hơn, phức tạp hơn nhiều.

**Chọn:** hai tầng tách biệt (KISS):
- **Trong phiên** (chỉ trong bộ nhớ, không lưu): mức `0 → 1 → 2` kiểu Quizlet.
- **Giữa các phiên** (lưu DB): hộp Leitner `box` + số lần sai, dùng để sắp thứ tự và tính "đã thuộc".

Thứ tự học đặt sau interface `TermSelector` (Strategy). Đổi sang FSRS (`ts-fsrs`) **không** chỉ thay một module: quy tắc cập nhật `box` có hai bản, `progressAfter` (domain, Dexie dùng) và hàm SQL `record_answer`, FSRS còn cần trường lưu mới (migration). `TermSelector` chỉ tách phần thứ tự.
Code ở `src/domain/learn/`, là **hàm thuần**: nhận state, trả state mới. Thời gian và hàm random truyền vào làm tham số để test cố định được kết quả. Phiên đã qua `challenger` (2026-10-25), quyết định #50–#54. File: `session.ts` (vòng, mức, chèn lại), `selector.ts` (`TermSelector`, priority), `question.ts`, `choices.ts`, `example.ts`, `grading.ts`, `answer.ts` (`AnswerRecord`), `progress.ts` (`progressAfter`: tiến độ sau một câu trả lời), `summary.ts` (tóm tắt vòng/phiên), `random.ts`; ngày địa phương ở `domain/day.ts` (dùng chung với streak). Các bước của màn hình (câu hỏi → phản hồi → đang lưu → lỗi lưu…) là hàm thuần ở `features/learn/learnFlow.ts`: phiên và câu tiếp theo được tính **trước khi** lưu, nên Retry gửi lại đúng bản ghi cũ.

## Tiến độ lưu cho mỗi từ (`TermProgress`)
| Trường | Ý nghĩa |
|--------|---------|
| `box` | 1..5. Từ chưa có `TermProgress` coi như `box 1` |
| `correctCount`, `wrongCount` | Tổng số câu đúng / sai |
| `lastWrongAt`, `lastStudiedAt` | Thời điểm sai / trả lời gần nhất. `lastStudiedAt` còn là khóa chống ghi trùng (xem `recordAnswer`) |
| `lastPromotedDay` | Ngày (`YYYY-MM-DD`, giờ địa phương) gần nhất `box` được tăng. Không bắt buộc (#50) |

**Đã thuộc** = `box ≥ MASTERED_BOX` (= 3), tức đã nhớ đúng (không sai trong phiên) ở ít nhất **2 ngày khác nhau** sau lần sai cuối. Dùng để tính "% đã thuộc" của file, làm tròn xuống (chỉ 100% khi thuộc hết; file trống là 0%). Code: `src/domain/mastery.ts`.

**Cập nhật `box`:**
- Trả lời sai bất kỳ lúc nào → `box = 1` ngay.
- Từ đạt mức 2 trong phiên mà **không sai lần nào trong phiên đó** → domain gửi `promote`. Kho chỉ tăng `box + 1` (tối đa 5) khi `lastPromotedDay ≠ day`, rồi đặt `lastPromotedDay = day`. Nhờ vậy "Study again" ngay, bỏ dở rồi mở phiên mới, hay học cùng lúc trên hai máy đều không tăng hộp quá một bậc mỗi ngày (#50). So sánh "khác" chứ không "nhỏ hơn", để đồng hồ máy bị lùi không chặn mãi.

## Một phiên học
1. **Phạm vi phiên:** mọi từ trong file. Mức khởi đầu trong phiên: `box ≥ 3` → mức 1 (vào thẳng câu viết), còn lại → mức 0.
2. **Thứ tự** ưu tiên giảm dần, tính **một lần** lúc mở phiên (cả phần random):
   `priority = (6 − box) × 10 + min(wrongCount, 5) × 3 + min(sốNgàyChưaHọc, 30) + (chưa học bao giờ ? 5 : 0) + random(0..3)`
   - `sốNgàyChưaHọc` = số ngày lịch giữa `localDay(lastStudiedAt)` và hôm nay; chưa học bao giờ → 0 (đã có +5 riêng).
   - Giới hạn `min(...)` để một từ sai nhiều từ rất lâu không chiếm mãi vị trí đầu; `sốNgàyChưaHọc` đưa dần từ lâu không ôn lên trước.
3. **Vòng:** lấy tối đa 7 từ chưa đạt mức 2, theo thứ tự trên. Từ ở mức 0 trả lời đúng (lên mức 1) được **chèn lại sau 3 hoặc 4 câu** để hỏi câu viết ngay trong vòng đó, nên trắc nghiệm và câu viết của các từ khác nhau đan xen (#56). Mỗi từ còn được chèn lại khi sai. Hết hàng đợi là hết vòng: mọi từ trong vòng đã đạt mức 2, trừ khi bấm dừng.
4. **Câu hỏi theo mức.** Luôn hiện **Nghĩa**, kèm loại từ viết tắt nếu có (#61), trả lời bằng **từ tiếng Anh**:
   - mức 0 → **trắc nghiệm** 4 đáp án.
   - mức 1 → **viết**. Nếu ví dụ chứa từ cần đoán thì hiện ví dụ, che mọi chỗ xuất hiện bằng `____`. Khớp **trọn từ** (trước và sau không phải chữ hay số Unicode), không phân biệt hoa thường, nháy cong = nháy thẳng: "art" không khớp trong "start", "run" không khớp trong "running". Không khớp được (ví dụ dùng dạng chia khác) thì **không hiện ví dụ**, tránh lộ đáp án.
5. **Chấm** tách hai bước thuần: chấm (`gradeWritten`, hoặc so đáp án trắc nghiệm) → kết quả hiện ở màn phản hồi → `applyAnswer(session, kếtQuảCuốiCùng, random)` mới đổi state, trả `promote` để dựng `AnswerRecord` (`toAnswerRecord`). Đúng → mức + 1; vừa lên mức 1 thì chèn lại sau 3 hoặc 4 câu (hàng đợi ít hơn thì đặt cuối), lên mức 2 thì rời hàng đợi. Sai → mức 0, đánh dấu "đã sai trong phiên", hiện đáp án đúng, **chèn lại từ đó sau 2 hoặc 3 câu** (chọn bằng `random`); hàng đợi còn ít câu hơn thì đặt cuối. Vòng chỉ còn đúng từ đó thì câu hỏi lại hiện ngay sau màn phản hồi: chấp nhận (giống Quizlet), có test.
6. Hết vòng → màn tóm tắt vòng → vòng tiếp. **Phiên kết thúc** khi mọi từ trong file đạt mức 2 trong phiên, hoặc người học bấm dừng.
7. **Thanh tiến độ** hai màu (#56): đậm = từ ở mức 2 ("learned"), nhạt = từ ở mức 1 ("familiar"). Câu đúng nào cũng làm thanh nhích lên.
8. **Trắc nghiệm cũng hiện ví dụ** đã che từ (#57), cùng quy tắc che với câu viết.

## Học tiếp sau khi dừng (#58)
- Lưu vào `localStorage` của máy đang dùng, khóa `vocab-learn:<fileId>`, mỗi khi phiên trong bộ nhớ đổi, tức sau mỗi câu **đã lưu xong vào DB** và lúc sang vòng; nhờ vậy bản lưu không bao giờ đi trước DB. Chỉ lưu id và trạng thái (`{ version: 1, savedAt, round, queue, answers, terms: [{ termId, level, missed }] }`), không lưu chữ của từ. Code: `domain/learn/resume.ts` (thuần), `features/learn/sessionStore.ts`.
- **Một chỗ duy nhất** quyết định (effect theo phiên): phiên học xong hết → xóa; còn lại, đã có câu trả lời → ghi (mở Learn rồi thoát ngay không tạo bản lưu). Start over → xóa trước khi mở phiên mới. Stop và "Study again" không xóa gì: "Study again" mở lại trang, nên còn phiên dở thì lại hỏi.
- Ghi hỏng (hết chỗ, bị chặn) → xóa luôn bản lưu của file đó: thà mất bản lưu còn hơn lần sau học tiếp từ một chỗ cũ hơn.
- Mở Learn mà có phiên dở dùng được → hỏi "Continue where you left off? 3 / 12 learned, last studied 5 days ago." (`today`, `yesterday`, `N days ago`, theo `savedAt`; luôn hỏi, không tự hết hạn, #62) với **Continue** / **Start over**.
- Ghép (`resumeSession`, không cần random): đọc lại `getLearnData`; từ đã bị xóa → bỏ (cả trong hàng đợi và `answers`); từ mới thêm → cuối danh sách, mức khởi đầu như lúc mở phiên (`box ≥ 3` → 1); chữ của từ lấy bản mới; mức và `missed` của từ cũ giữ nguyên (không tính lại theo `box` mới). Hàng đợi rỗng sau khi ghép → sang vòng mới. Sau khi ghép mà không còn câu trả lời nào, hoặc mọi từ đã mức 2 → coi như không có phiên dở và xóa bản lưu (để nó không sống lại khi thêm từ sau này).
- Bản lưu là dữ liệu không tin cậy (bản cũ, sửa tay): validate bằng Zod, sai `version` hay sai cấu trúc → bỏ, mở phiên mới. Bất biến: `termId` không trùng; `queue` không trùng, chỉ chứa từ có trong `terms` và mức < 2; `answers` chỉ chứa từ có trong `terms`, `round` ≤ `round` của phiên; `round` ≥ 1. Không dùng được `localStorage` → học như cũ, không lưu.
- Chỉ trên máy đó (người dùng nhập từ trên máy tính, học trên điện thoại). Hộp Leitner vẫn đồng bộ qua cloud như cũ.

## Ghi kết quả
- **Trắc nghiệm** (đúng hay sai): ghi ngay khi chấm (#52). Đúng thì sang câu sau ~0.8 giây sau khi ghi xong; sai thì hiện màn phản hồi. Trắc nghiệm không có "I was right".
- **Câu viết**: hiện màn phản hồi; kết quả được ghi khi bấm **Continue** (hoặc Enter). Nhờ vậy nút **"I was right"** chỉ cần đổi kết quả trước khi `applyAnswer`, không phải hoàn tác dữ liệu đã lưu. Đóng tab ở màn này thì mất câu đó: chấp nhận.
- Ghi qua một lệnh `repository.recordAnswer(...)`: cập nhật `TermProgress` và `StudyDay` trong một transaction.

### `recordAnswer`
```ts
interface AnswerRecord {
  termId: string
  correct: boolean
  promote: boolean     // từ vừa đạt mức 2 và không sai lần nào trong phiên
  answeredAt: string   // ISO
  day: string          // localDay(answeredAt)
}
recordAnswer(answer: AnswerRecord): Promise<void>
```
- `answeredAt` và `day` dựng từ **cùng một** `now`, `day = localDay(now)`: hàm duy nhất ở domain, dùng `getFullYear/getMonth/getDate` (giờ địa phương). Không dùng `toISOString().slice(0, 10)`: ở UTC+7, câu trả lời từ 0h đến 7h sẽ rơi vào hôm qua.
- Gửi **ý định**, không gửi giá trị mới: kho tự tính trên bản ghi hiện có (`correct_count + 1`...). Hai máy học cùng lúc không ghi đè số của nhau.
  - Chưa có `TermProgress` → tạo với `box 1`, bộ đếm 0, rồi áp dụng câu trả lời.
  - Sai → `box = 1`, `wrongCount + 1`, `lastWrongAt = answeredAt`. Đúng → `correctCount + 1`; `promote` thì tăng `box` theo quy tắc `lastPromotedDay` ở trên.
  - Luôn `lastStudiedAt = answeredAt`; `StudyDay(day).answeredCount + 1` (chưa có thì tạo).
  - `promote && !correct` → `ValidationError` (bug của domain, không ghi gì). Input validate bằng Zod như mọi lần ghi.
- **Chống ghi trùng:** `lastStudiedAt` đã bằng `answeredAt` (so thời điểm, không so chuỗi) → không làm gì (cả `StudyDay`). Gửi lại đúng `AnswerRecord` cũ luôn an toàn (#51). Giới hạn đã chấp nhận: nếu giữa lần gửi đầu và lần Retry, máy khác đã ghi một câu khác cho **cùng từ**, lần Retry sẽ được tính thêm một lần; hai máy trả lời cùng từ trong cùng một mili giây thì câu sau bị bỏ.
- Từ đã bị xóa (kể cả bị xóa đúng lúc đang ghi) hoặc không thuộc người dùng → không ghi gì, không báo lỗi.
- **Lỗi mạng** (`ConnectionError`): có thể đã ghi. Không tự thử lại; dừng ở câu hiện tại, báo "Your answer could not be saved." kèm nút **Retry** (gửi lại đúng `AnswerRecord`) và **Stop**. Không cho học tiếp như không có gì: mất sóng cả phiên sẽ không lưu được câu nào (#51). Hết phiên đăng nhập (`SessionExpiredError`): hộp Sign in phủ lên, phiên học giữ nguyên, đăng nhập lại rồi bấm Retry; chấp nhận là nút Retry không được focus sẵn sau khi hộp đóng.
- Dexie: một transaction rw trên `terms`, `progress`, `studyDays`, tính bằng `progressAfter`. Supabase: RPC `record_answer` (cùng quy tắc viết bằng SQL, sửa thì sửa cả hai; bộ hợp đồng chạy cùng test cho hai kho) (xem [cloud-sync.md](cloud-sync.md#giai-đoạn-3-learn)).

### Dữ liệu cho phiên học
`getLearnData(fileId)` → `{ file, terms, progress, distractors } | undefined`, đọc **một snapshot** (Supabase: RPC `get_learn_data` trả `jsonb`, không bị cắt ở 1000 dòng, như #39):
- `terms` (mới nhất trước, như `listTerms`) + `progress` của file (từ chưa có tiến độ thì không có trong `progress`).
- `distractors`: `{ word, meaning }` của mọi từ thuộc **các file khác** cùng folder, luôn trả về (#54). Folder vài nghìn từ cũng chỉ vài trăm KB.

## Chọn đáp án nhiễu
Hàm thuần nhận `{ fileTerms, folderTerms }`. Lấy từ file trước, sau đó mới tới folder, dựa trên **số đáp án nhiễu hợp lệ sau khi lọc** (không dựa trên số từ của file):
- Bỏ từ có cùng `toKey(meaning)` với câu hỏi; bỏ từ có `toKey(word)` trùng đáp án đúng hoặc trùng nhau (từ nhiều nghĩa).
- Cần 3. Thiếu thì giảm số lựa chọn (tối thiểu 2). Không có đáp án nhiễu nào thì câu mức 0 cũng là câu **viết**; viết đúng lên mức 1 rồi lại viết: cố ý.

## Chấm câu viết
- Chuẩn hóa: `toKey` của `domain/text.ts` (NFC, trim, gộp khoảng trắng, chữ thường, nháy cong → nháy thẳng), sau đó bỏ thêm dấu câu ở hai đầu.
- Từ (đã chuẩn hóa) ≥ 5 ký tự và lệch đúng 1 ký tự (Levenshtein = 1) → **gần đúng**: tính đúng nhưng hiện chỗ sai chính tả.
- Nút **"I was right"** (chỉ ở câu viết bị chấm sai): đổi kết quả thành đúng **trước** `applyAnswer`, nên trạng thái phiên như thể trả lời đúng (mức + 1, không đánh dấu đã sai, không chèn lại như câu sai mà như câu đúng, `promote` tính lại). Dùng khi máy chấm sai, ví dụ từ đồng nghĩa.

## Trường hợp biên
| Tình huống | Xử lý |
|-----------|-------|
| File trống | Không vào được Learn |
| Không đủ đáp án nhiễu | Xem "Chọn đáp án nhiễu" |
| Mọi từ đã `box ≥ 3` | Mọi câu là câu viết; viết đúng một lần là xong từ đó |
| Từ bị sửa ở tab/máy khác khi đang học | Câu hỏi dùng bản trong bộ nhớ; tiến độ gắn theo `termId` nên dữ liệu không sai |
| Từ bị xóa khi đang học | `recordAnswer` không ghi gì, không báo lỗi |
| Phiên kéo qua nửa đêm | Mỗi câu ghi vào ngày lúc trả lời (`localDay(now)` của từng câu) |
| Đổi múi giờ, đồng hồ máy sai | Chấp nhận: ngày theo đồng hồ máy lúc trả lời |
| Rời trang, đóng tab (hoặc Stop sau lỗi lưu) khi một câu đang lưu, rồi học tiếp | Câu đó có thể đã ghi nhưng phiên đã lưu chưa có nó, nên được hỏi lại và đếm thêm một lần vào `correctCount`/`wrongCount`: chấp nhận (hiếm, chỉ lệch bộ đếm) |
