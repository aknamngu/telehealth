import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class WalletService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async getWallet(userId: number) {
    let wallet = await this.prisma.wallet.findUnique({ where: { userId } });

    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: { userId, balance: 1000000 },
      });
    }

    return { message: 'Lấy thông tin ví thành công', data: wallet };
  }

  async getMyInvoices(userId: number) {
    const invoices = await this.prisma.invoice.findMany({
      where: { patientId: userId },
      include: {
        appointment: {
          include: { doctor: { select: { fullName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { message: 'Lấy danh sách hoá đơn thành công', data: invoices };
  }

  async getAllInvoices() {
    const invoices = await this.prisma.invoice.findMany({
      include: {
        appointment: {
          include: {
            doctor: { select: { fullName: true } },
            patient: { select: { fullName: true, email: true } },
          },
        },
        patient: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { message: 'Lấy tất cả hoá đơn thành công', data: invoices };
  }

  async getInvoicePaymentStatus(invoiceId: number, userId: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        patientId: true,
        appointmentId: true,
        amount: true,
        status: true,
        paymentMethod: true,
        paymentCode: true,
        paidAt: true,
      },
    });

    if (!invoice) throw new NotFoundException('Không tìm thấy hoá đơn');
    if (invoice.patientId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xem hoá đơn này.');
    }

    return { message: 'Lấy trạng thái thanh toán thành công', data: invoice };
  }

  async handleCassoWebhook(receivedToken: string | undefined, payload: any) {
    const expectedToken = this.config.get<string>('CASSO_WEBHOOK_SECRET')?.trim();
    if (!expectedToken) {
      throw new ServiceUnavailableException('Webhook Casso chưa được cấu hình.');
    }

    const actual = (receivedToken ?? '').trim();
    const expectedBuffer = Buffer.from(expectedToken);
    const actualBuffer = Buffer.from(actual);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Webhook token không hợp lệ.');
    }

    const rawTransactions = Array.isArray(payload?.data)
      ? payload.data
      : payload?.data
        ? [payload.data]
        : [];
    let paid = 0;
    let ignored = 0;

    for (const transaction of rawTransactions) {
      const amount = Number(transaction?.amount ?? 0);
      const description = String(transaction?.description ?? '');
      const transactionId = String(
        transaction?.tid ?? transaction?.reference ?? transaction?.id ?? '',
      ).trim();

      if (!transactionId || amount <= 0 || !description) {
        ignored += 1;
        continue;
      }

      const duplicate = await this.prisma.invoice.findUnique({
        where: { bankTransactionId: transactionId },
        select: { id: true },
      });
      if (duplicate) {
        ignored += 1;
        continue;
      }

      const normalizedDescription = description
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
      const pendingInvoices = await this.prisma.invoice.findMany({
        where: {
          status: 'PENDING',
          paymentMethod: 'CASSO',
          paymentCode: { not: null },
        },
        select: { id: true, amount: true, paymentCode: true },
      });
      const matchedInvoice = pendingInvoices.find((invoice) =>
        normalizedDescription.includes(
          String(invoice.paymentCode).toUpperCase().replace(/[^A-Z0-9]/g, ''),
        ),
      );

      if (!matchedInvoice || amount < matchedInvoice.amount) {
        ignored += 1;
        continue;
      }

      const update = await this.prisma.invoice.updateMany({
        where: { id: matchedInvoice.id, status: 'PENDING' },
        data: {
          status: 'PAID',
          bankTransactionId: transactionId,
          paidAt: new Date(),
        },
      });
      if (update.count === 1) paid += 1;
      else ignored += 1;
    }

    return {
      error: 0,
      message: 'success',
      data: { received: rawTransactions.length, paid, ignored },
    };
  }

  async processRefund(invoiceId: number) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Không tìm thấy hoá đơn');
    if (invoice.status !== 'PENDING_REFUND') {
      throw new Error('Hoá đơn này không trong trạng thái chờ hoàn tiền!');
    }

    if (invoice.paymentMethod === 'WALLET') {
      await this.prisma.wallet.update({
        where: { userId: invoice.patientId },
        data: { balance: { increment: invoice.amount } },
      });
    }

    const updatedInvoice = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'REFUNDED' },
    });

    return { message: 'Đã hoàn tiền thành công cho bệnh nhân', data: updatedInvoice };
  }
}
