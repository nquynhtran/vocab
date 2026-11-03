# Tra phiên âm (Look up, giai đoạn 3b)

Nút **Look up** ở form từ điền sẵn phiên âm IPA giọng Anh-Anh. Chỉ là gợi ý: người dùng sửa được, tra lỗi không bao giờ chặn việc lưu từ. Giao diện: [ui.md](ui.md#thao-tác).

## Chọn nguồn (thử thật 2026-11-04)
| Nguồn | Kết quả | Kết luận |
|-------|---------|----------|
| `api.dictionaryapi.dev` | Lúc 502, lúc trang lỗi HTML; không có "run", "schedule" (404); "environment" ra `/-mɪnt/`, "tomato" ra phiên âm hẹp `[tʰə̥ˈmɐːtʰɐʉ]` (giọng Úc) | Không dùng |
| **Wiktionary** (`en.wiktionary.org/w/api.php`, MediaWiki API) | Có `run`, `schedule`, `environment`, `tomato`, nhãn giọng rõ (`RP`, `SSB`, `GA`); CORS `*` khi có `origin=*`; không cần khóa | **Dùng** (#66) |
| Cambridge, Oxford | Chất lượng tốt nhất cho người học, nhưng không có API miễn phí gọi từ trình duyệt | Chỉ làm link mở tab mới khi tra không được |

Cụm từ (`give up`) và từ hiếm thường không có phiên âm ở mọi nguồn → "No pronunciation found." là trường hợp bình thường, không phải lỗi.

## Cách tra (2 request, mỗi cái vài KB đến ~15 KB)
1. `action=parse&page=<từ>&prop=sections&redirects=1&format=json&formatversion=2&origin=*` → trong mục cấp 2 `English`, lấy mục **đầu tiên** có tên bắt đầu bằng `Pronunciation` (từ có nhiều gốc có `Pronunciation 1`, `2`…; lấy cái đầu).
   Request này lấy thêm `revid` (`prop=sections|revid`).
2. `action=parse&oldid=<revid>&prop=wikitext&section=<index>&…` → wikitext của riêng mục đó, **đúng bản trang** của request 1 (trang bị sửa giữa hai request thì `index` có thể trỏ sang mục khác; `oldid` cũng khỏi giải redirect lần nữa). Không tải cả trang: trang "run" rất lớn.
- `<từ>` là chữ trong ô Term sau `normalizeText` và đổi nháy cong → nháy thẳng (iPhone gõ `don’t`, trang tên `don't`), mã hóa bằng `URLSearchParams`. Có ký tự không hợp lệ trong tên trang MediaWiki (`# < > [ ] { } |`) → không gửi, coi như không tìm thấy (`C#` có thể bị hiểu là trang `C`, ra phiên âm sai). Không tìm thấy (không có trang, hoặc có trang mà không có mục English/Pronunciation, như `Polish`) và chữ có hoa → thử lại một lần với chữ thường (Wiktionary phân biệt `Run`/`run`).
- Header `Api-User-Agent: vocab (https://github.com/nquynhtran/vocab)` theo quy định của Wikimedia cho request từ trình duyệt. Header này làm trình duyệt gửi thêm preflight `OPTIONS` (4 lượt thay vì 2). Thử thật trên Firefox và iPhone: preflight không qua thì bỏ header; qua mà chậm rõ thì hỏi người dùng.
- Hết giờ 8 giây cho **cả lần tra** (mọi request dùng chung một `AbortController` + `setTimeout`, không dùng `AbortSignal.timeout` vì iOS cũ). Gửi lại khi đang tra thì bỏ request cũ.

## Chọn phiên âm trong wikitext (hàm thuần ở `domain/`)
Wikitext thật (rút gọn):
```
* {{a|en|RP}}<ref>…</ref>
** {{IPA|en|/ˈʃɛd͡ʒuːl/|/ˈskɛd͡ʒ.uːl/|a=yod-coalescence}}
* {{IPA|en|/ˈskɛd͡ʒ.ʊl/|a=GA,Philippines}}
* {{IPA|en|/təˈmɑː.təʊ/|a=RP,AU}}
```
- Trước hết bỏ `<!-- … -->` và `<ref>…</ref>` / `<ref …/>`; thẻ không đóng thì bỏ tới hết đoạn (như MediaWiki), để regex chạy tuyến tính: wikitext 200 KB hỏng (bị phá) không được làm treo tab, vì đoạn tách chạy đồng bộ, hết giờ 8 giây không ngắt được (có test tốc độ). Rồi duyệt từng dòng, từng template theo thứ tự: `{{a|…}}` / `{{accent|…}}` đặt nhãn giọng cho các `{{IPA}}` **sau nó** trên cùng dòng (tới `{{a}}` kế tiếp), và `{{a}}` cuối dòng đặt nhãn cho các dòng `**` ngay dưới. Mỗi template `{{IPA|en|…}}` cho danh sách phiên âm (tham số không tên) và nhãn riêng: `a=` (tách dấu phẩy) và modifier gắn liền sau giá trị (`/ˈtɒm.ə.təʊ/<a:RP>`, cũng có `<q:…>`, `<qq:…>`, `<ref:…>`). Modifier được cắt khỏi giá trị trước khi dùng; nhãn trong `<a:…>` tính như `a=`.
- Nhãn tính theo **từng phiên âm**: nhãn của template, của chính giá trị (`<a:…>`), và của `{{a}}` cùng dòng hay dòng cha (một template có thể ghi `/…/<a:GA>|/…/<a:RP>`). Nhãn Anh-Anh: `RP`, `UK`, `SSB`, `British`, `Received Pronunciation`, `Standard Southern British` (so cả chuỗi, không phân biệt hoa thường; `19th century <<RP>>` không tính).
- Thứ tự chọn: Anh-Anh dạng `/…/` (âm vị, kiểu từ điển cho người học) → Anh-Anh dạng `[…]` (ngữ âm hẹp) → bất kỳ `/…/` → bất kỳ `[…]`; trong mỗi nhóm lấy cái đầu tiên. Phần lớn từ có một bản chung cho mọi giọng, như `run`: `a=GA,RP`. Đổi cho giống kiểu Cambridge mà người học quen (#66): `ɹ` → `r` (`/ɹʌn/` → `/rʌn/`), `ɛ` → `e` (`/ˈʃɛd͡ʒuːl/` → `/ˈʃedʒuːl/`), bỏ dấu nối `͡` (U+0361) và `͜` (U+035C). Giữ dấu chấm âm tiết (Cambridge cũng có). Không đổi gì khác. Đổi trước khi kiểm tra regex và schema.
- Chỉ nhận giá trị khớp **trọn** `^/[^/<>{}|[\]&]+/$` (hoặc `^\[[^[\]<>{}|/&]+\]$`), không chứa `''` (chữ đậm/nghiêng của wiki; IPA ghi trọng âm bằng `ˈ`), rồi qua schema `pronunciation` (≤ 100 ký tự). Không khớp → bỏ giá trị đó; không còn giá trị nào → không tìm thấy. Schema một mình không đủ: nó chỉ chặn `\0` và surrogate, `/ɹʌn/<a:RP>` vẫn qua.
- Test bằng wikitext thật đã lưu (run, schedule, tomato, environment, give up, trang không có English) + các dạng lạ (template hỏng, không có `/…/`, nhãn có `<<…>>`, modifier `<a:…>`/`<q:…>`, `<!-- -->` và `<ref>` trong dòng, `{{a}}` cùng dòng với `{{IPA}}`).

## Ranh giới và lỗi
- Phản hồi là **dữ liệu không tin cậy** ([security.md](security.md)): parse JSON, kiểm tra hình dạng bằng Zod (chỉ các trường cần), wikitext quá 200 KB → bỏ; chỉ hiển thị dạng text. Không bao giờ render HTML của Wiktionary.
- Kết quả: `{ kind: 'found', pronunciation }` · `{ kind: 'not-found' }` · lỗi mạng / HTTP ≠ 200 / JSON hỏng / hết giờ → `LookupFailedError`. UI báo hai câu khác nhau ([ui.md](ui.md#thao-tác)).
- Code: hàm thuần `wiktionaryTitles(word)`, `findPronunciationSection(sections)`, `pickPronunciation(wikitext)` ở `domain/pronunciation.ts`; gọi mạng ở `data/wiktionary.ts` (nhận `fetch` làm tham số), cài interface `PronunciationLookup` (`lookUp(word, signal)`). UI lấy qua `PronunciationLookupContext` ở `shared/` (như `RepositoryContext`), `main.tsx` tạo bản thật; test UI dùng bản giả. Không qua `Repository` vì không phải dữ liệu của người dùng.
- CSP: `connect-src` thêm `https://en.wiktionary.org`. Link Cambridge là điều hướng sang tab mới (`target="_blank" rel="noopener noreferrer"`), CSP không chặn.
- Riêng tư: chỉ gửi chữ trong ô Term, chỉ khi bấm nút. Không gửi gì khác.
- Bản quyền: nội dung Wiktionary là CC BY-SA; app cá nhân lưu vài phiên âm để học, không phát hành lại.
