
# 🌾 ZippyFarm - 3D Interactive Farm Driving Simulation

**ZippyFarm** là một trò chơi 3D tương tác mô phỏng trải nghiệm lái xe trong môi trường nông trại sống động. Dự án được phát triển bằng JavaScript với thư viện đồ họa **Three.js**, thư viện vật lý **Rapier3D**, và giao diện được xây dựng bằng **React**. Người chơi có thể chọn phương tiện, điều khiển xe di chuyển, tương tác vật lý với các vật thể trong cảnh và tận hưởng không gian nông trại đầy màu sắc.

---

## 🚀 1. Giới Thiệu

- Mô phỏng lái xe tải trong nông trại 3D.
- Chọn phương tiện, tùy chỉnh màu sắc và texture.
- Tương tác vật lý thực tế với các vật thể như hàng rào, cối xay gió, động vật, v.v.
- Môi trường hoạt cảnh kết hợp âm thanh và chuyển động tự nhiên.

---

## 📁 2. Cấu Trúc Thư Mục

```
ZippyFarm/
├── assets/
│   ├── images/              # Ảnh đồ họa, icon, hướng dẫn
│   ├── models/              # Mô hình 3D (.glb)
│   │   └── Map_Farm.glb     # Bản đồ nông trại
│   └── sounds/              # Nhạc nền và hiệu ứng âm thanh
├── public/
│   └── style.css            # Tệp CSS chung
├── src/
│   ├── main.js              # Tệp khởi tạo game
│   ├── truckController.js   # Điều khiển xe
│   ├── physicsManager.js    # Quản lý vật lý (Rapier3D)
│   ├── sceneManager.js      # Quản lý mô hình, ánh sáng, bóng đổ
│   ├── objectFactory.js     # Sinh các đối tượng vật lý phụ
│   ├── soundManager.js      # Quản lý âm thanh
│   ├── ui.js                # React UI: chọn xe, hướng dẫn,...
│   └── vehiclePreviewManager.js # Hiển thị preview xe 3D
├── index.html
├── package.json
└── README.md
```

---

## **3\. Giải Thích Chi Tiết Các Thành Phần Chính**

### **3.1. main.js**

Là trung tâm điều phối của ứng dụng, `main.js` thiết lập môi trường 3D, khởi tạo các trình quản lý game (vật lý, cảnh, âm thanh), xử lý vòng lặp chính của game, và quản lý các tương tác bàn phím. Nó cũng đóng vai trò là cầu nối để khởi động và dọn dẹp game thông qua giao diện người dùng.

### **3.2. sceneManager.js**

Module này quản lý tất cả các yếu tố trực quan trong game. Nhiệm vụ chính bao gồm tải các mô hình 3D (bản đồ, xe, mây), áp dụng tùy chỉnh hình ảnh cho xe, thiết lập đổ bóng, đồng bộ hóa vị trí các vật thể 3D với hệ thống vật lý, và quản lý các animation.

### **3.3. physicsManager.js**

Chịu trách nhiệm toàn bộ hệ thống vật lý của game sử dụng Rapier3d. Nó khởi tạo thế giới vật lý, tạo các hình dạng va chạm (collider) cho mọi đối tượng, đồng bộ hóa trạng thái vật lý với hiển thị 3D, và xử lý các sự kiện va chạm (ví dụ: phát âm thanh, thay đổi thuộc tính vật thể khi va chạm).

### **3.4. truckController.js**

Module này điều khiển logic vận hành của xe tải. Nó nhận input từ bàn phím để điều khiển di chuyển (tiến/lùi, rẽ), điều chỉnh góc lái và tốc độ quay của bánh xe, và áp dụng các lực cần thiết (ví dụ: lực ép xuống) để mô phỏng chân thực.

### **3.5. soundManager.js**

Quản lý tất cả các hiệu ứng âm thanh trong trò chơi. Nó tải và phát nhạc nền, âm thanh phanh, còi, va chạm, và đặc biệt điều chỉnh âm lượng/cao độ của âm thanh động cơ dựa trên tốc độ xe.

### **3.3. ui.js**

Đây là thành phần giao diện người dùng chính được xây dựng bằng React. Nó quản lý các màn hình như tải game, lựa chọn xe, và hướng dẫn chơi, đồng thời tương tác với các module khác để hiển thị thông tin và kích hoạt các chức năng game.

### **3.7. objectFactory.js**

Module này có nhiệm vụ tạo ra các đối tượng vật lý thử nghiệm trong môi trường game. Các đối tượng này (như quả cầu, hộp, hình trụ) được gắn collider vật lý để tương tác với xe tải, giúp kiểm tra và minh họa các cơ chế vật lý.

### **3.8. vehiclePreviewManager.js**

Được sử dụng riêng biệt để tạo bản xem trước 3D của các loại xe trên màn hình lựa chọn. Nó cho phép người dùng xem, xoay và tùy chỉnh màu sắc hoặc texture của xe trước khi bắt đầu trò chơi.

## 🔧 4. Các Công Nghệ/Thư Viện Chính

Dự án sử dụng một số thư viện và công nghệ cốt lõi để xây dựng trải nghiệm 3D và tương tác:

- **Three.js**: Một thư viện JavaScript mạnh mẽ để tạo và hiển thị đồ họa 3D trên trình duyệt web. Được sử dụng để quản lý cảnh, camera, ánh sáng, mô hình 3D và render.
- **Rapier3d**: Một công cụ vật lý 3D hiệu suất cao, được viết bằng Rust và biên dịch sang WebAssembly. Rapier3d chịu trách nhiệm mô phỏng chính xác các tương tác vật lý giữa các đối tượng trong trò chơi.
- **React**: Một thư viện JavaScript để xây dựng giao diện người dùng. Được sử dụng để tạo các màn hình tải, lựa chọn xe và hướng dẫn một cách linh hoạt và có trạng thái.
- **Vite**: Một công cụ xây dựng frontend nhanh chóng, cung cấp môi trường phát triển với hot module replacement và tối ưu hóa build. (Tuy nhiên, do một số lỗi, dự án hiện chỉ chạy được ổn định với Live Server hoặc các HTTP Server tĩnh khác).
- **HTML5, CSS3, JavaScript (ES Modules)**: Các công nghệ nền tảng của web, được sử dụng để định nghĩa cấu trúc, kiểu dáng và logic của ứng dụng.


## 🕹️ 5. Tính Năng Chính & Điều Khiển

### 🎮 Chức Năng

- Chọn phương tiện (3 loại), đổi màu hoặc texture.
- Điều khiển xe qua bàn phím.
- Tương tác vật lý: vật thể đổ, văng, phản hồi theo va chạm.
- Hoạt cảnh chuyển động: mây trôi, cối xay gió quay, động vật di chuyển.
- Âm thanh: động cơ, va chạm, còi, nhạc nền.
- Debug Mode: hiển thị collider, thông tin vật lý.

### 🧭 Điều Khiển Bằng Bàn Phím

| Phím       | Chức Năng                                      |
|------------|------------------------------------------------|
| W / ↑      | Di chuyển tiến                                 |
| S / ↓      | Di chuyển lùi                                  |
| A / ←      | Rẽ trái                                        |
| D / →      | Rẽ phải                                        |
| SPACE      | Phanh                                          |
| B          | Tăng tốc (Boost)                               |
| H          | Bấm còi                                        |
| O          | Thay đổi chế độ camera                         |
| V          | Chuyển sang chế độ xem tự do (OrbitControls)  |
| P          | Bật/tắt Debug Mode                             |
| R          | Tải lại game                                   |
| ESC        | Thoát về menu chính                            |

---

## 🛠️ 6. Cài Đặt & Chạy Dự Án

### Yêu Cầu

- **Node.js** >= 18.x
- **npm** (đi kèm với Node.js)
- Trình duyệt hỗ trợ WebGL (Chrome, Firefox,...)

### Các Bước Thực Hiện

```bash
# 1. Clone dự án
git clone https://github.com/PHTLing/ZippyFarm.git
cd ZippyFarm

# 2. Cài đặt dependencies
npm install
```

### Thêm bản đồ nông trại

> ⚠️ **Lưu ý:** File bản đồ `Map_Farm.glb` không được commit vào repository do dung lượng. Vui lòng tải file từ link được cung cấp riêng và đặt vào thư mục:
```
ZippyFarm/assets/models/Map_Farm.glb
```

### Chạy game bằng Live Server

- Với **VS Code**: Mở file `index.html`, click chuột phải → **Open with Live Server**.
- Với **Python**:
```bash
python -m http.server 8000
# Truy cập tại http://localhost:8000/
```

---

## 💡 6. Hướng Phát Triển

- Thêm chế độ nhiều người chơi (Multiplayer).
- Tích hợp hệ thống nhiệm vụ (quest), thu thập điểm, nâng cấp xe.
- Bổ sung thời tiết, ngày đêm, hệ thống trồng trọt, thu hoạch.
- Tối ưu hiệu năng để chạy tốt trên thiết bị di động.

---

## 👨‍💻 7. Nhóm Thực Hiện

| Họ tên              | MSSV       | Nhiệm vụ chính                              |
|---------------------|------------|---------------------------------------------|
| Phạm Hồ Trúc Linh   | 22520777   | Thiết kế mô hình, dựng cảnh, animation      |
| Huỳnh Trung Nghĩa   | 22520945   | Xử lý điều khiển xe, vật lý tương tác       |
| Nguyễn Hồng Phát    | 22521072   | Xây dựng hệ thống và giao diện người dùng   |

---

## 📄 License

Dự án sử dụng cho mục đích học thuật. Không sử dụng lại tài sản (mô hình, hình ảnh, âm thanh) trong mục đích thương mại nếu không có giấy phép rõ ràng.
