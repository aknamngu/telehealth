// main.ts - thêm dòng này lên ĐẦU TIÊN để nạp biến môi trường từ .env
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // KÍCH HOẠT CORS: Cho phép mọi nguồn Frontend (React/Vite) kết nối vào Backend real-time
  app.enableCors({
    origin: '*', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Chạy ứng dụng tại cổng 3000 quen thuộc
  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Backend TeleHealth đang chạy mượt mà tại: http://localhost:3000`);
}
bootstrap();