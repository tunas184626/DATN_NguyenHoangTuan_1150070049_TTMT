# WebGIS hệ thống cấp nước BIWASE

Ứng dụng React + TypeScript + Vite + Leaflet dùng để dựng WebGIS từ dữ liệu CAD/QGIS. Chế độ dữ liệu chính là **CAD Vector**, không dùng PNG làm dữ liệu chính.

## Nguồn dữ liệu

- Dữ liệu CAD hiện trạng: `BIWASE_HIEN TRANG.dwg`
- Dữ liệu công trình chính: `HTCN PMV.dwg`
- Dữ liệu kênh thủy lợi: `Ban do khu tuoi duc hoa cap nhat moi 19 7 2014.dwg`

GeoJSON thô export từ QGIS đặt tại:

```text
source-data/converted/geojson/
```

Các nhóm file đầu vào:

- `cad_*.geojson`: nền CAD hiện trạng, tuyến ống, ranh giới, đường nền, nhãn OD/D.
- `cong_trinh_chinh_*.geojson`: nhà máy nước, hồ nước thô, công trình chính.
- `kenh_thuy_loi_*.geojson`: hệ thống kênh/vùng/điểm thủy lợi.

File `.qmd`, `README.md` và file không phải `.geojson` được bỏ qua.

## Quy trình chuyển đổi

```text
DWG → ODA DXF → QGIS GeoJSON → normalize → CAD Vector WebGIS
```

Chạy dữ liệu:

```bash
npm install
npm run normalize:cad-vector
npm run validate:cad-vector
npm run dev
```

Output chính nằm trong:

```text
public/data/cad-vector/
```

Các file output:

- `entities.geojson`
- `points.geojson`
- `lines.geojson`
- `polygons.geojson`
- `irrigation.geojson`
- `main-works.geojson`
- `layer-index.json`
- `business-layer-index.json`
- `cad-vector-metadata.json`

## CAD Vector Là Dữ Liệu Chính

App mặc định mở **Bản đồ CAD Vector** nếu có `entities.geojson`. CAD Vector dùng Leaflet `CRS.Simple` vì dữ liệu đang ở hệ tọa độ CAD/QGIS nội bộ.

Các chế độ ảnh/layout chỉ là tham chiếu:

- Layout/PNG dùng để đối chiếu bản vẽ hoặc trình bày.
- OpenStreetMap chỉ là nền tham khảo, không phải dữ liệu chính.

## Chế Độ Xem Nghiệp Vụ

Sidebar có các preset:

- Tổng quan hệ thống
- Công trình chính
- Tuyến ống cấp nước
- Kênh/thủy lợi
- Dữ liệu CAD thô

Preset mặc định là **Tổng quan hệ thống**, ưu tiên hiển thị công trình chính, kênh thủy lợi, tuyến ống và nền CAD mờ để không bị rối như CAD raw.

## Nhóm Layer

Layer được group theo nghiệp vụ:

- Công trình chính
- Nhà máy nước
- Hồ nước thô
- Hệ thống kênh thủy lợi
- Tuyến ống cấp nước
- Nhãn đường kính ống
- Ranh giới/khu vực
- Đường nền CAD
- Chưa phân loại

Mỗi nhóm có checkbox bật/tắt và có thể mở rộng để xem CAD layer gốc.

## Nhãn Và Text CAD

Mặc định app:

- Ẩn text CAD lỗi font/mojibake.
- Ẩn nhãn địa danh.
- Chỉ ưu tiên nhãn công trình chính đã nhận diện.
- Cho phép bật nhãn công trình chính, OD/D, kênh thủy lợi hoặc toàn bộ nhãn CAD.

Text gốc vẫn được giữ trong properties để tra cứu ở Detail Panel.

## Xuất PDF

Nút **Xuất PDF** dùng `window.print` và CSS print để xuất khung bản đồ hiện tại phục vụ báo cáo/demo.

PDF thể hiện:

- Tiêu đề: `Bản đồ WebGIS hệ thống cấp nước`
- Chế độ xem hiện tại
- Thời gian xuất
- Khung bản đồ hiện tại
- Legend
- Nguồn dữ liệu và quy trình DWG → DXF → QGIS → GeoJSON

## Ghi Chú Phát Triển

- Không parse DWG trực tiếp ở frontend.
- Không render toàn bộ nhãn lỗi font mặc định.
- Không bỏ feature chưa phân loại khỏi dữ liệu.
- Công trình chính và kênh thủy lợi được tách từ GeoJSON theo `sourceGroup`, không hard-code thành PNG.
