import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Global() // <--- Thần chú biến Module này thành toàn cục
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // Export ra cho các module khác xài
})
export class PrismaModule {}