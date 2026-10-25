# Danh mục minh chứng mã nguồn

Mốc tiến độ 25/10/2026. Snapshot chức năng: commit `2abe34e` trên nhánh `main`.

| Nội dung | Đường dẫn trong repository |
| --- | --- |
| Cài đặt và cấu hình an toàn | README.md; docs/BACKEND_SETUP.md; .env.example; backend/.env.example |
| Đề xuất cấu trúc và workflow CSDL | backend/db/migrations/001_extensions.sql đến 007_incident_sla_assignees_assets_realtime.sql; xem tên file thực trong thư mục |
| Dữ liệu mẫu và seed | public/data/cad-vector/operational-map-wgs84.geojson; backend/src/db/seed.ts |
| Nhận diện và xuất CRS tham chiếu | scripts/verify-cad-crs.js; scripts/export-cad-wgs84.js; docs/CRS_VERIFICATION_REPORT.md |
| Phân trang và số tổng | backend/src/modules/assets/repository.ts; backend/src/modules/incidents/repository.ts; src/services/operationsService.ts |
| Phiếu tiếp nhận và thời gian | src/components/incidents/IncidentIntakeModal.tsx; src/utils/incidentIntake.ts |
| Đối tượng và vị trí sự cố | src/utils/incidentLocation.ts; src/components/map/IncidentLocationPicker.tsx |
| Workflow và kiểm soát version | backend/src/modules/incidents/repository.ts; src/components/manage/WorkRecordPanel.tsx |
| Chất lượng hồ sơ | src/components/manage/assetQuality.ts; backend/src/modules/operations/asset-quality.ts |
| Báo cáo và CSV | src/components/reports/; src/utils/reports.ts; backend/src/modules/reports/ |
| Lưu bản nháp | src/services/localDraftStore.ts; src/hooks/useWebGISData.ts |
| Focus nền và cảnh báo | src/components/map/GeographicFocusMask.tsx; src/components/map/IncidentAlertMarkers.tsx |
| Kiểm thử | backend/src/app.test.ts; asset-quality.test.ts; incident-intake.test.ts; incident-location.test.ts; local-drafts.test.ts; map-focus.test.ts; operations-pagination.test.ts; pagination-client.test.ts; reports-business.test.ts; startup-loading.test.ts; work-queue.test.ts |
| Kết quả chạy ngày 25/10 | minh_chung/kiem_tra_2026-10-25.txt |

Các test API sử dụng mock và cấu hình không kết nối database trong tiến trình kiểm thử. Muốn kiểm tra CRUD/workflow trên database thật, dùng `npm --prefix backend run test:db` sau khi cấu hình môi trường phù hợp. Script này tạo dữ liệu thử và thực hiện dọn đúng bản ghi do nó tạo; cần dùng database kiểm thử riêng, không dùng CSDL vận hành.
