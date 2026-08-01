export class CreateInvoiceDto {
  appointmentId!: number;
  subtotal!: number;
  serviceFee?: number;
  discount?: number;
  dueDate?: string;
  note?: string;
}
