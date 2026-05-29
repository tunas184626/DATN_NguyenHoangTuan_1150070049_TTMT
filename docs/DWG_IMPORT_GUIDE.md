# Huong dan import BIWASE_HIEN TRANG.dwg vao WebGIS

Workflow du lieu cua project:

```text
BIWASE_HIEN TRANG.dwg
-> QGIS/DXF
-> GeoJSON tho
-> Normalize schema
-> public/data/biwase
-> WebGIS Leaflet
```

DWG la du lieu nguon. Frontend WebGIS khong nen parse DWG truc tiep, vi DWG la dinh dang CAD phuc tap, phu thuoc phien ban AutoCAD, CRS va cach to chuc layer. Frontend chi nen doc GeoJSON da convert va da chuan hoa schema.

## Buoc 1: Mo QGIS

Mo QGIS ban moi nhat co ho tro doc CAD/DXF. Tao project moi de kiem tra rieng du lieu CAD truoc khi dua vao WebGIS.

## Buoc 2: Keo file DWG vao QGIS

Dung file nguon:

```text
source-data/cad/BIWASE_HIEN TRANG.dwg
```

Keo file vao QGIS, hoac vao `Layer` -> `Add Layer` -> `Add Vector Layer`.

## Buoc 3: Kiem tra CRS/he toa do

Kiem tra CRS cua layer CAD va CRS cua project QGIS.

- Neu du lieu nam dung vi tri dia ly, export sang `EPSG:4326 - WGS 84` de Leaflet doc truc tiep.
- Neu toa do bi lech, can xac dinh dung CRS goc cua ban ve va reprojection sang EPSG:4326.
- Neu ban ve chi la toa do ky thuat/chua georeference, can georeference hoac nhap toa do thu cong cho cac diem quan trong.

## Buoc 4: Neu DWG khong mo duoc

Mo file trong AutoCAD hoac DWG TrueView, sau do `Save As` thanh DXF. Nen uu tien DXF neu QGIS khong doc duoc DWG theo phien ban hien co.

## Buoc 5: Chon layer can dung

Uu tien cac nhom doi tuong:

- Nha may nuoc
- Ho chua nuoc tho
- Tuyen ong cap nuoc
- Kenh/thuy loi neu co layer
- Khu vuc cap nuoc
- Ranh gioi khu vuc
- Diem/nhan quan trong tren ban ve

Tham chieu mapping tai `docs/CAD_LAYER_MAPPING.md`.

## Buoc 6: Export tung layer sang GeoJSON

Trong QGIS:

1. Click phai layer can export.
2. Chon `Export` -> `Save Features As`.
3. Format: `GeoJSON`.
4. CRS: `EPSG:4326 - WGS 84`.
5. Encoding: `UTF-8`.
6. Dat ten file goi nho layer, vi du:
   - `nha-may-nuoc.geojson`
   - `ho-chua.geojson`
   - `tuyen-ong-d300.geojson`
   - `kenh-thuy-loi.geojson`
   - `ranh-gioi.geojson`
   - `labels.geojson`

## Buoc 7: Dat file vao source-data/converted/geojson

Copy cac GeoJSON tho vua export vao:

```text
source-data/converted/geojson/
```

## Buoc 8: Chay normalize

```bash
npm run normalize:cad
```

Script se:

- Doc cac GeoJSON tho trong `source-data/converted/geojson/`
- Phan loai theo ten file, ten layer hoac properties goc
- Chuan hoa properties theo schema chung
- Ghi output vao `public/data/biwase/`
- Tu tao `id` neu chua co
- Giu `cadLayer`/`sourceLayer` de truy vet layer CAD
- Log canh bao neu feature thieu geometry

## Buoc 9: Chay validate

```bash
npm run validate:geojson
```

Script se kiem tra:

- File co phai `FeatureCollection` khong
- Feature co `geometry` khong
- Feature co `properties` khong
- Co `id`, `name`, `type`, `status` khong
- Geometry co phu hop voi type WebGIS khong

## Buoc 10: Chay WebGIS

```bash
npm run dev
```

App se uu tien doc GeoJSON that trong `public/data/biwase/`. Neu chua co du lieu CAD hoac layer bi loi, app tu fallback ve du lieu demo trong `src/data` va khong crash.

## Ghi chu xu ly loi thuong gap

- Neu ban do hien sai vi tri: kiem tra CRS trong QGIS va export lai EPSG:4326.
- Neu layer khong hien: chay `npm run validate:geojson` de xem geometry/type co phu hop khong.
- Neu DWG khong doc duoc: luu lai thanh DXF bang AutoCAD roi mo DXF trong QGIS.
- Neu chi co ban ve ky thuat chua georeference: can georeference ban ve hoac nhap toa do GPS/kinh do vi do cho cac diem quan trong.
