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

## Supabase Auth

Đặt `AUTH_MODE=supabase` và `SUPABASE_URL` trong `backend/.env`. Backend xác minh access token qua JWKS của Supabase. Không đặt service-role key hoặc database password trong `.env` của frontend.

Trong môi trường local chưa cấu hình đăng nhập, giữ `AUTH_MODE=disabled`. Khi deploy production phải bật `supabase`.

## Quy ước CRS

- Dữ liệu CAD model-space nguồn: `EPSG:9210`.
- Geometry trong API/PostGIS: `EPSG:4326`.
- Migration ràng buộc SRID 4326 và tạo GiST index.
- Seed chỉ nhập nhóm `water_plant` từ output WGS84 đã qua kiểm tra CRS.
