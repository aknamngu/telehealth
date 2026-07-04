// main.ts - thêm dòng này lên ĐẦU TIÊN để nạp biến môi trường từ .env
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3000);
  const frontendOrigin = process.env.FRONTEND_URL ?? '*';

  // KÍCH HOẠT CORS: Cho phép mọi nguồn Frontend (React/Vite) kết nối vào Backend real-time
  app.enableCors({
    origin: frontendOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Chạy ứng dụng tại cổng cấu hình trong .env
  await app.listen(port);
  console.log(`🚀 Backend TeleHealth đang chạy mượt mà tại: http://localhost:${port}`);
}
bootstrap();