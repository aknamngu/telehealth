import { Module } from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { PrescriptionsController } from './prescriptions.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService, JwtAuthGuard, RolesGuard],
})
export class PrescriptionsModule {}
