import 'dotenv/config';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

function normalizeDatabaseUrl(databaseUrl: string) {
  if (databaseUrl.includes('allowPublicKeyRetrieval=')) {
    return databaseUrl;
  }

  const separator = databaseUrl.includes('?') ? '&' : '?';
  return `${databaseUrl}${separator}allowPublicKeyRetrieval=true&useSSL=false`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const adapter = new PrismaMariaDb(normalizeDatabaseUrl(process.env.DATABASE_URL!));
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('🔌 Kết nối MySQL Docker THÀNH CÔNG!');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}