# CAD Layer Mapping

File nay mo ta cach anh xa layer trong `BIWASE_HIEN TRANG.dwg` sang cac layer WebGIS duoc render tren Leaflet.

## Nguyen tac chung

- Khong bo du lieu khi chua phan loai duoc. Doi tuong chua ro se duoc dua vao `type = "pending_data"` va ghi trong `labels.geojson`.
- Uu tien doc ten layer CAD tu `cadLayer`, `sourceLayer`, `Layer`, `LAYER`, `layer`, `LayerName` hoac ten file GeoJSON tho.
- Text/MTEXT trong CAD duoc dua vao `label` de giu lai cac diem/nhan quan trong.
- GeoJSON output luon giu nguyen `geometry`; script chi chuan hoa `properties`.

## Bang mapping de xuat

| Dau hieu trong ten layer/ten doi tuong | WebGIS type | File output |
| --- | --- | --- |
| `NHA MAY`, `NMN`, `WATER_PLANT`, `TRAM XU LY` | `water_plant` | `public/data/biwase/water-plants.geojson` |
| `HO`, `HO CHUA`, `NUOC THO`, `RAW_WATER`, `LAKE` | `raw_water_lake` | `public/data/biwase/raw-water-lakes.geojson` |
| `ONG`, `TUYEN ONG`, `PIPE`, `PIPELINE`, `D300`, `D500` | `pipeline` | `public/data/biwase/pipelines.geojson` |
| `KENH`, `THUY LOI`, `CANAL`, `MUA TIEU` | `canal` | `public/data/biwase/canals.geojson` |
| `KHU VUC CAP NUOC`, `VUNG CAP`, `SUPPLY_ZONE`, `CAP NUOC` | `supply_zone` | `public/data/biwase/supply-zones.geojson` |
| `RANH`, `BOUNDARY`, `QUY HOACH`, `DIA GIOI` | `boundary` | `public/data/biwase/boundaries.geojson` |
| `TEXT`, `MTEXT`, `LABEL`, `NHAN`, `GHI CHU`, `ANNOTATION` | `label` | `public/data/biwase/labels.geojson` |
| Khong xac dinh duoc | `pending_data` | `public/data/biwase/labels.geojson` |

## Schema properties chuan

Moi feature sau normalize co dang:

```json
{
  "id": "string",
  "name": "string",
  "type": "water_plant | raw_water_lake | pipeline | canal | supply_zone | boundary | incident | label | pending_data",
  "status": "active | maintenance | need_inspection | pending_data",
  "source": "BIWASE_HIEN TRANG.dwg",
  "cadLayer": "string",
  "sourceLayer": "string",
  "description": "string",
  "address": "string",
  "capacity": "string",
  "area": "string",
  "volume": "string",
  "material": "string",
  "diameter": "string",
  "length": "string",
  "imageUrl": "string",
  "googleMapsUrl": "string",
  "lastUpdated": "string",
  "notes": []
}
```

## Kiem tra geometry

- `water_plant`: `Point`, `Polygon` hoac `MultiPolygon`
- `raw_water_lake`: `Point`, `Polygon` hoac `MultiPolygon`
- `pipeline`: `LineString` hoac `MultiLineString`
- `canal`: `LineString`, `MultiLineString`, `Polygon` hoac `MultiPolygon`
- `supply_zone`: `Polygon` hoac `MultiPolygon`
- `boundary`: `Polygon`, `MultiPolygon`, `LineString` hoac `MultiLineString`
- `label`: uu tien `Point`, nhung script van giu geometry goc neu QGIS export khac
