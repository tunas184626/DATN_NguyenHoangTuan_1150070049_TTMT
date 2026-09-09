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

Frontend chờ API tối đa 3,5 giây. Nếu API/database chưa sẵn sàng, bản đồ tự dùng dữ liệu dự phòng và không chặn giao diện.

Sau khi migrate/seed, chạy kiểm tra CRUD và workflow thật với PostGIS:

```powershell
npm --prefix backend run test:db
```

Script tự tạo dữ liệu thử trong database, kiểm tra version/lịch sử và xóa đúng các bản ghi thử khi kết thúc.

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

## Quy ước CRS

- Dữ liệu CAD model-space nguồn: `EPSG:9210`.
- Geometry trong API/PostGIS: `EPSG:4326`.
- Migration ràng buộc SRID 4326 và tạo GiST index.
- Seed chỉ nhập nhóm `water_plant` từ output WGS84 đã qua kiểm tra CRS.
