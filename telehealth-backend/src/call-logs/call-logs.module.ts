import { Module } from '@nestjs/common';
import { CallLogsService } from './call-logs.service';
import { CallLogsController } from './call-logs.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  controllers: [CallLogsController],
  providers: [CallLogsService, JwtAuthGuard, RolesGuard],
})
export class CallLogsModule {}
