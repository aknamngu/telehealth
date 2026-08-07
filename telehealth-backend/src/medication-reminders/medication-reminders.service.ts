import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MedicationRemindersService {
  constructor(private readonly prisma: PrismaService) {}

  // Lấy danh sách nhắc uống thuốc của bệnh nhân
  async findByPatient(patientId: number) {
    const reminders = await this.prisma.medicationReminder.findMany({
      where: { patientId },
      include: {
        prescription: {
          include: {
            appointment: {
              include: {
                doctor: { select: { fullName: true } }
              }
            }
          }
        }
      },
      orderBy: { reminderTime: 'asc' }
    });
    return { message: 'Lấy lịch nhắc thuốc thành công!', data: reminders };
  }

  // Tạo nhắc uống thuốc mới
  async create(patientId: number, dto: { prescriptionId: number; medicineName: string; reminderTime: string }) {
    const prescription = await this.prisma.prescription.findFirst({
      where: {
        id: dto.prescriptionId,
        appointment: { patientId }
      }
    });
    if (!prescription) throw new NotFoundException('Không tìm thấy đơn thuốc hợp lệ!');

    const reminder = await this.prisma.medicationReminder.create({
      data: {
        patientId,
        prescriptionId: dto.prescriptionId,
        medicineName: dto.medicineName,
        reminderTime: dto.reminderTime,
        isActive: true,
      }
    });
    return { message: 'Đặt lịch nhắc uống thuốc thành công!', data: reminder };
  }

  // Toggle bật/tắt nhắc nhở
  async toggle(id: number, patientId: number) {
    const reminder = await this.prisma.medicationReminder.findUnique({ where: { id } });
    if (!reminder) throw new NotFoundException('Không tìm thấy lịch nhắc!');
    if (reminder.patientId !== patientId) throw new ForbiddenException('Bạn không có quyền chỉnh sửa lịch này!');
    const updated = await this.prisma.medicationReminder.update({
      where: { id },
      data: { isActive: !reminder.isActive }
    });
    return { message: `Đã ${updated.isActive ? 'bật' : 'tắt'} lịch nhắc!`, data: updated };
  }

  // Xóa lịch nhắc
  async remove(id: number, patientId: number) {
    const reminder = await this.prisma.medicationReminder.findUnique({ where: { id } });
    if (!reminder) throw new NotFoundException('Không tìm thấy lịch nhắc!');
    if (reminder.patientId !== patientId) throw new ForbiddenException('Bạn không có quyền xóa lịch này!');
    await this.prisma.medicationReminder.delete({ where: { id } });
    return { message: 'Đã xóa lịch nhắc uống thuốc!' };
  }
}
