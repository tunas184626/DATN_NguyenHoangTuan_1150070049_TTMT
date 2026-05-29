# GeoJSON thô từ QGIS

Đặt GeoJSON export từ QGIS vào thư mục này rồi chạy:

```bash
npm run normalize:cad-vector
npm run validate:cad-vector
```

Script `scripts/normalize-cad-vector.js` chỉ đọc file `.geojson` và bỏ qua `.qmd`, `README.md` hoặc file khác.

Quy ước tên file:

- `cad_*.geojson`: `BIWASE_HIEN TRANG.dwg`
- `kenh_thuy_loi_*.geojson`: `Ban do khu tuoi duc hoa cap nhat moi 19 7 2014.dwg`
- `cong_trinh_chinh_*.geojson`: `HTCN PMV.dwg`

Output chuẩn hóa được ghi ra `public/data/cad-vector/`.
