import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'telehealth-backend/prisma/schema.prisma');
let source = fs.readFileSync(file, 'utf8');

if (source.includes('bankTransactionId')) {
  console.log('OK: Invoice schema đã có đầy đủ field Casso.');
  process.exit(0);
}

const invoiceRegex = /model Invoice \{[\s\S]*?\n\}/;
const match = source.match(invoiceRegex);
if (!match) {
  throw new Error('Không tìm thấy model Invoice trong schema.prisma');
}

const replacement = `model Invoice {
  id                Int         @id @default(autoincrement())
  appointmentId     Int         @unique
  patientId         Int
  amount            Float
  status            String      // 'PENDING', 'PAID', 'PENDING_REFUND', 'REFUNDED'
  paymentMethod     String      @default("WALLET")
  paymentCode       String?     @unique @db.VarChar(32)
  bankTransactionId String?     @unique @db.VarChar(191)
  paidAt            DateTime?
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  appointment       Appointment @relation(fields: [appointmentId], references: [id])
  patient           User        @relation(fields: [patientId], references: [id])
}`;

source = source.replace(invoiceRegex, replacement);
fs.writeFileSync(file, source, 'utf8');
console.log('OK: Đã bổ sung field Casso vào Invoice schema.');
