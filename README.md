# Task Board

Công cụ quản lý task chạy hoàn toàn trên trình duyệt, phù hợp triển khai tĩnh trên GitHub Pages.

Khi mở lần đầu, công cụ tự tạo dữ liệu mẫu trải dài 30 ngày trong tháng hiện tại: nhiều task cha, các subtask liền kề và các khoảng thời gian overlap để kiểm tra giao diện Calendar/Gantt. Dữ liệu mẫu chỉ được tạo một lần trên trình duyệt.

## Chạy

Mở `index.html` hoặc dùng bất kỳ static web server nào. Thư viện SheetJS được tải từ CDN để đọc và ghi `.xlsx`.

## Định dạng Excel

Các cột được hỗ trợ: `Task`, `Task cha`, `Ngày bắt đầu`, `Ngày kết thúc`, `Thời gian làm dự kiến (giờ)`, `Loại công việc`, `Mức độ ưu tiên`, `Đã xong`. Mỗi dòng là một work item độc lập; cột `Task cha` tạo quan hệ trong work tree. Ngày và số giờ của subtask được tính riêng, không dùng chung với task cha. Mức ưu tiên gồm Khẩn cấp, Cao, Trung bình và Thấp; màu task tự đổi theo mức ưu tiên và task ưu tiên cao được xếp trước trong từng ngày. Có thể dùng thêm tên cột tiếng Anh tương ứng trong mã nguồn. Nút **Tải file mẫu** tạo file mẫu trực tiếp. File cũ có cột `Subtask` vẫn được đọc và chuyển thành một work item con.

Import task định kỳ dùng thêm `Lặp lại` (`Hàng tuần` hoặc `Hàng tháng`) và `Kết thúc lặp`. Hệ thống tự tách file thành từng lần thực hiện trong tháng đang quản lý, kể cả khi ngày bắt đầu nằm ở tháng trước; giữ đúng thứ trong tuần hoặc ngày trong tháng (ngày 31 được điều chỉnh thành ngày cuối tháng). Mỗi lần là một work item một ngày hoặc một khoảng thời lượng riêng, không tạo task kéo dài vô hạn qua các năm trên Calendar.

Gantt nhóm các task cha thành từng khối, bên dưới là từng dòng subtask. Có thể lọc Gantt theo ngày, tuần hoặc tháng; các thanh được cắt theo đúng khoảng đang xem. Thanh mờ là tổng khoảng của task cha; các thanh con giữ màu riêng để thấy rõ các đoạn liền kề hoặc overlap.

Tích checkbox trên Calendar hoặc Gantt để đánh dấu hoàn thành. Trên Calendar, chỉ work item được chọn bị làm tối. Riêng checkbox task cha trong Gantt sẽ đồng bộ trạng thái cho toàn bộ subtask bên dưới. Task hoàn thành chỉ được làm tối để dễ nhận biết; vẫn có thể kéo-thả. Bấm lại checkbox để hoàn tác nếu thao tác nhầm. Excel export thêm cột `Thời gian hoàn thành`, lấy lần bấm hoàn thành gần nhất; nếu đã hoàn tác thì để trống.

Nhấp chuột phải vào task trên Calendar hoặc Gantt để xóa task. Khi xóa task cha, toàn bộ task con bên dưới cũng được xóa sau khi xác nhận.

Kéo task sang ô ngày khác sẽ chỉ đổi ngày bắt đầu và giữ nguyên deadline/ngày kết thúc. Không thể dồn task sang sau deadline; số giờ và các task chồng lịch được giữ nguyên. Sau khi dồn task, hệ thống mở popup cho biết số ngày còn lại đến deadline. Ngày có task đến deadline được đánh dấu đỏ nổi bật; task vẫn giữ màu theo mức độ ưu tiên nhưng hiển thị dịu hơn. Với task kéo dài nhiều ngày, chỉ lần hiển thị ở ngày kết thúc mới được đánh dấu DEADLINE màu đỏ.

## Lưu trữ

Task và cài đặt được lưu trong `localStorage`, không cần tài khoản. Nút **Cài đặt lưu trữ** cho phép lưu link thư mục Google Drive để mở nhanh. Do giới hạn bảo mật của trình duyệt, việc ghi file trực tiếp vào Drive cần OAuth/Google API; công cụ tự động tải file vào ngày cuối tháng để người dùng đưa vào thư mục đã cấu hình.

## Google Drive OAuth

Trong **Cài đặt lưu trữ**, nhập link thư mục Drive gốc, bấm **Lưu cài đặt**, sau đó bấm **Kết nối Google Drive** và cấp quyền. Nút **Lưu Excel tháng này** sẽ tạo hoặc dùng lại thư mục con theo định dạng `YYYY-MM`, rồi tạo hoặc cập nhật file `task-board-YYYY-MM.xlsx` trong đó. Nếu access token hết hạn, ứng dụng sẽ yêu cầu cấp lại token và thử lại một lần.

Để OAuth hoạt động, Google Cloud project của Client ID cần bật Google Drive API, cấu hình OAuth consent screen và thêm domain đang chạy ứng dụng vào **Authorized JavaScript origins**. Client Secret không được dùng trong ứng dụng frontend và không được đưa vào mã nguồn. Token chỉ được giữ trong bộ nhớ của phiên hiện tại; việc tự động cuối tháng chỉ chạy khi trang đang mở.
# FIT-Task-Management
