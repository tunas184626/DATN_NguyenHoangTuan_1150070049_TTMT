# CAD CRS Verification

## Kết luận

Hệ tọa độ của dữ liệu **model space** được nhận diện là:

- Source CRS: **VN-2000 / TM-3 105-45 (`EPSG:9210`)**.
- Đơn vị: mét; trục tọa độ nguồn: Easting, Northing.
- Web/GPS target CRS: **WGS 84 (`EPSG:4326`)**, thứ tự GeoJSON là longitude, latitude.
- Paper space/layout không mang tọa độ địa lý và không được gán EPSG:9210.

Kết luận dựa trên bốn nhãn địa danh độc lập trong CAD. Sau khi chuyển từ EPSG:9210 sang EPSG:4326, các điểm đều nằm trong đúng địa phương tương ứng trên dữ liệu OpenStreetMap/Nominatim:

| Nhãn CAD | WGS84 sau chuyển đổi | Khoảng cách tới điểm tham chiếu |
| --- | --- | ---: |
| Hậu Nghĩa | `106.38634541, 10.90031503` | khoảng 959 m |
| Đức Hòa | `106.44955462, 10.82218259` | khoảng 790 m |
| Hiệp Hòa | `106.31388019, 10.91523640` | khoảng 353 m |
| Mỹ Hạnh | `106.47633419, 10.88108966` | khoảng 1.076 m |

Sai lệch trên là khoảng cách từ **điểm chèn chữ CAD** đến điểm đại diện địa danh, không phải sai số khảo sát. Nó chỉ dùng để nhận diện đúng hệ chiếu. Không dùng các giá trị này để tuyên bố độ chính xác vị trí tài sản.

## Bằng chứng và giới hạn

- EPSG:9210 có kinh tuyến trục 105°45′, scale factor `0.9999`, false easting `500000 m` và phạm vi sử dụng bao gồm Long An.
- Reverse-geocode các điểm chuyển đổi trả đúng các khu vực Hậu Nghĩa, Đức Hòa, Hiệp Hòa và vùng Mỹ Hạnh/Đức Lập.
- Hai phép chuyển VN-2000 → WGS84 phù hợp vùng nghiên cứu do PROJ cung cấp đều có accuracy khai báo `1 m`; kết quả giữa chúng chênh khoảng `0,8 m` tại vùng dữ liệu.
- Chưa có mốc trắc địa/survey handover nên geometry tài sản vẫn cần QA bằng mốc kiểm soát trước khi dùng cho công việc yêu cầu độ chính xác hiện trường.

## Kiểm tra tái lập

Chạy:

```bash
npm run verify:crs
```

Script kiểm tra tọa độ neo còn tồn tại trong GeoJSON nguồn, thực hiện phép chuyển và fail nếu bất kỳ điểm nào nằm ngoài vùng sai số ngữ nghĩa cho phép. Báo cáo máy đọc được sinh tại `public/data/cad-vector/crs-verification-report.json`.

Sinh lớp nghiệp vụ WGS84 dùng cho nền bản đồ địa lý:

```bash
npm run export:cad-wgs84
```

Output `public/data/cad-vector/operational-map-wgs84.geojson` chỉ chứa model-space feature có ích cho vận hành; paper space, layout, nhãn và nền CAD nặng được loại bỏ.

## Quy tắc triển khai

1. Giữ nguyên tọa độ nguồn EPSG:9210 để truy vết.
2. Chỉ reproject feature thuộc model space.
3. Loại paper space/layout khỏi lớp địa lý.
4. API/GeoJSON phục vụ Leaflet nền OSM xuất EPSG:4326 theo `[longitude, latitude]`.
5. GPS sự cố tiếp tục lưu EPSG:4326.
6. Không sử dụng phép tịnh tiến `raw - minBounds` như một phép chuyển CRS; phép đó chỉ phục vụ viewer `CRS.Simple` cũ.
