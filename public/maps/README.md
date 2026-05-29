# CAD Blueprint Overlay

Dat file anh export tu `BIWASE_HIEN TRANG.dwg` vao thu muc nay voi ten:

```text
public/maps/biwase-hien-trang.png
```

Ung dung dung truc tiep file PNG nay cho CAD Blueprint Mode. Neu file chua ton tai, map hien thong bao ro rang va khong render placeholder gia.

Viewer se preload anh de lay `naturalWidth` va `naturalHeight`, sau do fit theo dung ti le trong Leaflet `CRS.Simple`.

Toa do marker thu cong nam trong `src/data/cadBlueprintAssets.ts` theo dinh dang `[y, x]`. Co the chinh vi tri Point tren UI bang che do `Chinh vi tri`; thay doi se luu vao localStorage.
