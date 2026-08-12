import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s, 'utf8');

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Không tìm thấy đoạn cần sửa: ${label}`);
  }
  return source.replace(search, replacement);
}

function patchSchema() {
  const file = 'telehealth-backend/prisma/schema.prisma';
  let s = read(file);
  if (s.includes('bankTransactionId')) return;
  s = replaceOnce(
    s,
    `  amount        Float\n  status        String      // 'PAID', 'PENDING_REFUND', 'REFUNDED'\n  createdAt     DateTime    @default(now())`,
    `  amount        Float\n  status        String      // 'PENDING', 'PAID', 'PENDING_REFUND', 'REFUNDED'\n  paymentMethod String      @default("WALLET")\n  paymentCode   String?     @unique @db.VarChar(32)\n  bankTransactionId String? @unique @db.VarChar(191)\n  paidAt        DateTime?\n  createdAt     DateTime    @default(now())`,
    'Invoice schema',
  );
  write(file, s);
}

function patchAppointments() {
  const file = 'telehealth-backend/src/appointments/appointments.service.ts';
  let s = read(file);
  if (!s.includes("from 'node:crypto'")) {
    s = replaceOnce(
      s,
      `import { createPrescriptionVerification } from '../prescriptions/prescription-verification';`,
      `import { createPrescriptionVerification } from '../prescriptions/prescription-verification';\nimport { randomBytes } from 'node:crypto';`,
      'randomBytes import',
    );
  }

  if (!s.includes("createAppointmentDto.paymentMethod === 'CASSO'")) {
    s = replaceOnce(
      s,
      `    const symptoms = createAppointmentDto.symptoms?.trim();\n`,
      `    const symptoms = createAppointmentDto.symptoms?.trim();\n    const paymentMethod =\n      createAppointmentDto.paymentMethod === 'CASSO' ? 'CASSO' : 'WALLET';\n`,
      'payment method parse',
    );
  }

  const walletCheck = `    // 2.7 Kiểm tra số dư ví bệnh nhân (VD phí khám là 100,000)\n    const FEE = 100000;\n    const wallet = await this.prisma.wallet.findUnique({\n      where: { userId: resolvedPatientId },\n    });\n    if (!wallet || wallet.balance < FEE) {\n      throw new BadRequestException(\n        'Số dư ví không đủ để đặt lịch hẹn! (100.000 VNĐ)',\n      );\n    }\n`;
  const paymentCheck = `    // 2.7 Kiểm tra nguồn thanh toán tương ứng.\n    const FEE = 100000;\n    if (paymentMethod === 'WALLET') {\n      const wallet = await this.prisma.wallet.findUnique({\n        where: { userId: resolvedPatientId },\n      });\n      if (!wallet || wallet.balance < FEE) {\n        throw new BadRequestException(\n          'Số dư ví không đủ để đặt lịch hẹn! (100.000 VNĐ)',\n        );\n      }\n    } else if (\n      !this.config.get<string>('PAYMENT_BANK_ID')?.trim() ||\n      !this.config.get<string>('PAYMENT_ACCOUNT_NO')?.trim()\n    ) {\n      throw new BadRequestException(\n        'Chưa cấu hình tài khoản ngân hàng để tạo mã QR thanh toán.',\n      );\n    }\n`;
  if (s.includes(walletCheck)) s = s.replace(walletCheck, paymentCheck);

  const start = s.indexOf('    // 3. Tiến hành lưu lịch hẹn mới và thanh toán (trừ ví, tạo hoá đơn)');
  const endMarker = '      return appt;\n    });';
  const end = s.indexOf(endMarker, start);
  if (start !== -1 && end !== -1) {
    const replacement = `    // 3. Lưu lịch hẹn và tạo hoá đơn. Casso giữ PENDING đến khi webhook tới.\n    const result = await this.prisma.$transaction(async (prisma) => {\n      const selectedSchedule = await prisma.doctorSchedule.upsert({\n        where: {\n          doctorId_date_startTime: {\n            doctorId: resolvedDoctorId,\n            date: appointmentDate,\n            startTime,\n          },\n        },\n        update: { endTime },\n        create: {\n          doctorId: resolvedDoctorId,\n          date: appointmentDate,\n          startTime,\n          endTime,\n          isBooked: false,\n        },\n      });\n      const reservedSlot = await prisma.doctorSchedule.updateMany({\n        where: { id: selectedSchedule.id, isBooked: false },\n        data: { isBooked: true },\n      });\n      if (reservedSlot.count !== 1) {\n        throw new BadRequestException(\n          'Khung giờ vừa được người khác đặt. Vui lòng chọn khung giờ khác.',\n        );\n      }\n\n      const appt = await prisma.appointment.create({\n        data: {\n          patientId: resolvedPatientId,\n          doctorId: resolvedDoctorId,\n          appointmentDate: new Date(appointmentDate),\n          startTime,\n          endTime,\n          symptoms,\n          status: 'PENDING',\n        },\n        include: { patient: { select: { fullName: true } } },\n      });\n\n      if (paymentMethod === 'WALLET') {\n        await prisma.wallet.update({\n          where: { userId: resolvedPatientId },\n          data: { balance: { decrement: FEE } },\n        });\n      }\n\n      const paymentCode =\n        paymentMethod === 'CASSO'\n          ? \`TH\${appt.id}\${randomBytes(2).toString('hex').toUpperCase()}\`\n          : null;\n      const invoice = await prisma.invoice.create({\n        data: {\n          appointmentId: appt.id,\n          patientId: resolvedPatientId,\n          amount: FEE,\n          status: paymentMethod === 'CASSO' ? 'PENDING' : 'PAID',\n          paymentMethod,\n          paymentCode,\n          paidAt: paymentMethod === 'WALLET' ? new Date() : null,\n        },\n      });\n\n      return { appointment: appt, invoice };\n    });`;
    s = s.slice(0, start) + replacement + s.slice(end + endMarker.length);
  }

  s = s.replace(/appointmentId: appointment\.id,/g, 'appointmentId: result.appointment.id,');
  s = s.replace(/patientName: appointment\.patient\?\.fullName/g, 'patientName: result.appointment.patient?.fullName');
  s = s.replace(`        id: appointment.id,`, `        id: result.appointment.id,`);
  s = s.replace(`        status: appointment.status,`, `        status: result.appointment.status,`);

  const oldReturn = `    return {\n      message:\n        'Đặt lịch hẹn khám bệnh từ xa thành công rực rỡ! Chờ bác sĩ xác nhận nha.',\n      data: appointment,\n    };`;
  if (s.includes(oldReturn)) {
    s = s.replace(oldReturn, `    const bankId = this.config.get<string>('PAYMENT_BANK_ID')?.trim() ?? '';\n    const accountNo = this.config.get<string>('PAYMENT_ACCOUNT_NO')?.trim() ?? '';\n    const accountName = this.config.get<string>('PAYMENT_ACCOUNT_NAME')?.trim() ?? '';\n    const qrImageUrl = result.invoice.paymentCode\n      ? \`https://img.vietqr.io/image/\${encodeURIComponent(bankId)}-\${encodeURIComponent(accountNo)}-compact2.png?amount=\${FEE}&addInfo=\${encodeURIComponent(result.invoice.paymentCode)}&accountName=\${encodeURIComponent(accountName)}\`\n      : null;\n\n    return {\n      message:\n        paymentMethod === 'CASSO'\n          ? 'Đã giữ lịch. Vui lòng quét QR để hoàn tất thanh toán.'\n          : 'Đặt lịch hẹn khám bệnh từ xa thành công! Chờ bác sĩ xác nhận.',\n      data: {\n        appointment: result.appointment,\n        invoice: result.invoice,\n        payment:\n          paymentMethod === 'CASSO'\n            ? {\n                qrImageUrl,\n                bankId,\n                accountNo,\n                accountName,\n                amount: FEE,\n                paymentCode: result.invoice.paymentCode,\n              }\n            : null,\n      },\n    };`);
  }

  write(file, s);
}

function patchHome() {
  const file = 'telehealth-frontend/src/Home.tsx';
  let s = read(file);
  s = s.replace('  CreditCard,\n', '');

  if (!s.includes('interface PendingPayment')) {
    s = replaceOnce(
      s,
      `interface BookingForm {\n  doctorId: number;\n  doctorName: string;\n  appointmentDate: string;\n  startTime: string;\n  endTime: string;\n  symptoms: string;\n  paymentMethod: string;\n}\n`,
      `interface BookingForm {\n  doctorId: number;\n  doctorName: string;\n  appointmentDate: string;\n  startTime: string;\n  endTime: string;\n  symptoms: string;\n  paymentMethod: string;\n}\n\ninterface PendingPayment {\n  invoiceId: number;\n  status: 'PENDING' | 'PAID';\n  qrImageUrl: string;\n  bankId: string;\n  accountNo: string;\n  accountName: string;\n  amount: number;\n  paymentCode: string;\n}\n`,
      'PendingPayment interface',
    );
  }

  s = s.replace(
    /const PAYMENT_METHODS = \[[\s\S]*?\n\];/,
    `const PAYMENT_METHODS = [\n  { id: 'WALLET', label: 'Ví ảo OS Telehealth', icon: Wallet, color: 'text-sky-600 bg-sky-50 border-sky-200' },\n  { id: 'CASSO', label: 'Chuyển khoản QR (Casso)', icon: Banknote, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },\n];`,
  );

  if (!s.includes('const [pendingPayment,')) {
    s = replaceOnce(
      s,
      `  const [walletBalance, setWalletBalance] = useState<number | null>(null);`,
      `  const [walletBalance, setWalletBalance] = useState<number | null>(null);\n  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);`,
      'pending payment state',
    );
  }

  s = s.replace(`    setAvailableSlots([]);\n    document.body.style.overflow = 'hidden';`, `    setAvailableSlots([]);\n    setPendingPayment(null);\n    document.body.style.overflow = 'hidden';`);
  s = s.replace(`    setAvailableSlots([]);\n    document.body.style.overflow = '';`, `    setAvailableSlots([]);\n    setPendingPayment(null);\n    document.body.style.overflow = '';`);

  if (!s.includes('paymentMethod: bookingModal.paymentMethod,')) {
    s = s.replace(
      `          symptoms: bookingModal.symptoms.trim(),\n        }),`,
      `          symptoms: bookingModal.symptoms.trim(),\n          paymentMethod: bookingModal.paymentMethod,\n        }),`,
    );
  }

  if (!s.includes("bookingModal.paymentMethod === 'CASSO' && data.data?.payment")) {
    s = s.replace(
      `      if (!res.ok) throw new Error(data.message ?? tx('Đặt lịch thất bại', 'Booking failed'));\n\n      setBookingStep(3);`,
      `      if (!res.ok) throw new Error(data.message ?? tx('Đặt lịch thất bại', 'Booking failed'));\n\n      if (bookingModal.paymentMethod === 'CASSO' && data.data?.payment) {\n        setPendingPayment({\n          invoiceId: data.data.invoice.id,\n          status: data.data.invoice.status,\n          ...data.data.payment,\n        });\n      }\n      setBookingStep(3);`,
    );
  }

  if (!s.includes('/payment-status`')) {
    const marker = `\n  return (\n`;
    const poll = `\n  useEffect(() => {\n    if (!pendingPayment || pendingPayment.status === 'PAID') return;\n    const token = getAuthToken();\n    if (!token) return;\n\n    let stopped = false;\n    const checkPayment = async () => {\n      try {\n        const response = await fetch(\n          \`\${API_URL}/wallet/invoices/\${pendingPayment.invoiceId}/payment-status\`,\n          { headers: { Authorization: \`Bearer \${token}\` } },\n        );\n        if (!response.ok) return;\n        const payload = await response.json();\n        if (!stopped && payload.data?.status === 'PAID') {\n          setPendingPayment((current) => current ? { ...current, status: 'PAID' } : current);\n          window.setTimeout(() => {\n            closeBookingModal();\n            navigate('/dashboard');\n          }, 1500);\n        }\n      } catch {\n        // Quick Tunnel có thể chập chờn; lần kiểm tra kế tiếp sẽ tự chạy lại.\n      }\n    };\n\n    void checkPayment();\n    const interval = window.setInterval(checkPayment, 3000);\n    return () => { stopped = true; window.clearInterval(interval); };\n  }, [pendingPayment?.invoiceId, pendingPayment?.status]);\n`;
    s = s.replace(marker, poll + marker);
  }

  const step3Start = s.indexOf('            {/* ── STEP 3: Thành công ── */}');
  const step3EndMarker = '          </div>\n        </div>\n      )}';
  const step3End = s.indexOf(step3EndMarker, step3Start);
  if (step3Start !== -1 && step3End !== -1) {
    const newStep3 = `            {/* ── STEP 3: Thanh toán / Thành công ── */}\n            {bookingStep === 3 && (\n              pendingPayment && pendingPayment.status !== 'PAID' ? (\n                <div className="space-y-5 p-6 text-center">\n                  <div>\n                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">{tx('Chờ chuyển khoản Casso', 'Waiting for Casso transfer')}</p>\n                    <h3 className="mt-2 text-2xl font-black text-slate-900">{tx('Quét QR để thanh toán 100.000đ', 'Scan the QR to pay VND 100,000')}</h3>\n                    <p className="mt-2 text-sm text-slate-500">{tx('Trang sẽ tự chuyển sang lịch của bạn ngay khi Casso xác nhận tiền vào.', 'This page will automatically open your appointments after Casso confirms the transfer.')}</p>\n                  </div>\n                  <img src={pendingPayment.qrImageUrl} alt="VietQR Casso" className="mx-auto w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" />\n                  <div className="rounded-2xl bg-slate-50 p-4 text-left text-sm text-slate-700">\n                    <p><strong>{tx('Ngân hàng', 'Bank')}:</strong> {pendingPayment.bankId}</p>\n                    <p><strong>{tx('Số tài khoản', 'Account')}:</strong> {pendingPayment.accountNo}</p>\n                    <p><strong>{tx('Chủ tài khoản', 'Account name')}:</strong> {pendingPayment.accountName}</p>\n                    <p><strong>{tx('Số tiền', 'Amount')}:</strong> {pendingPayment.amount.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} VNĐ</p>\n                    <p className="mt-2 rounded-xl bg-amber-50 p-3 text-amber-800"><strong>{tx('Nội dung bắt buộc', 'Required transfer content')}:</strong> {pendingPayment.paymentCode}</p>\n                  </div>\n                  <div className="flex items-center justify-center gap-2 text-sm font-semibold text-sky-700"><span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />{tx('Đang chờ Casso xác nhận...', 'Waiting for Casso confirmation...')}</div>\n                </div>\n              ) : (\n                <div className="flex flex-col items-center px-6 py-10 text-center">\n                  <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-5xl">🎉</div>\n                  <h3 className="mt-4 text-2xl font-black text-slate-900">{tx('Thanh toán & đặt lịch thành công!', 'Payment & booking successful!')}</h3>\n                  <p className="mt-2 text-sm text-slate-600">{tx('Lịch hẹn với', 'Your appointment with')} <strong>{formatDoctorName(bookingModal.doctorName)}</strong> {tx('đã được ghi nhận.', 'has been recorded.')}</p>\n                  {pendingPayment?.status === 'PAID' && <p className="mt-2 text-sm font-semibold text-emerald-700">{tx('Casso đã xác nhận tiền vào. Đang chuyển đến lịch của bạn...', 'Casso confirmed the payment. Opening your appointments...')}</p>}\n                  <div className="mt-6 flex gap-3">\n                    <button onClick={closeBookingModal} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700">{tx('Đóng', 'Close')}</button>\n                    <button onClick={() => { closeBookingModal(); navigate('/dashboard'); }} className="rounded-full bg-gradient-to-r from-sky-600 to-cyan-500 px-5 py-2.5 text-sm font-black text-white">{tx('Xem lịch của tôi →', 'View my appointments →')}</button>\n                  </div>\n                </div>\n              )\n            )}\n`;
    s = s.slice(0, step3Start) + newStep3 + s.slice(step3End);
  }

  s = s.replace('MoMo · VNPay · ZaloPay', 'Ví ảo · Chuyển khoản QR Casso');
  write(file, s);
}

patchSchema();
patchAppointments();
patchHome();
console.log('OK: Đã khôi phục luồng Ví ảo + Casso vào code hiện tại.');
