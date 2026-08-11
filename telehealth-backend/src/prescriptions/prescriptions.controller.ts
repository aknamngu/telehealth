import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import QRCode from 'qrcode';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  // Cổng công khai để nhà thuốc/người bệnh kiểm tra tính toàn vẹn của đơn.
  @Get('verify/:token/qr')
  async qrCode(
    @Param('token') token: string,
    @Query('baseUrl') baseUrl: string | undefined,
    @Res() response: Response,
  ) {
    await this.prescriptionsService.verify(token);
    const safeBaseUrl = /^https?:\/\//i.test(baseUrl ?? '')
      ? baseUrl!.replace(/\/$/, '')
      : 'http://localhost:5173';
    const image = await QRCode.toBuffer(
      `${safeBaseUrl}/prescriptions/verify/${encodeURIComponent(token)}`,
      {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 360,
      },
    );
    response.type('image/png').send(image);
  }

  @Get('verify/:token')
  verify(@Param('token') token: string) {
    return this.prescriptionsService.verify(token);
  }

  // Cổng tạo đơn thuốc: POST http://localhost:3000/prescriptions
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR', 'ADMIN')
  @Post()
  create(
    @Body() createPrescriptionDto: CreatePrescriptionDto,
    @CurrentUser() user: { sub: number; role: string },
  ) {
    return this.prescriptionsService.create(createPrescriptionDto, user);
  }

  // Cổng lấy danh sách đơn thuốc: GET http://localhost:3000/prescriptions
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT', 'DOCTOR', 'ADMIN')
  @Get()
  findAll(@CurrentUser() user: { sub: number; role: string }) {
    return this.prescriptionsService.findAll(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR', 'ADMIN')
  @Post(':id/revoke')
  revoke(
    @Param('id') id: string,
    @CurrentUser() user: { sub: number; role: string },
  ) {
    return this.prescriptionsService.revoke(+id, user);
  }
}
