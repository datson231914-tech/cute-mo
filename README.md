# 🫧 Bong Bóng Lời Chúc — chủ đề biển cả

Màn hình chính hiện mã QR. Khách quét mã bằng điện thoại để gửi lời chúc (tối đa 200).
Khi bạn bấm **Thả bong bóng**, các lời chúc hoá thành bong bóng bay lên giữa đại dương.

## 1. Cài đặt (chỉ làm một lần)

Cài **Node.js** bản 18 trở lên: https://nodejs.org (chọn bản LTS). Bạn không cần cài thêm gì khác.

## 2. Đổi tiêu đề sự kiện

Mở `server.js` bằng Notepad, sửa dòng:

```js
const TITLE = process.env.TITLE || "Gửi Lời Chúc Yêu Thương";
```

Ví dụ đổi thành `"Happy Wedding Minh & Lan"`. Dòng `MAX_WISHES` bên dưới là số lời chúc tối đa (mặc định 200).

## 3. Chạy

- **Windows:** nhấp đúp `start.bat`
- **macOS / Linux:** mở Terminal trong thư mục này rồi gõ `node server.js`

Sau đó mở trình duyệt trên máy chiếu: **http://localhost:3000**

## 4. Cho khách kết nối

### Cách A: Khách dùng chung Wi‑Fi với máy tính (đơn giản nhất)

Mã QR tự trỏ đến địa chỉ mạng nội bộ của máy (ví dụ `http://192.168.1.15:3000/guest`).

- Nếu Windows hỏi quyền tường lửa, chọn **Allow / Cho phép**.
- Nếu khách quét mã mà không vào được trang, có thể Wi‑Fi nơi tổ chức đang chặn các thiết bị nói chuyện với nhau. Khi đó, hãy dùng Cách B.

### Cách B: Qua Internet, khách dùng 4G cũng được (miễn phí)

1. Cài Cloudflare Tunnel: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. Trong khi `server.js` đang chạy, mở một cửa sổ Terminal khác và gõ:
   ```
   cloudflared tunnel --url http://localhost:3000
   ```
3. Nó sẽ in ra một địa chỉ dạng `https://xxxx.trycloudflare.com`. **Mở chính địa chỉ đó** trên máy chiếu. Mã QR sẽ tự dùng địa chỉ này.

Bạn cũng có thể đưa thư mục này lên Render.com hoặc Railway (dạng Node app, lệnh chạy `node server.js`).

## 5. Điều khiển trên màn hình chính

| Thao tác | Tác dụng |
|---|---|
| Nút **Play** hoặc phím **Space** | Thả bong bóng |
| Phím **F** hoặc nút ⛶ ở góc trên | Bật hoặc tắt toàn màn hình |
| Bấm vào một bong bóng | Bong bóng vỡ và lời chúc hiện to giữa màn hình |

- Bong bóng bay liên tục và lặp lại cho đến khi bạn tắt trang.
- Có thể ép mã QR dùng địa chỉ khác: `http://localhost:3000/?url=https://dia-chi-cua-ban`

## 6. Ghi chú

- Lời chúc được lưu trong `wishes.json`, nên bạn có thể tắt máy chủ rồi bật lại mà không mất lời chúc nào.
- Xoá toàn bộ lời chúc để dùng cho sự kiện mới: `node server.js --reset`
- Mỗi điện thoại gửi được 1 lời chúc, tối đa 150 ký tự.
- Font chữ đẹp (Dancing Script, Be Vietnam Pro) được tải từ Google Fonts. Khi không có Internet, trang vẫn chạy bình thường nhưng sẽ dùng font của máy.

## 7. Bảo mật đã có sẵn

- Lời chúc luôn hiển thị dưới dạng chữ thuần. Ai gõ mã HTML hoặc JavaScript vào lời chúc thì mã đó cũng chỉ hiện ra như chữ, không chạy được.
- Có chính sách bảo mật nội dung (CSP) với nonce: trình duyệt chỉ chạy script của chính trang web.
- Máy chủ chỉ trả về đúng 6 file giao diện. Không ai tải được `server.js` hay `wishes.json`.
- Từ chối yêu cầu gửi từ trang web lạ, dữ liệu sai định dạng hoặc quá 2 KB.
- Tự xoá các ký tự ẩn hoặc ký tự đảo chiều văn bản thường dùng để giả mạo nội dung.
- Mỗi IP gửi tối đa 30 lần mỗi phút để chống spam. Khách dùng chung Wi‑Fi vẫn gửi bình thường.
- Chống các kết nối treo cố tình làm nghẽn máy chủ. Có thêm các header bảo mật: X-Frame-Options, nosniff, Referrer-Policy, HSTS.

## 8. Tải lên GitHub

Giải nén rồi kéo **toàn bộ nội dung** bên trong thư mục `bong-bong-loi-chuc` vào GitHub. Trên GitHub phải thấy `server.js`, `package.json` và thư mục `public` chứa 5 file. Nếu các file trong `public` lỡ nằm ngoài cùng, máy chủ vẫn tự tìm thấy và chạy được.
