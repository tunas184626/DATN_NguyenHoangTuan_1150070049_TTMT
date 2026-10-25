# Backend & PostGIS

## Chạy local

```powershell
Copy-Item backend/.env.example backend/.env
docker compose up -d postgres
npm run db:migrate
npm run db:seed
npm run dev:backend
```

Mở terminal khác và chạy frontend:

```powershell
npm run dev
```

Các địa chỉ kiểm tra:

- `GET http://localhost:3001/api/health/live`: tiến trình API đang chạy.
- `GET http://localhost:3001/api/health/ready`: kết nối PostgreSQL/PostGIS sẵn sàng.
- `GET http://localhost:3001/api/assets?type=water_plant`: nhóm nhà máy nước từ database.
- `GET/POST http://localhost:3001/api/incidents`: danh sách và ghi nhận sự cố.
- `PATCH http://localhost:3001/api/incidents/:id/status`: chuyển trạng thái có kiểm soát.
- `GET http://localhost:3001/api/incidents/:id/history`: lịch sử xử lý.
- `GET http://localhost:3001/api/users/assignees`: danh sách tài khoản có thể nhận xử lý.
- `GET/PUT http://localhost:3001/api/incidents/:id/assets`: xem hoặc cập nhật nhiều tài sản liên quan.
- `GET http://localhost:3001/api/reports/summary?from=2026-01-01&to=2026-12-31&region=Duc%20Hoa`: số liệu báo cáo được tổng hợp trực tiếp từ database.

Frontend chờ API tối đa 3,5 giây. Nếu API/database chưa sẵn sàng, bản đồ tự dùng dữ liệu dự phòng và không chặn giao diện.

Sau khi migrate/seed, chạy kiểm tra CRUD và workflow thật với PostGIS:

```powershell
npm --prefix backend run test:db
```

Script tự tạo dữ liệu thử trong database, kiểm tra version/lịch sử và xóa đúng các bản ghi thử khi kết thúc.

## Tải dữ liệu theo vùng bản đồ

Frontend không tải lại toàn bộ tài sản mỗi khi mở bản đồ nền. Sau khi người dùng dừng kéo hoặc zoom 220 ms, ứng dụng gọi:

```text
GET /api/assets?bbox=minLng,minLat,maxLng,maxLat&zoom=12&limit=1000
```

- `bbox` giới hạn kết quả theo vùng đang nhìn và sử dụng spatial index.
- `zoom` từ `0..22`; dưới zoom 15, API dùng `ST_SimplifyPreserveTopology` để giảm số đỉnh.
- Từ zoom 15 trở lên API trả geometry đầy đủ.
- `meta.simplified`, `meta.tolerance` và `meta.total` cho biết mức xử lý và kết quả thực tế.
- `GET /api/assets/:id` luôn trả geometry đầy đủ để xem/cập nhật chính xác.
- Nếu vùng nhìn có hơn 1.000 đối tượng, giao diện yêu cầu phóng to thay vì âm thầm tải khối dữ liệu quá lớn.

## Supabase Auth

Tạo file `.env` ở repository root:

```dotenv
VITE_API_URL=/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Đặt `AUTH_MODE=supabase`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DATABASE_URL` và `DATABASE_SSL=true` trong `backend/.env`. Backend xác minh access token qua JWKS của Supabase. `SUPABASE_SECRET_KEY` phải là khóa server dạng `sb_secret_...`; không đặt khóa này hoặc database password trong `.env` frontend.

Chạy migration/import với connection string lấy từ Supabase **Connect → Direct connection** hoặc **Session pooler**:

```powershell
npm run db:migrate
npm run db:seed
npm run supabase:check
```

Kết quả seed chuẩn hiện tại: 3 nhà máy nước và 416 tuyến ống. Import dùng `asset_code` nguồn làm khóa nên chạy lại không tạo bản ghi trùng. Các tuyến ống CAD được giữ trạng thái chờ kiểm chứng nghiệp vụ.

Sau khi tạo tài khoản trong Supabase Authentication, cấp quyền ứng dụng bằng UUID của tài khoản:

```powershell
npm --prefix backend run user:bootstrap -- --user=<UUID> --name="Quản trị viên" --role=admin
```

- `admin`, `manager`: được thêm/cập nhật tài sản.
- `admin`, `manager`, `technician`: được ghi nhận và chuyển trạng thái sự cố.
- `admin`, `manager`: được phân công người xử lý và xóa ảnh.
- `admin`, `manager`: được escalation thủ công và cập nhật liên kết tài sản.
- Mọi vai trò hợp lệ: được bình luận, xem lịch sử và tải ảnh sự cố.
- Tài khoản chưa có trong `app_users` đăng nhập được ở Supabase nhưng API sẽ từ chối thao tác nghiệp vụ.

Trong môi trường local chưa cấu hình đăng nhập, giữ `AUTH_MODE=disabled`. Khi deploy production phải bật `supabase`.

## Ảnh sự cố

- Bucket mặc định: `incident-attachments`, private.
- Backend tự tạo bucket khi upload đầu tiên bằng secret key.
- Chấp nhận JPG, PNG, WebP; tối đa 8 MB/tệp.
- Database chỉ lưu metadata/path. API tạo URL ký có hiệu lực 1 giờ khi đọc.
- Nếu chưa có `SUPABASE_SECRET_KEY`, ghi nhận và workflow sự cố vẫn chạy nhưng upload trả lỗi cấu hình rõ ràng.

Các endpoint bổ sung:

- `PATCH /api/incidents/:id/assignment`
- `POST /api/incidents/:id/comments`
- `GET/POST /api/incidents/:id/attachments`
- `DELETE /api/incidents/:id/attachments/:attachmentId`
- `GET /api/users/assignees`
- `GET/PUT /api/incidents/:id/assets`
- `POST /api/incidents/:id/escalate`
- `POST /api/incidents/escalations/run`
- `GET /api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&region=`: tổng hợp trạng thái tài sản, mức độ/trạng thái sự cố và chuỗi thời gian thực. `region` là bộ lọc không bắt buộc theo địa chỉ.

## SLA và realtime sự cố

Migration `007_incident_sla_assignees_assets_realtime.sql` tạo chính sách SLA, hạn xử lý, escalation, người nhận xử lý dạng khóa ngoại và quan hệ nhiều-nhiều giữa sự cố với tài sản. Mặc định:

- Mức cao: 4 giờ; escalation cấp tiếp theo sau 1 giờ quá hạn.
- Mức trung bình: 24 giờ; escalation cấp tiếp theo sau 4 giờ quá hạn.
- Mức thấp: 72 giờ; escalation cấp tiếp theo sau 12 giờ quá hạn.

Các giá trị nằm trong bảng `incident_sla_policies` và có thể điều chỉnh bằng dữ liệu cấu hình. Backend chạy bộ kiểm tra SLA mỗi phút, API danh sách sự cố cũng đồng bộ lại mức quá hạn, còn frontend kiểm tra định kỳ một phút làm fallback. Vì vậy escalation vẫn chạy khi không có người dùng đang mở màn hình, miễn là backend đang hoạt động.

Trên Supabase, migration tự thêm `public.incidents` vào publication `supabase_realtime`, bật RLS và chỉ cho tài khoản đang hoạt động trong `app_users` nhận Postgres Changes. Frontend subscribe một channel duy nhất, tự gỡ channel khi rời màn hình và dùng polling một phút làm fallback. Cần cấu hình `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `AUTH_MODE=supabase` và chạy migration trên database Supabase để bật realtime thật.

## Quy ước CRS

- Dữ liệu CAD model-space nguồn: `EPSG:9210`.
- Geometry trong API/PostGIS: `EPSG:4326`.
- Migration ràng buộc SRID 4326 và tạo GiST index.
- Seed nhập nhóm `water_plant` và các tuyến `pipeline` từ output WGS84 đã qua kiểm tra CRS; tuyến tham chiếu vẫn giữ trạng thái chờ kiểm chứng nghiệp vụ.
