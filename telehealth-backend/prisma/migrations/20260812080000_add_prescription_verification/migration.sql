ALTER TABLE `Prescription`
  ADD COLUMN `verificationToken` VARCHAR(64) NULL,
  ADD COLUMN `verificationHash` VARCHAR(64) NULL,
  ADD COLUMN `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `revokedAt` DATETIME(3) NULL;

CREATE UNIQUE INDEX `Prescription_verificationToken_key`
  ON `Prescription`(`verificationToken`);
