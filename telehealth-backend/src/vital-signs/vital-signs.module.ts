import { Module } from '@nestjs/common';
import { VitalSignsService } from './vital-signs.service';
import { VitalSignsController } from './vital-signs.controller';

@Module({
  controllers: [VitalSignsController],
  providers: [VitalSignsService],
})
export class VitalSignsModule {}
