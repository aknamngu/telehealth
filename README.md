# DoAnTeleHealth

Project telehealth gồm 2 phần:

- `telehealth-backend`: NestJS API
- `telehealth-frontend`: React + Vite UI

## Chạy local

Yêu cầu: cài `Node.js` và `npm`.

### 1) Cài dependency

```bash
cd telehealth-backend
npm install

cd ../telehealth-frontend
npm install
```

### 2) Chạy backend

```bash
cd telehealth-backend
npm run start:dev
```

API mặc định chạy ở `http://localhost:3000`.

### 3) Chạy frontend

```bash
cd telehealth-frontend
npm run dev
```

Frontend Vite sẽ in ra địa chỉ local, thường là `http://localhost:5173` hoặc cổng kế tiếp nếu cổng đó đang bận.

## Build kiểm tra

```bash
cd telehealth-backend
npm run build

cd ../telehealth-frontend
npm run build
```

## Đẩy lên GitHub

```bash
git init
git add .
git commit -m "Initial telehealth project"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

## Bạn của bạn tải về

```bash
git clone https://github.com/<username>/<repo>.git
```

Sau đó chạy lại phần cài dependency và dev như trên.