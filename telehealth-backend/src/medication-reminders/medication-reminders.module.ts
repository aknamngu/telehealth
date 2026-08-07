import { Module } from '@nestjs/common';
import { MedicationRemindersService } from './medication-reminders.service';
import { MedicationRemindersController } from './medication-reminders.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [MedicationRemindersController],
  providers: [MedicationRemindersService, PrismaService],
  exports: [MedicationRemindersService],
})
export class MedicationRemindersModule {}
