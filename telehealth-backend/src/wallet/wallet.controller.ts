import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  // Lấy thông tin ví của mình
  @Get('me')
  getWallet(@Request() req: any) {
    return this.walletService.getWallet(req.user.sub);
  }

  // Lấy danh sách hoá đơn của mình (Bệnh nhân)
  @Get('invoices/me')
  @Roles('PATIENT')
  @UseGuards(RolesGuard)
  getMyInvoices(@Request() req: any) {
    return this.walletService.getMyInvoices(req.user.sub);
  }

  // Lấy tất cả hoá đơn (Admin)
  @Get('invoices')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  getAllInvoices() {
    return this.walletService.getAllInvoices();
  }

  // Xử lý duyệt hoàn tiền (Admin)
  @Post('invoices/:id/refund')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  processRefund(@Param('id') id: string) {
    return this.walletService.processRefund(+id);
  }
}
