CREATE TABLE `oauth_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(16) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `providerEmail` VARCHAR(254) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `oauth_accounts_provider_subject_key`(`provider`, `subject`),
    INDEX `oauth_accounts_userId_idx`(`userId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `oauth_accounts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
