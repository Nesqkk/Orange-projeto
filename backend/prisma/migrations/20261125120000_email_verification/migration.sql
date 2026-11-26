ALTER TABLE `users`
  ADD COLUMN `emailVerified` BOOLEAN NOT NULL DEFAULT false;

UPDATE `users` SET `emailVerified` = true WHERE `role` = 'ADMIN';

CREATE TABLE `email_verification_tokens` (
  `id` VARCHAR(191) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `email_verification_tokens_tokenHash_key`(`tokenHash`),
  INDEX `email_verification_tokens_userId_idx`(`userId`),
  INDEX `email_verification_tokens_expiresAt_idx`(`expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `email_verification_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
