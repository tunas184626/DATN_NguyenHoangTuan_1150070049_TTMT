# WebGIS quản lý hạ tầng cấp nước

Hệ thống React + TypeScript + Leaflet, kèm REST API Node.js/Express và PostgreSQL/PostGIS. Dữ liệu CAD model-space đã được kiểm tra theo `EPSG:9210` và xuất bản đồ vận hành ở `EPSG:4326`.

## Chạy frontend

```powershell
npm install
npm run dev
```

Vite tự chuyển tiếp `/api` sang `http://localhost:3001`. Nếu backend chưa sẵn sàng, frontend chờ tối đa 3,5 giây rồi dùng dữ liệu dự phòng để giao diện không bị treo.

## Chạy backend và PostGIS

```powershell
Copy-Item backend/.env.example backend/.env
docker compose up -d postgres
npm --prefix backend install
npm run db:migrate
npm run db:seed
npm run dev:backend
```

Kiểm tra:

- `GET http://localhost:3001/api/health/live`
- `GET http://localhost:3001/api/health/ready`
- `GET http://localhost:3001/api/assets?type=water_plant`
- `GET/POST http://localhost:3001/api/incidents`

Hướng dẫn chi tiết: [docs/BACKEND_SETUP.md](docs/BACKEND_SETUP.md).

## Kiểm tra dự án

```powershell
npm run lint
npm run build
npm run verify:crs
npm run validate:cad-vector
npm --prefix backend run lint
npm --prefix backend run build
npm --prefix backend test
npm --prefix backend run test:db
```

## CRS và dữ liệu

- CAD model-space nguồn: `EPSG:9210` — VN-2000 / TM-3 105-45.
- API và PostGIS: `EPSG:4326`.
- Paper-space/layout chỉ dùng tham khảo, không được gán `EPSG:9210`.
- Kết quả kiểm tra: [docs/CRS_VERIFICATION_REPORT.md](docs/CRS_VERIFICATION_REPORT.md).

## Bảo mật

Không commit `.env`, password database hoặc Supabase secret/service-role key. Backend hỗ trợ `AUTH_MODE=supabase` và xác minh access token bằng JWKS; local development mặc định dùng `AUTH_MODE=disabled`.

Để bật đăng nhập:

1. Tạo `.env` từ `.env.example`, điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` lấy từ Supabase **Connect**.
2. Trong `backend/.env`, đặt cùng `SUPABASE_URL`, chuyển `AUTH_MODE=supabase`, đồng thời điền `DATABASE_URL` và `DATABASE_SSL=true`.
3. Trong `backend/.env`, thêm `SUPABASE_SECRET_KEY=sb_secret_...` để backend tạo/quản lý bucket ảnh private. Secret key không được đặt trong `.env` frontend.
4. Chạy migration và import dữ liệu đã chuẩn hóa:

   ```powershell
   npm run db:migrate
   npm run db:seed
   ```

   Seed hiện nhập idempotent 3 nhà máy nước và 416 tuyến ống WGS84. Tuyến ống được đánh dấu `pending_data`/`referenceOnly` cho tới khi nghiệm thu nghiệp vụ.
5. Tạo user tại Supabase Authentication, lấy UUID rồi cấp vai trò:

   ```powershell
   npm --prefix backend run user:bootstrap -- --user=<UUID> --name="Tên người dùng" --role=admin
   ```

Ảnh sự cố được lưu trong bucket private `incident-attachments`, giới hạn 8 MB và chỉ nhận JPG/PNG/WebP. Backend tự tạo bucket ở lần upload đầu tiên và trả URL ký tạm thời, không công khai object URL.

Không bật public signup. Vai trò hỗ trợ: `admin`, `manager`, `technician`.
