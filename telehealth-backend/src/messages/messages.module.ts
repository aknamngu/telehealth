import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MessagesGateway } from './messages.gateway';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  controllers: [MessagesController],
  // Khai báo thêm MessagesGateway và PrismaService để NestJS tự động tiêm dependencies
  providers: [MessagesService, MessagesGateway, PrismaService, JwtAuthGuard, RolesGuard],
})
export class MessagesModule {}