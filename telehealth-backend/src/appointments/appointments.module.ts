import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  controllers: [AppointmentsController],
  providers: [AppointmentsService, JwtAuthGuard, RolesGuard],
})
export class AppointmentsModule {}
