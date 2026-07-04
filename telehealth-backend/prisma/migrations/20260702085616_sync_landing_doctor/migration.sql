-- CreateTable
CREATE TABLE `Doctor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `specialty` VARCHAR(191) NOT NULL,
    `exp` VARCHAR(191) NOT NULL,
    `avatar` VARCHAR(191) NOT NULL,
    `tag` VARCHAR(191) NULL DEFAULT 'Trực tuyến',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
