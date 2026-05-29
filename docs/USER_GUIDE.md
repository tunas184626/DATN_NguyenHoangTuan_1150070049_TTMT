# Huong dan su dung WebGIS cap nuoc BIWASE

Tai lieu nay huong dan nguoi dung chay project va su dung cac tinh nang chinh cua ung dung WebGIS he thong cap nuoc.

## 1. Chuan bi moi truong

Yeu cau may cai san:

- Node.js `20.19+`, `22.12+` hoac moi hon.
- npm di kem Node.js.
- Git LFS neu clone repo co file du lieu `.geojson` lon.

Kiem tra phien ban:

```bash
node -v
npm -v
git lfs version
```

Neu clone project tu GitHub, nen chay:

```bash
git lfs install
git lfs pull
```

## 2. Cai dat va chay ung dung

Tai thu muc project, chay:

```bash
npm install
npm run dev
```

Sau khi Vite khoi dong, mo URL hien trong terminal, thuong la:

```text
http://localhost:5173/
```

Neu gap loi `vite is not recognized`, nghia la chua cai dependencies. Chay lai:

```bash
npm install
npm run dev
```

Neu gap loi Node.js qua cu, nang Node len ban `20.19+` hoac `22.12+` roi xoa va cai lai dependencies:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
npm run dev
```

## 3. Tong quan giao dien

Man hinh chinh gom 4 khu vuc:

- Thanh tren cung: ten he thong, trang thai du lieu va o tim kiem.
- Sidebar ben trai: layer, bo loc, che do xem va danh sach doi tuong.
- Ban do o giua: hien thi CAD Vector, anh CAD tham chieu hoac OpenStreetMap.
- Panel ben phai: thong tin chi tiet cua doi tuong dang chon.

Che do du lieu chinh cua project la `Ban do CAD Vector`. Anh CAD/PNG va OpenStreetMap chi dung de doi chieu.

## 4. Su dung ban do CAD Vector

Khi vao app, neu co du lieu trong `public/data/cad-vector/`, ung dung se uu tien mo `Ban do CAD Vector`.

Trong ban do CAD Vector co cac nut thao tac nhanh:

- `Fit ban do CAD`: dua ban do ve vung du lieu hien tai.
- `Zoom toi doi tuong`: phong toi doi tuong dang duoc chon.
- `Xuat PDF`: in/xuat khung ban do hien tai ra PDF bang trinh duyet.
- `Nen`: doi che do nen/visual mode cua ban do CAD.

Cach thao tac co ban:

1. Click mot doi tuong tren ban do de chon.
2. Xem thong tin chi tiet o panel ben phai.
3. Dung chuot de zoom/pan ban do nhu cac ban do Leaflet thong thuong.
4. Dung nut `Fit ban do CAD` khi muon quay lai vung du lieu dang xem.

## 5. Chon che do xem nghiep vu

Trong sidebar ben trai, muc `Che do xem nghiep vu` co 4 preset:

- `Tong quan`: hien thi cac nhom chinh nhu cong trinh chinh, tuyen ong, kenh thuy loi va nen CAD.
- `Nha may nuoc`: tap trung vao cac nha may nuoc, co tuyen ong va nen CAD tham chieu.
- `Ho nuoc tho`: tap trung vao cac ho nuoc tho va doi tuong lien quan.
- `Kenh thuy loi`: tap trung vao he thong kenh/thuy loi.

Khi doi preset, app tu dong bat/tat cac layer phu hop va dua ban do toi vung xem lien quan.

## 6. Bat/tat layer hien thi

Trong sidebar, co cac nhom layer chinh:

- `Nen CAD goc`: ban ve nen duoc lam mo de giu ngu canh.
- `Cong trinh chinh`: cac cong trinh duoc chuan hoa va lam noi bat.
- `Tuyen ong cap nuoc`: cac duong ong cap nuoc.
- `Kenh/thuy loi`: du lieu kenh, vung va diem thuy loi.

Co the bat/tat tung checkbox de giam roi ban do.

Neu can xem sau hon, mo muc `Du lieu CAD tho / nang cao` de:

- Loc nhanh theo loai doi tuong, vi du `Tuyen ong`, `Nha may nuoc`, `Ho nuoc tho`, `Nhan duong kinh`.
- Mo rong tung nhom layer CAD.
- Bat/tat tung layer goc duoc export tu QGIS.

## 7. Hien thi nhan CAD

Trong muc `Lop hien thi`, co cac tuy chon:

- `Hien nhan cong trinh chinh`: hien ten cac cong trinh chinh.
- `Hien nhan duong kinh`: hien cac nhan OD/D cua tuyen ong.
- `An text loi font`: an cac text CAD bi loi ma hoa sau khi convert DWG/DXF.

Nen giu `An text loi font` duoc bat de ban do sach hon. Khi can kiem tra text goc, click doi tuong va xem panel `Thong tin CAD goc` ben phai.

## 8. Tim kiem doi tuong

Dung o tim kiem tren thanh topbar.

Co the tim theo:

- Ten doi tuong, vi du `Hoa Khanh Tay`, `Duc Hoa 3`, `My Hanh`.
- Nhan duong kinh, vi du `OD315`, `OD630`, `D500`.
- Ten layer CAD, vi du `Diameter_Text`.
- ID hoac thong tin goc trong properties.

Khi co ket qua:

1. Click ket qua can xem.
2. App se chon doi tuong, bat layer can thiet neu dang an.
3. Ban do se zoom/focus den doi tuong do.
4. Panel ben phai hien thong tin chi tiet.

## 9. Xem thong tin chi tiet

Khi chon doi tuong CAD Vector, panel ben phai hien:

- ID.
- Loai doi tuong.
- Nhom nghiep vu.
- Nguon file.
- Layer CAD.
- Text hop le neu co.
- Duong kinh neu la nhan OD/D.
- Geometry.
- Nguon du lieu va file goc.
- Thong tin CAD goc.

Nut `Copy thong tin` trong muc `Thong tin CAD goc` se copy properties cua doi tuong dang chon duoi dang JSON.

Neu doi tuong la cong trinh chinh da chuan hoa, panel co nut `Cap nhat vi tri`.

## 10. Cap nhat vi tri cong trinh chinh

Tinh nang nay dung de chinh lai vi tri hien thi cua cac cong trinh chinh chuan hoa tren ban do CAD Vector.

Cach lam:

1. Chon mot cong trinh chinh trong sidebar hoac tren ban do.
2. Bam `Cap nhat vi tri`.
3. Khi app hien thong bao dang cho click, click vao vi tri moi tren ban do CAD.
4. Vi tri moi duoc luu vao localStorage cua trinh duyet.

Luu y: thao tac nay phuc vu ban demo/local. Du lieu vi tri chinh sua khong tu dong ghi nguoc vao file GeoJSON trong repo.

Co the bam `Xuat JSON` trong khu vuc `Cong trinh chinh chuan hoa` de lay du lieu da chinh.

## 11. Bao su co

Co the tao diem su co tu panel chi tiet hoac man hinh quan ly.

Cach tao tu doi tuong dang chon:

1. Chon mot doi tuong tren ban do.
2. Bam `Bao su co` trong panel ben phai.
3. Nhap ten su co, ma su co, loai su co, muc do, trang thai xu ly, ngay ghi nhan, vi tri va mo ta.
4. Kiem tra Latitude/Longitude.
5. Bam `Tao diem su co`.

Cac truong bat buoc gom:

- Ten su co.
- Ma su co.
- Mo ta.
- Vi tri.
- Latitude va Longitude hop le.

Su co moi duoc luu vao localStorage cua trinh duyet de phuc vu demo.

## 12. Quan ly du lieu ha tang

Trong view quan ly, co cac thao tac:

- `Them doi tuong`: them mot doi tuong ha tang moi.
- `Tao diem su co`: tao mot diem su co doc lap.
- `Reset du lieu du phong ban dau`: xoa du lieu demo/localStorage va nap lai du lieu ban dau.

Khi them doi tuong moi, can nhap:

- Ten doi tuong.
- Loai doi tuong.
- Trang thai.
- Dia chi.
- Mo ta.
- Kieu hinh hoc: `Point`, `LineString` hoac `Polygon`.
- Toa do theo dang `lng,lat;lng,lat`.

Vi du toa do:

```text
106.4232,10.8815
106.4232,10.8815;106.4258,10.8828
```

## 13. Bao cao va bieu do

View bao cao hien cac bieu do tong hop:

- Phan bo trang thai tai san.
- Muc do nghiem trong su co.
- Xu huong su co va bao tri dang mo phong.

View nay phu hop de demo nhanh tinh hinh he thong va so lieu tong quan.

## 14. Xuat PDF ban do

Trong `Ban do CAD Vector`, bam `Xuat PDF`.

Trinh duyet se mo hop thoai in. Chon:

- Destination/May in: `Save as PDF`.
- Layout: tuy ban do, thuong dung Landscape neu can khung rong.
- Bam Save de luu file PDF.

PDF gom:

- Tieu de ban do WebGIS he thong cap nuoc.
- Che do xem hien tai.
- Thoi gian xuat.
- Khung ban do hien tai.
- Legend.
- Nguon du lieu va quy trinh DWG -> DXF -> QGIS -> GeoJSON -> CAD Vector WebGIS.

## 15. Cac che do ban do phu

Trong `Cong cu phu / nang cao`, co the chuyen sang:

- `Ban do CAD Vector`: che do du lieu chinh.
- Cac layout ban ve goc: xem layout/khung ban ve de doi chieu.
- `Anh CAD tham chieu`: PNG ban ve, khong phai du lieu chinh.
- `OpenStreetMap tham khao`: nen dia ly tham chieu.

Neu can lam viec voi du lieu that, uu tien `Ban do CAD Vector`.

## 16. Loi thuong gap

### Vite bao Node.js qua cu

Loi vi dang dung Node 18 hoac cu hon.

Cach sua:

```bash
node -v
```

Nang Node len `20.19+`, `22.12+` hoac moi hon, dong mo lai terminal, sau do:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
npm run dev
```

### Cannot find native binding cua Rolldown

Thuong do `node_modules` duoc cai bang Node/phien ban npm cu.

Cach sua:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
npm run dev
```

Neu van loi:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
npm run dev
```

### Ban do thieu du lieu hoac GeoJSON khong day du

Neu clone repo tu GitHub, kiem tra Git LFS:

```bash
git lfs install
git lfs pull
```

Sau do chay lai app.

### Khong thay CAD Vector

Kiem tra cac file trong:

```text
public/data/cad-vector/
```

Neu can tao lai du lieu CAD Vector tu GeoJSON tho:

```bash
npm run normalize:cad-vector
npm run validate:cad-vector
npm run dev
```

## 17. Ghi chu ve luu tru du lieu

Mot so thao tac tren giao dien nhu them/sua doi tuong, tao su co va cap nhat vi tri cong trinh chinh hien luu vao `localStorage` cua trinh duyet.

Dieu nay co nghia la:

- Du lieu chi ton tai tren may/trinh duyet dang thao tac.
- Refresh trang van giu du lieu.
- Doi trinh duyet hoac xoa localStorage se mat du lieu chinh sua.
- Du lieu khong tu dong ghi vao file GeoJSON trong source code.

Neu can dua thay doi vao repo, can xuat JSON hoac chinh file du lieu tuong ung roi commit lai.
