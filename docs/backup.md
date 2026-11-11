# Khôi phục backup (giai đoạn 5)

> Trạng thái: đã thiết kế, qua `challenger`, người dùng chốt #76–#79 (2026-11-08). Tầng dữ liệu đã có (`replaceAll`, RPC `replace_all`, test `supabase/tests/database/replace_all.test.sql`); giao diện: `features/backup/BackupSection.tsx`, so sánh ở `domain/restoreComparison.ts`.
> Định dạng file, validate, `migrateBackup`: [data-model.md](data-model.md#sao-lưu-json). Nhập vào kho trống hiện có: [cloud-sync.md](cloud-sync.md#chuyển-dữ-liệu-local-lên-cloud-33-46).

## Hành vi
"Restore from backup" thay **toàn bộ** dữ liệu bằng nội dung file: folder, file, từ, tiến độ học và **ngày học** (`study_days`, #76). Lỗi ở bất kỳ bước nào thì dữ liệu hiện tại giữ nguyên. Chạy lại cùng file ra cùng kết quả (idempotent), nên bấm lại sau lỗi mạng không tạo bản trùng.

## Tầng dữ liệu
- `Repository.replaceAll(backup)`: validate lại (`validateBackup`) rồi ghi.
- **Dexie:** một transaction rw trên mọi bảng trừ `meta`: xóa hết → chèn bằng `insertBackup`, hàm chung với `importIntoEmpty`. Test riêng của Dexie: lệnh chèn hỏng sau khi đã xóa thì dữ liệu cũ còn nguyên.
- **Supabase:** RPC `replace_all(payload)` (#78), `security invoker`, cùng payload với `import_snapshot`:
  1. kiểm tra đăng nhập;
  2. `pg_advisory_xact_lock` **cùng key** `'import_snapshot:' || uid`: một lần khôi phục và một lần Import chạy cùng lúc sẽ lần lượt chờ nhau, thay vì một bên hỏng với VC001. Không phải để giữ an toàn dữ liệu: bước xóa chưa commit thì thao tác khác không thấy, và dòng nào được commit trước bước kiểm tra kho trống cũng làm `import_snapshot` ném VC001, rollback cả hàm;
  3. `delete from folders` (cascade xuống files, terms, progress) và `delete from study_days` của user;
  4. `perform public.import_snapshot(payload)`: kho đã trống nên qua bước kiểm tra kho trống, bộ key vẫn được kiểm tra. Khóa xact advisory vào lại được trong cùng phiên.
  Không tách hàm chèn nội bộ: hàm ở `public` mà `authenticated` gọi được thì PostgREST lộ ra `/rpc`. `revoke`/`grant` như các RPC khác.
- Giữ id và thời gian như file; `nameKey`/`wordKey` tính lại bằng `toKey`. Xóa rồi chèn cùng transaction nên id trùng với dữ liệu cũ không va chạm.
- Không đổi bảng hay cột: không cần Dexie version mới, `schemaVersion` hay nâng `min_client_version`; client cũ không gọi RPC mới.
- `importIntoEmpty` / `import_snapshot` giữ ở tầng dữ liệu (có test, `replace_all` dùng lại), chỉ bỏ khỏi UI (#77).

## Giao diện (mục Backup trên màn Settings, #77, #86)
Một mục duy nhất, luôn hiện: nút Export JSON (đã có) + "Restore from backup".
1. Chọn file → `parseBackupFile` như hiện nay (≤ 5 MB, lỗi hiện tối đa 5 dòng kèm vị trí).
2. Đọc dữ liệu hiện tại bằng **một** `exportBackup()` (vừa để so sánh, vừa là bản sao ở bước 3).
3. Màn so sánh, hai cột *Current* / *Backup*: số folder, file, từ; lần sửa gần nhất (max `updatedAt` của folder, file, từ); ngày học gần nhất. Kèm:
   - Dữ liệu hiện tại mới hơn file (lần sửa hoặc ngày học) → dòng cảnh báo rõ.
   - "N study days not in the backup will be removed" (số ngày có ở hiện tại mà không có trong file), vì streak có thể giảm.
   - "Close the app on other devices first."
   - Nút **Download current data first** (#79): tải snapshot ở bước 2, không bắt buộc, không tự tải (Safari/iPhone có thể chặn tải sau `await` mà app không biết, như #46). Chạy thử `validateBackup` trên snapshot; hỏng → cảnh báo "Your current data has a problem at …; a copy taken now cannot be restored as is". Chỉ cảnh báo, không chặn (`exportBackup` cố ý không validate, #41).
   - Nút đỏ **Replace all** và Cancel. Không thêm `window.confirm`: màn này đã là bước xác nhận.
   - Kho trống (0 folder, 0 ngày học): bỏ cảnh báo đỏ, chỉ hiện số lượng của file và nút "Restore". Có ngày học mà không có folder (lỗi #74 cũ) vẫn nêu số ngày sẽ bị thay.
4. Xong → đóng màn so sánh, hiện "Restored N folders, N files and N terms.". Màn Settings không hiện dữ liệu nào nên không có gì phải tải lại; Home tự tải mới khi mở (trước #86 mục này ở Home và phải tải lại folder + streak, cả khi lỗi).
- Lỗi file và lỗi lúc ghi hiện **ngay trong mục Backup**, không ở ô lỗi chung đầu trang: lỗi phải nằm cạnh chỗ vừa bấm (lý do gốc: mục từng ở cuối Home, lỗi đầu trang nằm ngoài màn hình). Mục Backup luôn hiện nên lỗi không biến mất khi trang tải lại (khác mục Import cũ). Lỗi đã rollback (có mã, hết phiên) → giữ màn so sánh để bấm lại; `ConnectionError` → đóng màn so sánh (dữ liệu hiện tại có thể đã đổi), chọn lại file. Bấm xong (thành công hay lỗi) con trỏ bàn phím chuyển tới câu kết quả; Cancel → về ô chọn file. Trên Supabase, lỗi không có mã (trang lỗi HTML 502/504 của proxy, có thể đến sau khi đã commit) là `ConnectionError` như mọi request ([cloud-sync.md](cloud-sync.md)); lỗi có mã Postgres nghĩa là đã rollback. `ConnectionError`: "The restore may or may not have finished. Check your folders on Home; restoring the same file again is safe.". Không bao giờ báo "nothing was replaced" khi lỗi mạng.

## Trường hợp chấp nhận (không làm)
- **Thiết bị khác đang mở:** từ không còn trong file → `record_answer` không làm gì, không đếm ngày học, không báo lỗi; từ còn cùng id → cộng lên tiến độ vừa khôi phục. Phiên Learn dở (#58) mở lại thì `resumeSession` bỏ id đã mất, nhưng level trong phiên vẫn là level cũ. Nháp ghi chú đã so với `base` (#69).
- **Máy khác tạo folder đúng lúc đang khôi phục** (giữa bước xóa và bước kiểm tra kho trống): `import_snapshot` ném VC001, cả hàm rollback, dữ liệu an toàn; câu báo là lỗi chung, bấm lại là được.
- **Khe giữa lúc xem so sánh và lúc bấm:** máy khác thêm từ trong khoảng đó thì bị xóa theo. Chặn được bằng mốc `updatedAt` gửi kèm, nhưng thêm nhánh lỗi; một người dùng thì không đáng.
- **Nhắc sao lưu định kỳ** (`lastBackupAt`): không làm, ứng viên của Settings ở giai đoạn 6.

## Giới hạn payload (đã đo trên local, 2026-11-08)
Role `authenticated` có `statement_timeout` 8 s, cả local (đọc `pg_roles`) lẫn cloud (`supabase inspect db role-stats --linked`, 2026-11-08). `import_snapshot` trên Supabase local, dữ liệu giả có ghi chú, ví dụ, phiên âm, tiến độ và 1000 ngày học: 2 000 từ (2,1 MB) 0,4 s · 8 000 từ (6,0 MB) 1,4 s · 12 000 từ (8,6 MB) 2,1 s. Giới hạn 5 MB còn dư nhiều. Chưa đo trên cloud: phải dùng tài khoản riêng vì thao tác xóa sạch dữ liệu, mà cloud đã tắt đăng ký; dữ liệu thật còn nhỏ hơn nhiều nên để lúc deploy, thử khôi phục bằng chính file Export của người dùng.

## Deploy
Không đổi bảng hay cột, không nâng `min_client_version`; client cũ không gọi RPC mới. Thứ tự: `npm run test:supabase` trên đúng commit sẽ deploy → `db push --dry-run` (chỉ `20261108120000_replace_all.sql`) → hỏi người dùng → `db push` → push code. Làm ngược lại thì nút Replace all lỗi tới khi `db push`. Sau deploy: người dùng Export rồi khôi phục chính file đó trên cloud (vừa thử thật vừa đo payload thật).

## Test
- **Bộ hợp đồng (cả hai kho):** thay xong `exportBackup` đúng bằng file (`toStrictEqual`); chạy hai lần cùng file ra cùng kết quả; kho trống; kho chỉ có ngày học; file có id trùng dữ liệu hiện tại; file không hợp lệ → dữ liệu cũ nguyên vẹn, so cả bản ghi.
- **pgTAP:** payload sai bộ key (lỗi xảy ra *sau* bước xóa) → dữ liệu cũ còn nguyên; không đụng dữ liệu người B; không dùng khóa advisory thứ hai ngoài key của `import_snapshot` (đọc `pg_locks`; không chứng minh được thứ tự khóa, mà thứ tự cũng không ảnh hưởng tính đúng); quyền `anon` và `security invoker` đã có test chung cho mọi hàm ở `tables.test.sql`.
- **UI trên `App` thật:** luồng chọn file → so sánh → Replace all → danh sách và streak đổi; Cancel không ghi gì; lỗi mạng hiện đúng câu báo; kho trống không có cảnh báo đỏ; cảnh báo snapshot hỏng.
