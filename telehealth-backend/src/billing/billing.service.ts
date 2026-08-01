import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

type AuthUser = { sub: number; role: string };

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  private toMoney(value: number | undefined, fieldName: string) {
    const resolvedValue = value ?? 0;

    if (Number.isNaN(resolvedValue) || resolvedValue < 0) {
      throw new BadRequestException(`${fieldName} phải là số không âm hợp lệ.`);
    }

    return Number(resolvedValue.toFixed(2));
  }

  private buildInvoiceStatus(totalAmount: number, paidAmount: number, dueDate?: Date | null) {
    if (paidAmount >= totalAmount) {
      return 'PAID';
    }

    if (paidAmount > 0) {
      return 'PARTIAL';
    }

    if (dueDate && dueDate.getTime() < Date.now()) {
      return 'OVERDUE';
    }

    return 'UNPAID';
  }

  private async resolveInvoiceScope(user: AuthUser, invoiceId: number) {
    const invoice = await this.prisma.billingInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        appointment: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Không tìm thấy hóa đơn công nợ tương ứng.');
    }

    if (user.role === 'DOCTOR' && invoice.appointment.doctorId !== user.sub) {
      throw new ForbiddenException('Bác sĩ chỉ được thao tác công nợ của lịch hẹn do mình phụ trách.');
    }

    if (user.role === 'PATIENT' && invoice.appointment.patientId !== user.sub) {
      throw new ForbiddenException('Bạn chỉ được xem công nợ của chính mình.');
    }

    return invoice;
  }

  async createInvoice(createInvoiceDto: CreateInvoiceDto, user: AuthUser) {
    if (user.role === 'PATIENT') {
      throw new ForbiddenException('Bệnh nhân không có quyền tạo hóa đơn công nợ.');
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: createInvoiceDto.appointmentId },
      include: { billingInvoice: true },
    });

    if (!appointment) {
      throw new BadRequestException('Không tìm thấy lịch hẹn để tạo hóa đơn.');
    }

    if (appointment.billingInvoice) {
      throw new BadRequestException('Lịch hẹn này đã có hóa đơn công nợ.');
    }

    if (user.role === 'DOCTOR' && appointment.doctorId !== user.sub) {
      throw new ForbiddenException('Bác sĩ chỉ được tạo hóa đơn cho lịch hẹn của chính mình.');
    }

    const subtotal = this.toMoney(createInvoiceDto.subtotal, 'subtotal');
    const serviceFee = this.toMoney(createInvoiceDto.serviceFee, 'serviceFee');
    const discount = this.toMoney(createInvoiceDto.discount, 'discount');
    const totalAmount = Number((subtotal + serviceFee - discount).toFixed(2));

    if (totalAmount < 0) {
      throw new BadRequestException('Tổng tiền hóa đơn không hợp lệ.');
    }

    const dueDate = createInvoiceDto.dueDate ? new Date(createInvoiceDto.dueDate) : null;
    if (dueDate && Number.isNaN(dueDate.getTime())) {
      throw new BadRequestException('dueDate không hợp lệ.');
    }

    const invoice = await this.prisma.billingInvoice.create({
      data: {
        appointmentId: createInvoiceDto.appointmentId,
        subtotal,
        serviceFee,
        discount,
        totalAmount,
        paidAmount: 0,
        dueDate,
        note: createInvoiceDto.note?.trim() || null,
        status: this.buildInvoiceStatus(totalAmount, 0, dueDate),
      },
      include: {
        appointment: {
          include: {
            patient: { select: { id: true, fullName: true, email: true } },
            doctor: { select: { id: true, fullName: true, email: true } },
          },
        },
        payments: true,
      },
    });

    return {
      message: 'Tạo hóa đơn công nợ thành công!',
      data: invoice,
    };
  }

  async recordPayment(invoiceId: number, recordPaymentDto: RecordPaymentDto, user: AuthUser) {
    if (user.role === 'PATIENT') {
      throw new ForbiddenException('Bệnh nhân không có quyền cập nhật thanh toán công nợ.');
    }

    const invoice = await this.resolveInvoiceScope(user, invoiceId);
    const amount = this.toMoney(recordPaymentDto.amount, 'amount');
    if (amount <= 0) {
      throw new BadRequestException('Số tiền thanh toán phải lớn hơn 0.');
    }

    const currentPaidAmount = Number(invoice.paidAmount);
    const totalAmount = Number(invoice.totalAmount);
    const nextPaidAmount = Number((currentPaidAmount + amount).toFixed(2));

    if (nextPaidAmount > totalAmount) {
      throw new BadRequestException('Số tiền thanh toán vượt quá tổng hóa đơn.');
    }

    const paidAt = recordPaymentDto.paidAt ? new Date(recordPaymentDto.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) {
      throw new BadRequestException('paidAt không hợp lệ.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.paymentTransaction.create({
        data: {
          invoiceId,
          amount,
          paymentMethod: recordPaymentDto.paymentMethod,
          paidAt,
          note: recordPaymentDto.note?.trim() || null,
          createdById: user.sub,
        },
      });

      return tx.billingInvoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: nextPaidAmount,
          status: this.buildInvoiceStatus(totalAmount, nextPaidAmount, invoice.dueDate),
        },
        include: {
          appointment: {
            include: {
              patient: { select: { id: true, fullName: true, email: true } },
              doctor: { select: { id: true, fullName: true, email: true } },
            },
          },
          payments: {
            orderBy: { paidAt: 'desc' },
          },
        },
      });
    });

    return {
      message: 'Ghi nhận thanh toán công nợ thành công!',
      data: updated,
    };
  }

  async findAll(user: AuthUser) {
    const where =
      user.role === 'ADMIN'
        ? undefined
        : user.role === 'DOCTOR'
          ? { appointment: { is: { doctorId: user.sub } } }
          : { appointment: { is: { patientId: user.sub } } };

    const invoices = await this.prisma.billingInvoice.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      include: {
        appointment: {
          include: {
            patient: { select: { id: true, fullName: true, email: true } },
            doctor: { select: { id: true, fullName: true, email: true } },
          },
        },
        payments: {
          orderBy: { paidAt: 'desc' },
        },
      },
    });

    return {
      message: 'Tải danh sách công nợ thành công!',
      data: invoices,
    };
  }

  async getSummary(user: AuthUser) {
    const invoices = (await this.findAll(user)).data;
    const totalReceivable = invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
    const totalCollected = invoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount), 0);
    const outstanding = Number((totalReceivable - totalCollected).toFixed(2));
    const overdueCount = invoices.filter((invoice) => invoice.status === 'OVERDUE').length;
    const unpaidCount = invoices.filter((invoice) => invoice.status === 'UNPAID').length;
    const partialCount = invoices.filter((invoice) => invoice.status === 'PARTIAL').length;
    const paidCount = invoices.filter((invoice) => invoice.status === 'PAID').length;

    return {
      message: 'Tải tổng quan công nợ thành công!',
      data: {
        invoiceCount: invoices.length,
        totalReceivable: Number(totalReceivable.toFixed(2)),
        totalCollected: Number(totalCollected.toFixed(2)),
        outstanding,
        overdueCount,
        unpaidCount,
        partialCount,
        paidCount,
      },
    };
  }
}
