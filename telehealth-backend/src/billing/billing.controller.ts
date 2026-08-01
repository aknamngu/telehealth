import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCTOR')
  @Post('invoices')
  createInvoice(@Body() createInvoiceDto: CreateInvoiceDto, @CurrentUser() user: { sub: number; role: string }) {
    return this.billingService.createInvoice(createInvoiceDto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCTOR')
  @Post('invoices/:invoiceId/payments')
  recordPayment(
    @Param('invoiceId') invoiceId: string,
    @Body() recordPaymentDto: RecordPaymentDto,
    @CurrentUser() user: { sub: number; role: string },
  ) {
    return this.billingService.recordPayment(+invoiceId, recordPaymentDto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCTOR', 'PATIENT')
  @Get('invoices')
  findAll(@CurrentUser() user: { sub: number; role: string }) {
    return this.billingService.findAll(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCTOR', 'PATIENT')
  @Get('summary')
  getSummary(@CurrentUser() user: { sub: number; role: string }) {
    return this.billingService.getSummary(user);
  }
}
