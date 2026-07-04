import { Module } from '@nestjs/common';
import { VitalSignsService } from './vital-signs.service';
import { VitalSignsController } from './vital-signs.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  controllers: [VitalSignsController],
  providers: [VitalSignsService, JwtAuthGuard, RolesGuard],
})
export class VitalSignsModule {}
