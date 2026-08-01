export class RecordPaymentDto {
  amount!: number;
  paymentMethod!: string;
  paidAt?: string;
  note?: string;
}
