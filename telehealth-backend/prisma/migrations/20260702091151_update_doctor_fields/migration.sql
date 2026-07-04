/*
  Warnings:

  - You are about to drop the `Doctor` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `Doctor`;

-- CreateTable
CREATE TABLE `doctors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `specialty` VARCHAR(191) NOT NULL,
    `bio` TEXT NOT NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `rating` DOUBLE NOT NULL DEFAULT 5.0,
    `patientCount` INTEGER NOT NULL DEFAULT 0,
    `yearsExp` INTEGER NOT NULL DEFAULT 0,
    `isOnline` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
