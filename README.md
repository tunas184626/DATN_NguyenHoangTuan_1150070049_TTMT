# WebGIS quản lý hạ tầng cấp nước

Hệ thống React + TypeScript + Leaflet, kèm REST API Node.js/Express và PostgreSQL/PostGIS. Dữ liệu CAD model-space đã được kiểm tra theo `EPSG:9210` và xuất bản đồ vận hành ở `EPSG:4326`.

## Chạy frontend

```powershell
npm install
npm run dev
```

Vite tự chuyển tiếp `/api` sang `http://localhost:3001`. Nếu backend chưa sẵn sàng, frontend chờ tối đa 3,5 giây rồi dùng dữ liệu dự phòng để giao diện không bị treo.

`npm run dev` chỉ chạy frontend. Để dùng API, mở terminal thứ hai và chạy `npm run dev:backend`. Lỗi proxy `ECONNREFUSED` nghĩa là Vite chưa kết nối được API ở cổng 3001; kiểm tra `http://localhost:3001/api/health/ready` để xác nhận backend và PostGIS đã sẵn sàng.

Khi dùng CAD/dữ liệu dự phòng, các tài sản và sự cố thêm/sửa được lưu riêng trong trình duyệt và ghép lại với bản đồ sau khi refresh. Các thao tác xử lý sự cố lưu tạm cũng được giữ lại. Giao diện ghi rõ “Lưu trên thiết bị”; nếu trình duyệt không lưu được, form báo lỗi thay vì báo thành công. Bản lưu tạm chưa tự động gửi lên máy chủ khi API hoạt động trở lại. Ảnh đính kèm chỉ được lưu khi tải lên máy chủ thành công.

“Báo sự cố” từ CAD Vector lấy đúng đối tượng/điểm bấm, hoàn lại độ dịch tọa độ hiển thị và chuyển model-space EPSG:9210 sang WGS84. Với ảnh CAD, paper-space/layout hoặc dữ liệu chưa xác minh hệ tọa độ, form yêu cầu chọn điểm trên bản đồ hoặc nhập kinh độ/vĩ độ hợp lệ. Thông tin đối tượng nguồn được giữ cùng sự cố; lựa chọn OSM cũ không được dùng thay cho đối tượng CAD.

Khởi tạo nạp trang đầu cho cả 8 loại tài sản API, gồm hồ nước thô, kênh, khu vực cấp nước, ranh giới, nhãn và đối tượng chờ phân loại. Màn Quản lý tải từng trang 20 bản ghi bằng `limit/offset`, gửi tìm kiếm/bộ lọc lên server và lấy số tổng theo bộ lọc từ `meta.total`. Các thẻ thống kê và số tổng của tab lấy từ `GET /api/operations/summary`, không đếm theo dữ liệu đã tải trên máy. Bản lưu tạm hiển thị riêng; khi không kết nối API, danh sách CAD/demo tiếp tục dùng phân trang local. Danh sách sự cố cho bản đồ tải nối tiếp các trang API, không dừng ở 200 bản ghi.

## Bản đồ xung quanh và tốc độ tải

Ứng dụng mở mặc định ở bản đồ địa lý. Chọn **Đường phố** (OpenStreetMap) hoặc **Vệ tinh** (Esri World Imagery) ở góc phải; **Google Maps ↗** mở đúng khu vực đang xem trong tab mới. Các nền trực tuyến cần Internet. Google Maps nhúng trực tiếp cần API key và bật billing theo [hướng dẫn Google](https://developers.google.com/maps/documentation/javascript/get-api-key); bản đồ hiện tại hoạt động với Leaflet và không cần Google key.

Trong chế độ CAD, **Xem khu vực xung quanh** chuyển sang bản đồ địa lý và bật **CAD đối chiếu**. Lớp này dùng bản xuất WGS84 đã có của các đối tượng nghiệp vụ model-space, vẽ nét vàng đứt để phân biệt với tài sản API. Khi đối tượng CAD đang chọn có tọa độ xác minh được, bản đồ đến vị trí đó; nếu chưa có, bản đồ bao quát lớp CAD đối chiếu. Khung/layout và tọa độ ảnh không ghép trực tiếp lên bản đồ địa lý. Lớp đối chiếu không cộng vào thống kê máy chủ và không thay thế tài sản đang quản lý.

Khởi tạo gọi đồng thời tài sản/sự cố API, chỉ tải CAD dự phòng khi API tài sản lỗi và chỉ dùng demo nếu các nguồn CAD cũng không sẵn sàng. File CAD web khoảng 21 MB chỉ tải khi mở chế độ CAD; file thô khoảng 119 MB không tự tải khi thiếu bản web. Các lượt khởi tạo trùng nhau dùng chung yêu cầu đang chạy. SVG phục vụ in chỉ dựng khi xuất PDF hoặc mở hộp thoại in.

## Thiết lập bản đồ và tiếp nhận sự cố

Nút **Thiết lập** nằm trong thanh công cụ của bản đồ địa lý. **Focus bản đồ** giữ rõ vùng mạng lưới/công trình theo tọa độ dữ liệu và làm mờ nhẹ phần địa lý bên ngoài; lớp tài sản, marker và nút thao tác nằm trên lớp hiệu ứng. **Bình thường** bỏ lớp blur. Thay đổi này chỉ điều chỉnh phần nền của bản đồ; camera, nguồn bản đồ, sidebar và các bảng không tự thay đổi. Lựa chọn được lưu trong trình duyệt và vùng rõ cập nhật theo kéo/zoom. Khi bật CAD đối chiếu, vùng CAD WGS84 cũng được tính vào khu vực giữ rõ.

Phiếu sự cố gồm hai bước **Vị trí & phân loại** và **Hồ sơ tiếp nhận**; yêu cầu vị trí hợp lệ, xác nhận điểm, mốc hiện trường, mô tả và thời điểm phát hiện. Hồ sơ lưu thêm kênh tiếp nhận, ảnh hưởng cấp nước, biện pháp ban đầu và thông tin đối tượng nguồn. Hạn SLA dùng thời điểm thực tế và chính sách máy chủ; bản lưu local chưa có SLA/phân công chính thức. Sau khi lưu, bản đồ mở đúng sự cố với chấm đỏ lan tỏa; đã xử lý thì ký hiệu đứng yên. Hiệu ứng không biểu diễn khoảng cách ảnh hưởng và tôn trọng chế độ giảm chuyển động của hệ thống.

Trong **Quản lý**, tab **Hàng đợi công việc** lọc phía server theo chờ phân công, quá hạn SLA, ưu tiên cao hoặc đang xử lý. Chọn một hồ sơ để phân công, ghi nhật ký, bắt đầu hoặc hoàn tất ngay tại màn quản lý. Bắt đầu xử lý trên server cần người phụ trách; hoàn tất cần kết quả khắc phục; mở lại cần lý do. Khi có xung đột phiên bản, **Tải lại hồ sơ** lấy dữ liệu mới và giữ phần ghi chú đang soạn. Tab tài sản có các bộ lọc cần kiểm tra/bảo trì/chờ bổ sung, cập nhật hồ sơ và báo sự cố đúng tài sản.

## Chất lượng hồ sơ và hiệu quả vận hành

Tab **Chất lượng hồ sơ** trong Quản lý có bốn nhóm: thiếu thông số kỹ thuật, thiếu địa chỉ/mốc hiện trường, cần kiểm tra và bảo trì. Thông số cần có được xác định theo loại tài sản (tuyến ống: đường kính/vật liệu/chiều dài; nhà máy: công suất; hồ: diện tích/dung tích; kênh: chiều dài; khu vực cấp nước: diện tích). Checklist giúp mở đúng hồ sơ để bổ sung. Trường trống và giá trị thay thế như dấu `-` được xem là chưa có dữ liệu; đây là kiểm tra mức đầy đủ hồ sơ, không phải kết quả nghiệm thu thông số. API `/operations/asset-quality` tổng hợp toàn database, `/assets?quality=...` phân trang danh sách theo nhóm; bản chỉnh sửa trên thiết bị hiển thị riêng.

Báo cáo bổ sung tỷ lệ hoàn tất đúng SLA, thời gian khắc phục trung bình, số sự cố mở quá hạn/chưa phân công, phân loại sự cố và ảnh hưởng cấp nước. Các chỉ số thời gian chỉ tính hồ sơ có mốc thời gian thực tế hợp lệ, đồng thời hiển thị số mẫu và dữ liệu còn thiếu. **Sổ chi tiết & CSV** dùng `/reports/incidents` phân trang phía server; CSV tải đủ mọi trang theo bộ lọc, không tạo tệp khi phát hiện số tổng thay đổi hoặc dữ liệu thiếu/trùng. Ngày lọc thống nhất theo giờ Việt Nam (UTC+7); cột thời gian trong CSV dùng UTC và giữ nguyên hồ sơ cũ chỉ có ngày. Bản PDF có cách tính và phạm vi dữ liệu. Trên dữ liệu dự phòng, báo cáo chỉ tính các hồ sơ có trên thiết bị.

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
