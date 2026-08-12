-- Track the independent 30-minute email reminder without resending it.
ALTER TABLE `Appointment`
  ADD COLUMN `reminder30mEmailSentAt` DATETIME(3) NULL;
