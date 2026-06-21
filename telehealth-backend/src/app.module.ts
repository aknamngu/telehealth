import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DoctorsModule } from './doctors/doctors.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { CallLogsModule } from './call-logs/call-logs.module';
import { VitalSignsModule } from './vital-signs/vital-signs.module';
import { AiSummariesModule } from './ai-summaries/ai-summaries.module';
import { MessagesModule } from './messages/messages.module';

@Module({
  imports: [
    // Gộp chung tất cả các module cần import vào cùng một mảng này nha!
    ConfigModule.forRoot({
      isGlobal: true, 
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    DoctorsModule,
    AppointmentsModule,
    PrescriptionsModule,
    CallLogsModule,
    VitalSignsModule,
    AiSummariesModule,
    MessagesModule,
   
  ],
  controllers: [AppController],
  providers: [AppService], // Xóa bỏ PrismaService ở đây vì đã có PrismaModule lo rồi!
})
export class AppModule {}