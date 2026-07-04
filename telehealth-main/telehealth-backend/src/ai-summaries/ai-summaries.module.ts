import { Module } from '@nestjs/common';
import { AiSummariesService } from './ai-summaries.service';
import { AiSummariesController } from './ai-summaries.controller';

@Module({
  controllers: [AiSummariesController],
  providers: [AiSummariesService],
})
export class AiSummariesModule {}
