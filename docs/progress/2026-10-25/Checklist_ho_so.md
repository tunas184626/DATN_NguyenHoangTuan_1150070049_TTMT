# Hồ sơ báo cáo tiến độ đến 25 tháng 10 năm 2026

Sinh viên Nguyễn Hoàng Tuấn, MSSV 1150070049, lớp 11_TTMT. GVHD ThS. Từ Thanh Trí.

## Thành phần của bộ hồ sơ lần này

| Thành phần | Tình trạng |
| --- | --- |
| Báo cáo tiến độ Word và PDF | Có trong bộ hồ sơ; phản ánh kết quả đến 25/10, không phải khóa luận hoàn chỉnh |
| Đề cương Word do sinh viên cung cấp | Giữ nguyên bản nguồn trong ZIP; có bản PDF chuyển đổi để đọc |
| Tình trạng duyệt đề cương | Cần sinh viên/GVHD xác nhận; không tự thêm chữ ký hoặc xác nhận đã duyệt |
| Nội dung Google Form | Chuẩn bị đúng các trường đang có của Form; chưa gửi |
| Mã nguồn GitHub | Repository công khai, source commit 2abe34e; README hướng dẫn chạy |
| CSDL và dữ liệu mẫu | Bản sao migration 001–007, mẫu GeoJSON tham chiếu và hướng dẫn seed trong ZIP |
| Minh chứng kiểm tra | Log lint/build, 100 test và kiểm tra CAD/CRS; có danh mục đường dẫn mã |
| Tài khoản kiểm thử | Local AUTH_MODE=disabled không phải tài khoản RBAC. Tài khoản Supabase thật do sinh viên cấu hình riêng; không đóng gói secret/mật khẩu |
| PowerPoint và video | Không tạo theo yêu cầu của sinh viên trong lần chuẩn bị này |

## Cách dùng bộ hồ sơ

1. Đọc báo cáo PDF và kiểm tra lại thông tin cá nhân, mô tả tiến độ và phần tự đánh giá.
2. Xác nhận bản đề cương cung cấp có phải bản được GVHD duyệt hay không. Bản PDF chuyển đổi không tạo ra giá trị xác nhận duyệt.
3. Mở `Noi_dung_Google_Form.txt`, đối chiếu với Form và dán vào từng ô. Form yêu cầu một báo cáo/tuần trước 23h Chủ nhật. Việc tạo bộ tài liệu không có nghĩa Form đã được gửi.
4. Dùng GitHub và thư mục tài liệu tiến độ làm minh chứng có quyền xem. ZIP local có thể được sinh viên tự đưa lên Drive khi cần; chưa có link Drive được tạo trong lần này.

## Các mốc của thông báo GVHD

| Mốc | Yêu cầu cần theo dõi |
| --- | --- |
| Hằng tuần, trước 23h Chủ nhật | Báo cáo qua Google Form, nêu kết quả, kế hoạch và minh chứng |
| Trước 23h ngày 22/11/2026 | Nộp bộ file hoàn chỉnh, gồm đề cương đã duyệt PDF, khóa luận Word/PDF, slide, video và link mã nguồn |
| Ngày 26 và 27/11/2026 buổi tối | Dự kiến báo cáo trực tuyến; chờ lịch/link cụ thể |
| Trước 15h ngày 01/12/2026 | Nộp một quyển in một mặt, trắng đen, bìa xanh để GVHD kiểm tra |
| Ngày 07–09/12/2026 | Theo kế hoạch Khoa, hoàn thiện hai quyển chính thức và chữ ký theo quy định |

Thông báo yêu cầu tên ZIP theo dạng `DATN_MSSV_HoTen_Lop.zip`. Bộ ZIP lần này dùng `DATN_1150070049_NguyenHoangTuan_11_TTMT.zip` và có file nhận diện đây là bộ tiến độ đến 25/10. Không dùng bộ tiến độ này thay cho bộ nộp hoàn tất tháng 11.

Email nộp file hoàn tất ghi trong thông báo: `dklien@hcmunre.edu.vn`, Cc `tuthanhtri@hcmunre.edu.vn`. Chưa gửi email, chưa nộp Form và chưa công bố bản đề cương gốc trên GitHub trong lần chuẩn bị này.

## Việc còn phải hoàn thiện theo phạm vi đồ án

- Nghiệm thu PostGIS/Supabase thật, geometry, dữ liệu và RBAC; bổ sung GPS one-shot, truy vấn bán kính và kiểm tra thực địa.
- Xin ý kiến về thay đổi CRS, mô hình provenance và phạm vi sử dụng dữ liệu.
- Đo hiệu năng, kiểm tra mobile, hoàn thiện đủ các chương thuyết minh và minh chứng.
- Slide, video, bản in và chữ ký vẫn là yêu cầu của đợt nộp hoàn tất; sinh viên đã yêu cầu không làm PowerPoint/video trong lần này.
