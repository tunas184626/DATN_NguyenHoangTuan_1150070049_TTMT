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

Đặt `AUTH_MODE=supabase`, `SUPABASE_URL`, `DATABASE_URL` và `DATABASE_SSL=true` trong `backend/.env`. Backend xác minh access token qua JWKS của Supabase. Không đặt service-role key hoặc database password trong `.env` của frontend.

Sau khi tạo tài khoản trong Supabase Authentication, cấp quyền ứng dụng bằng UUID của tài khoản:

```powershell
npm --prefix backend run user:bootstrap -- --user=<UUID> --name="Quản trị viên" --role=admin
```

- `admin`, `manager`: được thêm/cập nhật tài sản.
- `admin`, `manager`, `technician`: được ghi nhận và chuyển trạng thái sự cố.
- Tài khoản chưa có trong `app_users` đăng nhập được ở Supabase nhưng API sẽ từ chối thao tác nghiệp vụ.

Trong môi trường local chưa cấu hình đăng nhập, giữ `AUTH_MODE=disabled`. Khi deploy production phải bật `supabase`.

## Quy ước CRS

- Dữ liệu CAD model-space nguồn: `EPSG:9210`.
- Geometry trong API/PostGIS: `EPSG:4326`.
- Migration ràng buộc SRID 4326 và tạo GiST index.
- Seed chỉ nhập nhóm `water_plant` từ output WGS84 đã qua kiểm tra CRS.
