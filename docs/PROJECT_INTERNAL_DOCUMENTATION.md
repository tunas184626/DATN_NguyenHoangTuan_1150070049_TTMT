# TÀI LIỆU DỰ ÁN

# WEBGIS HỆ THỐNG CẤP NƯỚC BIWASE

Hệ thống WebGIS quản lý và trực quan hóa dữ liệu CAD/QGIS phục vụ theo dõi hạ tầng cấp nước, công trình chính, tuyến ống, kênh thủy lợi và dữ liệu bản vẽ liên quan.

---

## Thông tin tài liệu

| Hạng mục | Nội dung |
| --- | --- |
| Loại tài liệu | Tài liệu nội bộ mô tả dự án, kiến trúc, dữ liệu, chức năng và quy trình vận hành |
| Tên dự án | WebGIS hệ thống cấp nước BIWASE |
| Thư mục dự án | `C:\BCTT_NguyenHoangTuan_1150070049_TTMT` |
| Nền tảng | React, TypeScript, Vite, Leaflet, React Leaflet, Tailwind CSS |
| Dữ liệu chính | CAD/DWG được chuyển đổi sang GeoJSON và chuẩn hóa thành CAD Vector |
| Phiên bản tài liệu | 1.0 |
| Ngày cập nhật | 02/06/2026 |
| Remote GitHub | `https://github.com/tunas184626/BCTT_NguyenHoangTuan_1150070049_TTMT.git` |
| Nhánh chính | `main` |

---

## Mục lục nội dung

1. Giới thiệu chung
2. Mục tiêu và phạm vi dự án
3. Thông tin repository
4. Cấu trúc thư mục
5. Công nghệ sử dụng
6. Kiến trúc tổng quan
7. Luồng dữ liệu CAD Vector
8. Nguồn dữ liệu và file đầu vào
9. Các module chức năng chính
10. Mô tả giao diện người dùng
11. Cơ chế hiển thị bản đồ và layer
12. Cơ chế tìm kiếm và xem chi tiết đối tượng
13. Quản lý sự cố và dữ liệu localStorage
14. Báo cáo, thống kê và xuất PDF
15. Quy trình chạy dự án
16. Quy trình xử lý dữ liệu CAD/DWG
17. Kiểm thử, build và validate dữ liệu
18. Quy ước phát triển nội bộ
19. Các giới hạn hiện tại
20. Hướng phát triển tiếp theo
21. Gợi ý bố cục báo cáo/thuyết minh

---

## 1. Giới thiệu chung

WebGIS hệ thống cấp nước BIWASE là ứng dụng bản đồ web dùng để trực quan hóa dữ liệu hạ tầng cấp nước và dữ liệu bản vẽ CAD đã được chuyển đổi sang GeoJSON. Dự án tập trung vào việc đưa dữ liệu kỹ thuật từ bản vẽ DWG/DXF/QGIS lên giao diện WebGIS để người dùng có thể xem, lọc, tra cứu, kiểm tra và trình bày dữ liệu hạ tầng một cách trực quan.

Ứng dụng được xây dựng bằng React, TypeScript và Vite, kết hợp Leaflet/React Leaflet để hiển thị bản đồ. Dữ liệu chính của hệ thống là CAD Vector nằm trong thư mục `public/data/cad-vector/`. Các dữ liệu này được tạo ra từ quy trình chuyển đổi bản vẽ CAD sang GeoJSON, sau đó được chuẩn hóa bằng script Node.js để phục vụ hiển thị trên frontend.

Khác với một hệ thống WebGIS chỉ dùng ảnh nền tĩnh, dự án này ưu tiên dữ liệu vector thật. Điều đó có nghĩa là mỗi tuyến ống, công trình, nhãn đường kính, kênh thủy lợi hoặc đối tượng CAD đều có thể được render, chọn, lọc và xem thuộc tính. Ảnh CAD/PNG và OpenStreetMap chỉ đóng vai trò tham chiếu phụ, không phải dữ liệu nghiệp vụ chính.

Mục tiêu của dự án là hỗ trợ quá trình báo cáo, trình bày và kiểm tra dữ liệu cấp nước thông qua một giao diện WebGIS dễ sử dụng, có khả năng đọc dữ liệu CAD/QGIS và phân nhóm layer theo nghiệp vụ.

---

## 2. Mục tiêu và phạm vi dự án

### 2.1 Mục tiêu chính

- Xây dựng giao diện WebGIS để hiển thị dữ liệu hạ tầng cấp nước từ CAD/QGIS.
- Chuyển đổi dữ liệu bản vẽ DWG/DXF sang GeoJSON để frontend có thể đọc được.
- Chuẩn hóa các đối tượng CAD thành các nhóm nghiệp vụ như nhà máy nước, hồ nước thô, tuyến ống, kênh thủy lợi, ranh giới và nhãn CAD.
- Cho phép người dùng lọc, bật/tắt layer, chọn đối tượng và xem thông tin chi tiết.
- Làm nổi bật các công trình chính phục vụ báo cáo: nhà máy nước và hồ nước thô.
- Hỗ trợ xuất khung bản đồ hiện tại sang PDF để dùng trong báo cáo/demo.
- Cung cấp tài liệu hướng dẫn sử dụng, hướng dẫn import DWG và tài liệu nội bộ phục vụ bảo trì dự án.

### 2.2 Phạm vi chức năng

Phạm vi hiện tại của dự án bao gồm:

- Bản đồ CAD Vector dùng dữ liệu GeoJSON đã chuẩn hóa.
- Bản đồ ảnh CAD tham chiếu.
- Layout preview dùng để đối chiếu bản vẽ gốc.
- OpenStreetMap tham khảo.
- Sidebar quản lý layer và bộ lọc.
- Topbar tìm kiếm đối tượng.
- Panel chi tiết đối tượng.
- Công cụ cập nhật vị trí công trình chính trên bản đồ CAD.
- Quản lý dữ liệu demo/localStorage như thêm đối tượng, báo sự cố và reset dữ liệu.
- Báo cáo thống kê cơ bản bằng biểu đồ.
- Validate dữ liệu GeoJSON/CAD Vector bằng script.

### 2.3 Ngoài phạm vi hiện tại

Dự án hiện chưa bao gồm:

- Backend API riêng.
- Cơ sở dữ liệu server như PostgreSQL/PostGIS hoặc SQL Server.
- Đăng nhập, phân quyền người dùng.
- Lưu thay đổi người dùng lên server.
- Parse trực tiếp file DWG trong frontend.
- Đồng bộ dữ liệu realtime.

Các thao tác thêm/sửa đối tượng và tạo sự cố hiện được lưu tạm trong `localStorage` của trình duyệt để phục vụ demo.

---

## 3. Thông tin repository

| Hạng mục | Nội dung |
| --- | --- |
| Thư mục local | `C:\BCTT_NguyenHoangTuan_1150070049_TTMT` |
| Remote GitHub | `https://github.com/tunas184626/BCTT_NguyenHoangTuan_1150070049_TTMT.git` |
| Nhánh chính | `main` |
| Trình quản lý package | npm |
| Entry frontend | `src/main.tsx` |
| Component chính | `src/App.tsx` |
| Service dữ liệu CAD Vector | `src/services/cadVectorDataService.ts` |
| Dữ liệu CAD Vector public | `public/data/cad-vector/` |
| Dữ liệu nguồn CAD | `source-data/cad/` |
| GeoJSON thô sau chuyển đổi | `source-data/converted/geojson/` |

Repository có sử dụng Git LFS cho các file GeoJSON lớn. Khi clone project trên máy mới cần chạy `git lfs install` và `git lfs pull` để tải đủ dữ liệu.

---

## 4. Cấu trúc thư mục

```text
BCTT_NguyenHoangTuan_1150070049_TTMT/
├── docs/
│   ├── CAD_LAYER_MAPPING.md              # Mapping layer CAD sang nhóm WebGIS
│   ├── DWG_IMPORT_GUIDE.md               # Hướng dẫn import DWG/DXF qua QGIS
│   ├── USER_GUIDE.md                     # Hướng dẫn sử dụng app cho người dùng
│   └── PROJECT_INTERNAL_DOCUMENTATION.md # Tài liệu nội bộ dự án
├── public/
│   ├── data/
│   │   ├── biwase/                       # GeoJSON theo schema WebGIS cũ/dự phòng
│   │   └── cad-vector/                   # Dữ liệu CAD Vector chính
│   ├── maps/                             # Ảnh và layout CAD tham chiếu
│   ├── favicon.svg
│   └── icons.svg
├── scripts/
│   ├── normalize-cad-geojson.js          # Chuẩn hóa GeoJSON theo nhóm BIWASE
│   ├── normalize-cad-vector.js           # Chuẩn hóa CAD Vector từ GeoJSON thô
│   ├── validate-cad-vector.js            # Kiểm tra output CAD Vector
│   └── validate-geojson.js               # Kiểm tra GeoJSON dự phòng
├── source-data/
│   ├── cad/                              # File DWG nguồn
│   └── converted/geojson/                # GeoJSON thô export từ QGIS
├── src/
│   ├── assets/                           # Hình ảnh và asset frontend
│   ├── components/
│   │   ├── layout/                       # Component giao diện chung
│   │   └── map/                          # Các component bản đồ
│   ├── data/                             # Dữ liệu demo và cấu hình công trình chính
│   ├── hooks/                            # Custom hooks
│   ├── services/                         # Service load dữ liệu
│   ├── types/                            # TypeScript types
│   ├── utils/                            # Hàm tiện ích
│   ├── App.tsx                           # Component ứng dụng chính
│   ├── App.css                           # Style bổ sung cho App
│   ├── index.css                         # Tailwind/global CSS
│   └── main.tsx                          # Entry render React
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

Một số thư mục con như `src/components/dashboard`, `src/components/forms`, `src/components/sidebar`, `src/components/incidents` đang tồn tại để phục vụ định hướng tách module trong tương lai. Hiện tại nhiều logic giao diện vẫn tập trung trong `src/App.tsx` và các component bản đồ trong `src/components/map/`.

---

## 5. Công nghệ sử dụng

### 5.1 Frontend framework

- React 19: xây dựng giao diện người dùng dạng component.
- TypeScript: tăng tính an toàn kiểu dữ liệu, đặc biệt với GeoJSON và schema CAD Vector.
- Vite 8: dev server, build production và tối ưu bundle.

### 5.2 Bản đồ và GIS

- Leaflet: thư viện bản đồ chính.
- React Leaflet: tích hợp Leaflet với React.
- GeoJSON: định dạng dữ liệu vector dùng để render đối tượng bản đồ.
- Leaflet CRS.Simple: dùng cho dữ liệu CAD Vector theo hệ tọa độ kỹ thuật/nội bộ, không phải nền địa lý chuẩn.

### 5.3 Giao diện và biểu đồ

- Tailwind CSS: style layout, màu sắc, spacing và responsive UI.
- Lucide React: icon trong nút, panel, trạng thái và công cụ.
- Recharts: biểu đồ báo cáo/thống kê.

### 5.4 Công cụ dữ liệu

- Node.js script: normalize và validate dữ liệu GeoJSON.
- Git LFS: lưu trữ file GeoJSON lớn vượt giới hạn GitHub thông thường.
- QGIS/AutoCAD/DWG TrueView: công cụ ngoài dùng để chuyển đổi DWG/DXF sang GeoJSON.

---

## 6. Kiến trúc tổng quan

Dự án hiện là một ứng dụng frontend chạy độc lập. Ứng dụng không cần backend để chạy bản demo vì dữ liệu được đặt trong thư mục `public/` và được trình duyệt fetch trực tiếp.

Luồng kiến trúc tổng quát:

```text
File DWG/DXF nguồn
        ↓
QGIS export GeoJSON thô
        ↓
source-data/converted/geojson/
        ↓
npm run normalize:cad-vector
        ↓
public/data/cad-vector/
        ↓
React + Leaflet đọc GeoJSON
        ↓
Người dùng xem bản đồ, lọc layer, tra cứu và xuất PDF
```

Các lớp chính trong frontend:

1. Lớp dữ liệu: chịu trách nhiệm đọc GeoJSON, metadata và index layer từ `public/data/cad-vector/`.
2. Lớp xử lý/chuẩn hóa hiển thị: phân nhóm layer, lọc đối tượng, xác định style, tính toán thống kê.
3. Lớp giao diện: sidebar, topbar, map panel, detail panel, form quản lý dữ liệu và báo cáo.
4. Lớp lưu tạm: sử dụng `localStorage` cho các thao tác demo như cập nhật vị trí công trình chính, thêm đối tượng và tạo sự cố.

---

## 7. Luồng dữ liệu CAD Vector

### 7.1 File dữ liệu chính

Dữ liệu CAD Vector nằm trong:

```text
public/data/cad-vector/
```

Các file chính:

| File | Vai trò |
| --- | --- |
| `web-map.geojson` | Dữ liệu tối ưu dùng để render bản đồ WebGIS |
| `entities.geojson` | Toàn bộ đối tượng CAD Vector, dùng làm fallback hoặc tra cứu đầy đủ |
| `points.geojson` | Nhóm đối tượng điểm |
| `lines.geojson` | Nhóm đối tượng đường/tuyến |
| `polygons.geojson` | Nhóm đối tượng vùng |
| `irrigation.geojson` | Nhóm dữ liệu kênh/thủy lợi |
| `main-works.geojson` | Nhóm công trình chính |
| `layer-index.json` | Danh sách layer CAD, số lượng feature và kiểu suy luận |
| `business-layer-index.json` | Index theo nhóm nghiệp vụ |
| `cad-vector-metadata.json` | Metadata tổng hợp của dữ liệu CAD Vector |

### 7.2 Service đọc dữ liệu

Service chính là `src/services/cadVectorDataService.ts`.

Chức năng của service:

- Gọi `fetch` đến `/data/cad-vector/`.
- Đọc `web-map.geojson`, `layer-index.json`, `business-layer-index.json` và `cad-vector-metadata.json`.
- Nếu `web-map.geojson` không hợp lệ thì fallback sang `entities.geojson`.
- Tách nhanh dữ liệu `irrigation` và `mainWorks` dựa trên `sourceGroup`.
- Trả về object `CadVectorData` cho App sử dụng.

### 7.3 Nguyên tắc dữ liệu

- Frontend không parse DWG trực tiếp.
- DWG/DXF chỉ là dữ liệu nguồn.
- QGIS hoặc công cụ CAD chịu trách nhiệm export dữ liệu sang GeoJSON.
- Script Node.js chịu trách nhiệm normalize schema và phân loại đối tượng.
- Frontend chỉ đọc GeoJSON đã chuẩn hóa.

---

## 8. Nguồn dữ liệu và file đầu vào

### 8.1 Nguồn CAD/DWG

Các dữ liệu nguồn chính gồm:

- `BIWASE_HIEN TRANG.dwg`: dữ liệu CAD hiện trạng.
- `HTCN PMV.dwg`: dữ liệu công trình chính.
- `Ban do khu tuoi duc hoa cap nhat moi 19 7 2014.dwg`: dữ liệu kênh/thủy lợi.

Trong repository hiện có file:

```text
source-data/cad/BIWASE_HIEN TRANG.dwg
```

### 8.2 GeoJSON thô

GeoJSON thô sau khi export từ QGIS đặt tại:

```text
source-data/converted/geojson/
```

Các nhóm dữ liệu thường gặp:

- `cad_*.geojson`: nền CAD hiện trạng, tuyến ống, đường nền, điểm và nhãn CAD.
- `cong_trinh_chinh_*.geojson`: dữ liệu nhà máy nước, hồ nước thô và công trình chính.
- `kenh_thuy_loi_*.geojson`: dữ liệu kênh, vùng tưới và điểm thủy lợi.

Các file `.qmd`, `README.md` hoặc file không phải `.geojson` không được dùng làm dữ liệu render chính.

### 8.3 Dữ liệu demo/dự phòng

Ngoài CAD Vector, dự án còn có các file demo trong `src/data/` và dữ liệu BIWASE trong `public/data/biwase/`. Nhóm này phục vụ chế độ dự phòng hoặc chế độ bản đồ hệ thống theo schema cũ.

---

## 9. Các module chức năng chính

### 9.1 Module CAD Vector Map

File chính:

```text
src/components/map/CadVectorMap.tsx
```

Chức năng:

- Render dữ liệu CAD Vector bằng Leaflet.
- Dùng `CRS.Simple` để hiển thị dữ liệu theo hệ tọa độ CAD.
- Phân nhóm render như tuyến ống, hồ nước thô, nhà máy nước, kênh thủy lợi, ranh giới, nhãn CAD, nền CAD.
- Áp dụng style theo loại đối tượng và chế độ nền.
- Hỗ trợ chọn đối tượng, hover tooltip, zoom tới đối tượng và fit bản đồ.
- Hỗ trợ xuất PDF bằng `window.print` và SVG print layer.

### 9.2 Module chú giải CAD

File chính:

```text
src/components/map/CadLegend.tsx
```

Chức năng:

- Hiển thị chú giải màu sắc cho các nhóm đối tượng.
- Đồng bộ màu với bản đồ CAD Vector.
- Cho phép ẩn/hiện chú giải.
- Thay đổi màu theo visual mode nếu cần.

### 9.3 Module ảnh CAD tham chiếu

File chính:

```text
src/components/map/CadBlueprintMap.tsx
```

Chức năng:

- Hiển thị ảnh CAD/PNG như một lớp tham chiếu.
- Cho phép chọn các asset được cấu hình thủ công.
- Hỗ trợ cập nhật vị trí điểm trên ảnh CAD trong chế độ demo.

### 9.4 Module layout preview

File chính:

```text
src/components/map/CadLayoutPreview.tsx
```

Chức năng:

- Hiển thị layout hoặc khung bản vẽ gốc.
- Dùng để đối chiếu bản vẽ, title block, viewport hoặc layout CAD.
- Không phải dữ liệu vector nghiệp vụ chính.

### 9.5 Module quản lý dữ liệu WebGIS

File chính:

```text
src/App.tsx
src/hooks/useWebGISData.ts
src/data/dataService.ts
```

Chức năng:

- Load dữ liệu demo/dự phòng.
- Quản lý layer thông thường như nhà máy nước, hồ nước thô, tuyến ống, kênh, vùng cấp nước, ranh giới, nhãn và sự cố.
- Thêm/sửa đối tượng demo.
- Tạo điểm sự cố.
- Reset dữ liệu về trạng thái ban đầu.

### 9.6 Module công trình chính chuẩn hóa

File chính:

```text
src/data/curatedMainWorks.ts
```

Hiện tại dự án có 4 công trình chính được cấu hình để làm nổi bật:

| Mã | Tên hiển thị | Loại |
| --- | --- | --- |
| `curated-nmn-hoa-khanh-tay` | NMN Hoa Khanh Tay | Nhà máy nước |
| `curated-nmn-duc-hoa-3` | NMN Duc Hoa 3 | Nhà máy nước |
| `curated-ho-7ha-hau-nghia` | Ho nuoc tho 7ha xa Hau Nghia | Hồ nước thô |
| `curated-ho-13ha-my-hanh` | Ho nuoc tho 13ha xa My Hanh | Hồ nước thô |

Các công trình này có thể được cập nhật vị trí thủ công trên bản đồ CAD Vector. Vị trí cập nhật được lưu trong `localStorage` để phục vụ demo.

---

## 10. Mô tả giao diện người dùng

Giao diện chính gồm 4 vùng:

### 10.1 Topbar

Topbar nằm ở phía trên, hiển thị:

- Tên hệ thống WebGIS.
- Badge trạng thái dữ liệu CAD Vector.
- Ô tìm kiếm đối tượng.
- Nhãn chế độ bản đồ hệ thống.

Ô tìm kiếm cho phép tìm theo tên đối tượng, ID, layer CAD, nhãn đường kính, địa danh hoặc text gốc trong properties.

### 10.2 Sidebar bên trái

Sidebar dùng để điều khiển dữ liệu hiển thị:

- Chọn chế độ xem nghiệp vụ.
- Bật/tắt các lớp nghiệp vụ chính.
- Bật/tắt nhãn CAD.
- Lọc dữ liệu CAD thô/nâng cao.
- Xem danh sách đối tượng đang hiển thị.
- Chọn công trình chính chuẩn hóa.
- Chuyển sang bản đồ CAD Vector, ảnh CAD, layout preview hoặc OpenStreetMap.

### 10.3 Khu vực bản đồ

Khu vực trung tâm hiển thị bản đồ. Tùy chế độ, khu vực này có thể hiển thị:

- CAD Vector Map.
- CAD Blueprint Map.
- Layout Preview.
- OpenStreetMap.
- Báo cáo.
- Màn hình quản lý dữ liệu.

### 10.4 Panel chi tiết bên phải

Panel bên phải hiển thị thông tin của đối tượng đang được chọn:

- Thông tin chính.
- Loại đối tượng.
- Layer CAD.
- Nguồn dữ liệu.
- Geometry.
- Text CAD hợp lệ.
- Thông tin CAD gốc.
- Nút copy properties.
- Nút báo sự cố.
- Nút cập nhật vị trí nếu là công trình chính chuẩn hóa.

---

## 11. Cơ chế hiển thị bản đồ và layer

### 11.1 Chế độ xem nghiệp vụ

Trong CAD Vector, người dùng có thể chọn 4 preset:

| Preset | Mục đích |
| --- | --- |
| Tổng quan | Hiển thị các nhóm chính: công trình chính, tuyến ống, kênh thủy lợi và nền CAD |
| Nhà máy nước | Tập trung vào nhà máy nước, có tuyến ống và nền CAD tham chiếu |
| Hồ nước thô | Tập trung vào hồ nước thô và dữ liệu liên quan |
| Kênh thủy lợi | Tập trung vào hệ thống kênh/thủy lợi |

Khi đổi preset, app tự động điều chỉnh layer visible, label options và vùng fit bản đồ.

### 11.2 Nhóm layer nghiệp vụ

Các nhóm layer chính gồm:

- Công trình chính chuẩn hóa.
- HTCN PMV tham chiếu.
- Dữ liệu layout/khung bản vẽ.
- Nhà máy nước.
- Hồ nước thô.
- Hệ thống kênh thủy lợi.
- Tuyến ống cấp nước.
- Nhãn đường kính ống.
- Ranh giới/khu vực.
- Đường giao thông/nền bản đồ.
- Layer chưa phân loại.

### 11.3 Màu sắc layer

Màu sắc hiện tại được thiết kế để tránh trùng màu giữa các nhóm chính:

| Nhóm | Màu đại diện |
| --- | --- |
| Nhà máy nước | Cam |
| Hồ nước thô | Tím |
| Tuyến ống cấp nước | Xanh dương |
| Kênh/thủy lợi | Xanh lá |
| Nền CAD gốc | Xám |
| Nhãn đường kính | Tím đậm/xám tím |

Màu được cấu hình trong `src/components/map/CadVectorMap.tsx`, `src/components/map/CadLegend.tsx` và `src/utils/asset.ts`.

### 11.4 Nhãn CAD

Hệ thống hỗ trợ các tùy chọn nhãn:

- Hiện nhãn công trình chính.
- Hiện nhãn đường kính.
- Ẩn text lỗi font.
- Có thể mở rộng thêm nhãn địa danh, nhãn kênh hoặc toàn bộ nhãn CAD.

Do dữ liệu CAD có thể bị lỗi mã hóa sau khi chuyển từ DWG/DXF, tùy chọn ẩn text lỗi font giúp bản đồ sạch và dễ đọc hơn.

---

## 12. Cơ chế tìm kiếm và xem chi tiết đối tượng

### 12.1 Tìm kiếm

Tìm kiếm được thực hiện từ ô input trên topbar. Người dùng có thể tìm theo:

- Tên công trình.
- Mã ID.
- Layer CAD.
- Nhãn đường kính như OD315, OD630, D500.
- Địa danh hoặc text trong properties.
- Nhóm nghiệp vụ hoặc loại đối tượng.

Khi chọn kết quả tìm kiếm, app sẽ:

1. Chuyển về đúng chế độ bản đồ nếu cần.
2. Bật lại layer chứa đối tượng nếu layer đang bị ẩn.
3. Cập nhật đối tượng selected.
4. Tăng `focusVersion` để bản đồ zoom/focus đến đối tượng.
5. Hiển thị thông tin chi tiết ở panel phải.

### 12.2 Xem chi tiết CAD Vector

Đối với đối tượng CAD Vector, panel chi tiết hiển thị:

- ID.
- Loại đối tượng.
- Nhóm nghiệp vụ.
- Nguồn file.
- Layer CAD.
- Text hợp lệ.
- Đường kính nếu là nhãn OD/D.
- PaperSpace/CAD space.
- SubClasses, Linetype, EntityHandle.
- Geometry.
- Nguồn dữ liệu.
- Source file.
- Thông tin CAD gốc dạng key-value.

Người dùng có thể bấm `Copy thông tin` để copy toàn bộ properties của đối tượng dưới dạng JSON.

---

## 13. Quản lý sự cố và dữ liệu localStorage

### 13.1 Tạo điểm sự cố

Người dùng có thể tạo sự cố từ panel chi tiết hoặc từ màn hình quản lý. Form sự cố gồm:

- Tên sự cố.
- Mã sự cố.
- Loại sự cố.
- Mức độ.
- Trạng thái xử lý.
- Ngày ghi nhận.
- Vị trí.
- Mô tả.
- Latitude/Longitude.
- URL hình ảnh.
- Google Maps URL.
- Ghi chú.

### 13.2 Cập nhật thông tin đối tượng

Ở chế độ dữ liệu dự phòng hoặc bản đồ hệ thống, người dùng có thể thêm hoặc cập nhật đối tượng hạ tầng. Các thông tin gồm tên, loại, trạng thái, địa chỉ, mô tả, công suất, diện tích, dung tích, vật liệu, đường kính, chiều dài, hình ảnh, Google Maps URL, ghi chú và tọa độ.

### 13.3 Lưu trữ tạm trong localStorage

Các thao tác demo được lưu trong `localStorage`, gồm:

- Thêm/sửa đối tượng.
- Tạo sự cố.
- Cập nhật vị trí công trình chính.
- Một số trạng thái giao diện như layer visible.

Điều này giúp người dùng refresh trang vẫn giữ dữ liệu demo, nhưng dữ liệu không được ghi ngược vào file GeoJSON trong source code.

---

## 14. Báo cáo, thống kê và xuất PDF

### 14.1 Dashboard cards

Khu vực dashboard hiển thị thống kê nhanh:

- Số đối tượng hiển thị.
- Tổng số layer CAD.
- Số tuyến ống cấp nước.
- Số kênh/thủy lợi.
- Số nhà máy nước.
- Số hồ nước thô.

Trong chế độ bản đồ hệ thống/dự phòng, dashboard có thể hiển thị số nhà máy nước, hồ nước thô, tuyến ống/kênh, điểm cần kiểm tra và tổng chiều dài ống.

### 14.2 Báo cáo biểu đồ

Module báo cáo sử dụng Recharts để hiển thị:

- Phân bố trạng thái tài sản.
- Mức độ nghiêm trọng sự cố.
- Xu hướng sự cố và bảo trì dạng mô phỏng.

### 14.3 Xuất PDF

Trong CAD Vector Map, người dùng bấm `Xuất PDF` để gọi `window.print`. Khi in, app dùng CSS print và SVG map frame để tạo bản in có:

- Tiêu đề bản đồ WebGIS hệ thống cấp nước.
- Chế độ xem hiện tại.
- Thời gian xuất.
- Số feature hiển thị.
- Khung bản đồ.
- Chú giải.
- Nguồn dữ liệu.
- Quy trình DWG -> DXF -> QGIS -> GeoJSON -> CAD Vector WebGIS.

---

## 15. Quy trình chạy dự án

### 15.1 Yêu cầu môi trường

- Node.js 20.19+, 22.12+ hoặc mới hơn.
- npm.
- Git LFS nếu clone từ GitHub.

Kiểm tra:

```bash
node -v
npm -v
git lfs version
```

### 15.2 Clone và tải dữ liệu LFS

```bash
git clone https://github.com/tunas184626/BCTT_NguyenHoangTuan_1150070049_TTMT.git
cd BCTT_NguyenHoangTuan_1150070049_TTMT
git lfs install
git lfs pull
```

### 15.3 Cài dependencies

```bash
npm install
```

### 15.4 Chạy development server

```bash
npm run dev
```

Script `dev` đã được cấu hình là `vite --open`, vì vậy khi chạy lệnh này Vite sẽ tự mở trình duyệt mặc định ở địa chỉ local, thường là:

```text
http://localhost:5173/
```

### 15.5 Build production

```bash
npm run build
```

Output build nằm trong thư mục `dist/`.

---

## 16. Quy trình xử lý dữ liệu CAD/DWG

### 16.1 Quy trình tổng quát

```text
DWG/DXF nguồn
        ↓
Mở bằng QGIS hoặc convert qua DXF nếu cần
        ↓
Export từng layer hoặc nhóm layer sang GeoJSON
        ↓
Đặt GeoJSON thô vào source-data/converted/geojson/
        ↓
Chạy normalize
        ↓
Validate output
        ↓
Frontend đọc public/data/cad-vector/
```

### 16.2 Chạy normalize CAD Vector

```bash
npm run normalize:cad-vector
```

Script này có nhiệm vụ:

- Đọc GeoJSON thô.
- Chuẩn hóa properties.
- Phân loại đối tượng theo source group, layer CAD và kiểu hình học.
- Sinh các file output trong `public/data/cad-vector/`.
- Tạo metadata và index layer.

### 16.3 Chạy validate CAD Vector

```bash
npm run validate:cad-vector
```

Script validate kiểm tra:

- File output có tồn tại không.
- Dữ liệu có đúng `FeatureCollection` không.
- Feature có geometry và properties không.
- Layer index và metadata có đúng cấu trúc không.
- Các nhóm dữ liệu chính có thể được đọc bởi frontend không.

### 16.4 Mapping layer CAD

Mapping cơ bản được mô tả trong `docs/CAD_LAYER_MAPPING.md`.

Nguyên tắc:

- Không xóa dữ liệu chưa phân loại.
- Giữ lại layer gốc để truy vết.
- Text/MTEXT được giữ làm nhãn hoặc thông tin gốc.
- Geometry gốc được giữ, script chủ yếu chuẩn hóa properties.
- Các đối tượng chưa rõ loại được đưa vào nhóm pending/unknown hoặc layer chưa phân loại.

---

## 17. Kiểm thử, build và validate dữ liệu

### 17.1 Các lệnh kiểm tra chính

| Lệnh | Mục đích |
| --- | --- |
| `npm run build` | Kiểm tra TypeScript và build production |
| `npm run lint` | Chạy ESLint |
| `npm run validate:geojson` | Validate GeoJSON theo schema BIWASE/dự phòng |
| `npm run validate:cad-vector` | Validate dữ liệu CAD Vector |

### 17.2 Trạng thái hiện tại

Build production đã chạy thành công trong quá trình phát triển gần nhất. Khi build, Vite có thể cảnh báo chunk JavaScript lớn hơn 500 kB. Đây là cảnh báo tối ưu bundle, không phải lỗi build.

ESLint hiện có một số lỗi rule nghiêm ngặt liên quan đến:

- Regex chứa control character.
- Gọi `Math.random` trong render state initializer.
- Set state trực tiếp trong effect theo rule React mới.
- Fast refresh warning khi file export cả component và helper.

Các lỗi lint này không ngăn ứng dụng chạy hoặc build, nhưng nên được xử lý nếu muốn chuẩn hóa chất lượng code.

---

## 18. Quy ước phát triển nội bộ

### 18.1 Quy ước dữ liệu

- Không parse DWG trực tiếp trong frontend.
- Dữ liệu CAD phải được chuyển sang GeoJSON trước khi đưa vào app.
- Output chính của CAD Vector đặt trong `public/data/cad-vector/`.
- Dữ liệu thô đặt trong `source-data/converted/geojson/`.
- File GeoJSON lớn cần được theo dõi bằng Git LFS.
- Không đưa `node_modules` hoặc `dist` lên Git.

### 18.2 Quy ước giao diện

- CAD Vector là chế độ dữ liệu chính.
- PNG/ảnh CAD là tham chiếu, không dùng làm dữ liệu nghiệp vụ chính.
- Màu layer cần đủ khác nhau giữa các nhóm chính.
- Nền CAD nên mờ để không che đối tượng nghiệp vụ.
- Nhãn lỗi font nên ẩn mặc định để tránh rối bản đồ.

### 18.3 Quy ước code

- TypeScript types đặt trong `src/types/gis.ts`.
- Logic load dữ liệu đặt trong `src/services/` hoặc `src/data/`.
- Helper xử lý text, metrics, features đặt trong `src/utils/`.
- Component bản đồ đặt trong `src/components/map/`.
- Khi thêm layer hoặc type mới, cần cập nhật đồng bộ: type, style map, legend, filter, layer grouping và validate script nếu cần.

---

## 19. Các giới hạn hiện tại

### 19.1 Giới hạn về kiến trúc

- Dự án chưa có backend API.
- Dữ liệu chỉnh sửa trên giao diện chưa được lưu vào server.
- localStorage chỉ phù hợp demo, không phù hợp vận hành thật nhiều người dùng.
- Chưa có phân quyền người dùng.

### 19.2 Giới hạn về dữ liệu

- Độ chính xác vị trí phụ thuộc vào quá trình export/convert từ CAD sang QGIS.
- Một số text CAD có thể bị lỗi font hoặc lỗi mã hóa.
- Một số layer CAD chưa được phân loại hoàn toàn.
- Nếu thiếu Git LFS, dữ liệu lớn có thể không được tải đủ sau khi clone.

### 19.3 Giới hạn về hiệu năng

- Dữ liệu CAD Vector lớn có thể ảnh hưởng thời gian tải và render.
- Bundle frontend hiện có cảnh báo kích thước chunk lớn.
- Khi bật quá nhiều layer thô và nhãn CAD, bản đồ có thể bị rối hoặc giảm hiệu năng.

---

## 20. Hướng phát triển tiếp theo

Các hướng phát triển đề xuất:

1. Tách nhỏ `src/App.tsx` thành các module riêng: sidebar, detail panel, dashboard, forms, reports.
2. Bổ sung backend API để lưu dữ liệu đối tượng, sự cố và vị trí công trình chính.
3. Tích hợp database GIS như PostgreSQL/PostGIS nếu cần vận hành thực tế.
4. Xây dựng module đăng nhập và phân quyền người dùng.
5. Tối ưu render CAD Vector bằng clustering, canvas renderer hoặc vector tile nếu dữ liệu tiếp tục tăng.
6. Tối ưu bundle bằng dynamic import/code splitting.
7. Chuẩn hóa lại text CAD lỗi font trong pipeline convert.
8. Bổ sung bộ test tự động cho normalize script và validate script.
9. Bổ sung export dữ liệu đã chỉnh sửa từ localStorage ra file GeoJSON hoặc JSON chuẩn.
10. Tạo dashboard báo cáo nâng cao theo nhóm công trình, trạng thái sự cố và chiều dài tuyến.

---

## 21. Gợi ý bố cục báo cáo/thuyết minh

Nếu dùng nội dung này để làm báo cáo hoặc tài liệu thuyết minh, có thể sắp xếp theo bố cục sau:

1. Trang bìa.
2. Nhận xét/xác nhận nếu cần.
3. Mục lục.
4. Giới thiệu đề tài.
5. Mục tiêu và phạm vi.
6. Cơ sở lý thuyết: WebGIS, CAD, GeoJSON, Leaflet.
7. Phân tích yêu cầu.
8. Thiết kế hệ thống.
9. Thiết kế dữ liệu.
10. Thiết kế giao diện.
11. Cài đặt chức năng.
12. Quy trình chuyển đổi dữ liệu DWG -> GeoJSON.
13. Kiểm thử và đánh giá.
14. Kết luận.
15. Hướng phát triển.
16. Phụ lục: lệnh chạy, cấu trúc thư mục, mapping layer.

---

## Phụ lục A. Danh sách lệnh thường dùng

```bash
# Cài dependency
npm install

# Chạy dev server và tự mở trình duyệt
npm run dev

# Build production
npm run build

# Lint source code
npm run lint

# Normalize dữ liệu CAD Vector
npm run normalize:cad-vector

# Validate dữ liệu CAD Vector
npm run validate:cad-vector

# Normalize dữ liệu GeoJSON BIWASE/dự phòng
npm run normalize:cad

# Validate dữ liệu GeoJSON BIWASE/dự phòng
npm run validate:geojson
```

---

## Phụ lục B. Các file quan trọng

| File | Vai trò |
| --- | --- |
| `src/App.tsx` | Component chính, quản lý UI và state tổng thể |
| `src/main.tsx` | Entry render React |
| `src/services/cadVectorDataService.ts` | Service load dữ liệu CAD Vector |
| `src/components/map/CadVectorMap.tsx` | Bản đồ CAD Vector chính |
| `src/components/map/CadLegend.tsx` | Chú giải CAD Vector |
| `src/components/map/CadBlueprintMap.tsx` | Bản đồ ảnh CAD tham chiếu |
| `src/components/map/CadLayoutPreview.tsx` | Xem layout/khung bản vẽ |
| `src/data/curatedMainWorks.ts` | Danh sách công trình chính chuẩn hóa |
| `src/types/gis.ts` | TypeScript types cho GIS/CAD |
| `scripts/normalize-cad-vector.js` | Script normalize CAD Vector |
| `scripts/validate-cad-vector.js` | Script validate CAD Vector |
| `docs/USER_GUIDE.md` | Hướng dẫn sử dụng app |
| `docs/DWG_IMPORT_GUIDE.md` | Hướng dẫn import DWG/DXF |
| `docs/CAD_LAYER_MAPPING.md` | Mapping layer CAD sang WebGIS |

---

## Phụ lục C. Tóm tắt giá trị nổi bật của dự án

- Dự án chuyển được dữ liệu CAD/QGIS thành WebGIS chạy trên trình duyệt.
- CAD Vector là dữ liệu chính, cho phép click, lọc và xem thuộc tính từng đối tượng.
- Có preset nghiệp vụ giúp người dùng tập trung vào nhà máy nước, hồ nước thô, tuyến ống hoặc kênh thủy lợi.
- Có cơ chế hiển thị layer nâng cao theo nhóm CAD gốc.
- Có panel chi tiết giúp truy vết layer, file nguồn và properties CAD.
- Có công cụ xuất PDF phục vụ báo cáo/demo.
- Có tài liệu hướng dẫn sử dụng, import DWG và mapping layer để hỗ trợ bảo trì.
- Có script normalize/validate giúp quy trình dữ liệu rõ ràng và có thể lặp lại.
