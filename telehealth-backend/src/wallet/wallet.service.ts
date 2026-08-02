import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  async getWallet(userId: number) {
    let wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: {
          userId,
          balance: 1000000, // Tặng 1 triệu VNĐ mặc định
        },
      });
    }

    return {
      message: 'Lấy thông tin ví thành công',
      data: wallet,
    };
  }

  async getMyInvoices(userId: number) {
    const invoices = await this.prisma.invoice.findMany({
      where: { patientId: userId },
      include: {
        appointment: {
          include: {
            doctor: { select: { fullName: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return {
      message: 'Lấy danh sách hoá đơn thành công',
      data: invoices,
    };
  }

  async getAllInvoices() {
    const invoices = await this.prisma.invoice.findMany({
      include: {
        appointment: {
          include: {
            doctor: { select: { fullName: true } },
            patient: { select: { fullName: true, email: true } },
          }
        },
        patient: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return {
      message: 'Lấy tất cả hoá đơn thành công',
      data: invoices,
    };
  }

  async processRefund(invoiceId: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) throw new NotFoundException('Không tìm thấy hoá đơn');
    if (invoice.status !== 'PENDING_REFUND') {
      throw new Error('Hoá đơn này không trong trạng thái chờ hoàn tiền!');
    }

    // Hoàn tiền cho bệnh nhân
    await this.prisma.wallet.update({
      where: { userId: invoice.patientId },
      data: {
        balance: {
          increment: invoice.amount,
        }
      }
    });

    // Cập nhật trạng thái hoá đơn
    const updatedInvoice = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'REFUNDED',
      }
    });

    return {
      message: 'Đã hoàn tiền thành công cho bệnh nhân',
      data: updatedInvoice,
    };
  }
}
