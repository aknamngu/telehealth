import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3000);

  const configuredOrigins = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    ...configuredOrigins,
  ]);

  app.enableCors({
    origin: (origin, callback) => {
      // Cho phép request không có Origin (curl, webhook Casso, server-to-server).
      if (!origin) {
        callback(null, true);
        return;
      }

      // Cho phép localhost và các Quick Tunnel của Cloudflare dùng khi demo.
      const isCloudflareQuickTunnel = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i.test(
        origin,
      );

      if (allowedOrigins.has(origin) || isCloudflareQuickTunnel) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${origin}`), false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.listen(port);
  console.log(`🚀 Backend TeleHealth đang chạy mượt mà tại: http://localhost:${port}`);
}
bootstrap();
