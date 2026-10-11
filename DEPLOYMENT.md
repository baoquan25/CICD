# Deploy frontend lên server qua GitHub Actions

Workflow ở `.github/workflows/deploy-frontend.yml` chạy lint và build cho pull request vào `main`. Khi push lên `main`, nó build Docker image, chuyển image qua SSH và chạy container `legalsight-frontend` trên `ducminh@tanhungsoft.com`.

Ứng dụng chỉ mở ở `127.0.0.1:3000` trên server để test qua SSH tunnel. Hiện repo chỉ có frontend, nên các chức năng gọi API chưa hoạt động cho đến khi có backend.

## 1. Chuẩn bị trên máy của bạn

Tạo một SSH key riêng cho GitHub Actions (không commit private key):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/legalsight_deploy -C "github-actions-legalsight" -N ""
```

Thêm public key vào tài khoản `ducminh` trên server. Nếu server cho phép đăng nhập bằng mật khẩu:

```bash
ssh-copy-id -i ~/.ssh/legalsight_deploy.pub ducminh@tanhungsoft.com
```

Nếu không dùng được `ssh-copy-id`, đăng nhập server bằng phương thức hiện có và thêm **nội dung** file `~/.ssh/legalsight_deploy.pub` vào `~/.ssh/authorized_keys` của user `ducminh` (mỗi key một dòng). Sau đó kiểm tra:

```bash
ssh -i ~/.ssh/legalsight_deploy -o BatchMode=yes ducminh@tanhungsoft.com 'whoami && docker info >/dev/null'
```

Kết quả phải hiện `ducminh` và lệnh kết thúc thành công. Nếu `docker info` báo thiếu quyền, thêm user vào nhóm Docker trên server bằng tài khoản có quyền sudo, rồi đăng xuất và đăng nhập lại:

```bash
sudo usermod -aG docker ducminh
```

## 2. Chuẩn bị trên server

Đăng nhập server bằng tài khoản `ducminh` và chạy:

```bash
mkdir -p ~/apps/legalsight-frontend
touch ~/apps/legalsight-frontend/.env
chmod 600 ~/apps/legalsight-frontend/.env
docker info >/dev/null
```

File `.env` có thể để trống khi chưa có backend. Sau này, đặt `BACKEND_INTERNAL_URL` trong file này thành địa chỉ backend mà **container frontend** truy cập được. Không dùng `localhost` để chỉ backend chạy bên ngoài container frontend. Workflow đã cấu hình tên `host.docker.internal` cho trường hợp backend chạy trên host và lắng nghe ở địa chỉ Docker bridge.

## 3. Khai báo GitHub Secrets

Vào repository GitHub → **Settings → Secrets and variables → Actions → New repository secret** và tạo:

| Secret | Giá trị |
| --- | --- |
| `DEPLOY_SSH_KEY` | Toàn bộ nội dung private key `~/.ssh/legalsight_deploy` trên máy bạn. |
| `DEPLOY_KNOWN_HOSTS` | Dòng host key ED25519 của `tanhungsoft.com`, lấy theo hướng dẫn dưới đây. |

Lấy host key từ máy của bạn:

```bash
ssh-keyscan -t ed25519 tanhungsoft.com > /tmp/legalsight_known_hosts
ssh-keygen -lf /tmp/legalsight_known_hosts
```

Đối chiếu fingerprint in ra với fingerprint trên server (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`, có thể cần chạy qua console của nhà cung cấp server). Khi khớp, copy **nội dung dòng host key** trong `/tmp/legalsight_known_hosts` vào secret `DEPLOY_KNOWN_HOSTS`. Việc đối chiếu này xác nhận SSH đang kết nối đúng server.

## 4. Kích hoạt deploy

Trong thư mục repo `frontend`, commit và push lên `main`:

```bash
git add .github/workflows/deploy-frontend.yml DEPLOYMENT.md Dockerfile
git commit -m "Deploy frontend to server via SSH"
git push origin main
```

Mở tab **Actions** trên GitHub và xem workflow **Frontend CI/CD**. Lần deploy thành công sẽ có container `legalsight-frontend` trên server:

```bash
docker ps --filter name=legalsight-frontend
docker logs --tail 50 legalsight-frontend
```

Pull request vào `main` chỉ chạy lint và build. Push lên `main` hoặc chạy thủ công workflow trên nhánh `main` sẽ deploy.

## 5. Test từ máy của bạn

Giữ terminal sau mở để tạo SSH tunnel:

```bash
ssh -i ~/.ssh/legalsight_deploy -N -L 3000:127.0.0.1:3000 ducminh@tanhungsoft.com
```

Mở `http://localhost:3000` trên máy của bạn. Nếu cổng 3000 trên máy đã dùng, đổi `3000` **bên trái** trong `-L` thành `3001`, rồi mở `http://localhost:3001`.

Nếu trang lên nhưng các thao tác đăng nhập/tài liệu trả lỗi 503, đó là do backend chưa được triển khai hoặc `BACKEND_INTERNAL_URL` chưa cấu hình.
