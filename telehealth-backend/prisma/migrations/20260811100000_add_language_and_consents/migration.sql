ALTER TABLE `User`
  ADD COLUMN `preferredLanguage` VARCHAR(191) NOT NULL DEFAULT 'vi',
  ADD COLUMN `consentAcceptedAt` DATETIME(3) NULL,
  ADD COLUMN `consentPolicyVersion` VARCHAR(191) NULL;

CREATE TABLE `ConsultationConsent` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `appointmentId` INTEGER NOT NULL,
  `userId` INTEGER NOT NULL,
  `policyVersion` VARCHAR(191) NOT NULL,
  `acceptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ConsultationConsent_appointmentId_userId_key` (`appointmentId`, `userId`),
  INDEX `ConsultationConsent_userId_acceptedAt_idx` (`userId`, `acceptedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ConsultationConsent_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ConsultationConsent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
