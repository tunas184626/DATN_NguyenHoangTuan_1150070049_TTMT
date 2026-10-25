# Báo cáo tiến độ đến ngày 25 tháng 10 năm 2026

**Nguyễn Hoàng Tuấn - 1150070049 - lớp 11_TTMT**

GVHD: **ThS. Từ Thanh Trí**

Đề tài: **Xây dựng hệ thống WebGIS hỗ trợ quản lý hạ tầng và theo dõi sự cố cấp nước**.

Đây là bộ báo cáo tiến độ tuần 19–25/10/2026, không phải hồ sơ nghiệm thu hoặc thuyết minh ĐATN hoàn chỉnh.

| Tài liệu | Mở hoặc tải |
| --- | --- |
| Báo cáo tiến độ 10 trang | [PDF](Bao_cao_tien_do_25102026.pdf) · [Word](Bao_cao_tien_do_25102026.docx) · [Nguồn nội dung](Bao_cao_tien_do_25102026.md) |
| Nội dung từng trường Google Form | [Nội dung để kiểm tra và dán](Noi_dung_Google_Form.txt) |
| Kiểm tra thành phần hồ sơ và lịch nộp | [Checklist](Checklist_ho_so.md) |
| Đường dẫn mã nguồn theo chức năng | [Danh mục minh chứng](Danh_muc_minh_chung.md) |
| Kết quả kiểm tra ngày 25/10 | [Nhật ký lệnh chạy](minh_chung/kiem_tra_2026-10-25.txt) |
| Kiểm kê và dấu vết dữ liệu | [Số đếm và SHA256](minh_chung/du_lieu_nguon.json) |

Snapshot mã nguồn là commit [`2abe34e`](https://github.com/tunas184626/DATN_NguyenHoangTuan_1150070049_TTMT/commit/2abe34e). Các kiểm tra ghi nhận 100 test đạt trên 11 tệp, lint/build hai phía và kiểm tra CAD/CRS bằng script đều đạt. Test API dùng mock; GPS, radius query, RBAC/Storage/CSDL thật và nghiệm thu CRS vẫn được ghi là hạng mục cần tiếp tục hoàn thiện.

Đề cương Word gốc do sinh viên cung cấp và PDF chuyển đổi được giữ trong ZIP local, không đăng lại bản gốc lên GitHub. Bộ ZIP không có PowerPoint/video theo yêu cầu lần chuẩn bị này. Không chứa `.env`, secret key hoặc mật khẩu thật. Chưa nộp Form, gửi email hoặc tạo link Drive.
