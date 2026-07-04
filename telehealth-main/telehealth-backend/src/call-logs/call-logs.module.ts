import { Module } from '@nestjs/common';
import { CallLogsService } from './call-logs.service';
import { CallLogsController } from './call-logs.controller';

@Module({
  controllers: [CallLogsController],
  providers: [CallLogsService],
})
export class CallLogsModule {}
