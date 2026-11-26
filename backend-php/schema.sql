CREATE TABLE `users` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `name` VARCHAR(120) NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `role` ENUM('ADMIN', 'CUSTOMER') NOT NULL DEFAULT 'CUSTOMER',
  `mfaEnabled` BOOLEAN NOT NULL DEFAULT false,
  `mfaSecret` TEXT NULL,
  `mfaPendingSecret` TEXT NULL,
  `mfaBackupCodes` TEXT NULL,
  `emailVerified` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE KEY `users_email_key` (`email`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `oauth_accounts` (
  `id` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(16) NOT NULL,
  `subject` VARCHAR(191) NOT NULL,
  `providerEmail` VARCHAR(254) NULL,
  `userId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY `oauth_accounts_provider_subject_key` (`provider`, `subject`),
  KEY `oauth_accounts_userId_idx` (`userId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `oauth_accounts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `auth_sessions` (
  `id` VARCHAR(191) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY `auth_sessions_tokenHash_key` (`tokenHash`),
  KEY `auth_sessions_userId_idx` (`userId`),
  KEY `auth_sessions_expiresAt_idx` (`expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `auth_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `auth_challenges` (
  `id` VARCHAR(191) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY `auth_challenges_tokenHash_key` (`tokenHash`),
  KEY `auth_challenges_userId_idx` (`userId`),
  KEY `auth_challenges_expiresAt_idx` (`expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `auth_challenges_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `password_reset_tokens` (
  `id` VARCHAR(191) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY `password_reset_tokens_tokenHash_key` (`tokenHash`),
  KEY `password_reset_tokens_userId_idx` (`userId`),
  KEY `password_reset_tokens_expiresAt_idx` (`expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `password_reset_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `email_verification_tokens` (
  `id` VARCHAR(191) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY `email_verification_tokens_tokenHash_key` (`tokenHash`),
  KEY `email_verification_tokens_userId_idx` (`userId`),
  KEY `email_verification_tokens_expiresAt_idx` (`expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `email_verification_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `support_tickets` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `subject` VARCHAR(160) NOT NULL,
  `status` ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  KEY `support_tickets_userId_updatedAt_idx` (`userId`, `updatedAt`),
  KEY `support_tickets_status_updatedAt_idx` (`status`, `updatedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `support_tickets_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ticket_messages` (
  `id` VARCHAR(191) NOT NULL,
  `ticketId` VARCHAR(191) NOT NULL,
  `authorId` VARCHAR(191) NOT NULL,
  `content` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY `ticket_messages_ticketId_createdAt_idx` (`ticketId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ticket_messages_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `support_tickets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ticket_messages_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `plans` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `priceInCents` INTEGER NOT NULL,
  `interval` ENUM('MONTHLY', 'YEARLY', 'ONCE') NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE KEY `plans_name_key` (`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `api_rate_limits` (
  `bucket` VARCHAR(191) NOT NULL,
  `windowStart` BIGINT NOT NULL,
  `hits` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`bucket`, `windowStart`),
  KEY `api_rate_limits_windowStart_idx` (`windowStart`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `broadcasts` (
  `id` VARCHAR(191) NOT NULL,
  `subject` VARCHAR(160) NOT NULL,
  `category` ENUM('NEWS', 'PROMO', 'NOTICE', 'UPDATE') NOT NULL,
  `layout` ENUM('HIGHLIGHT', 'LETTER', 'OFFER') NOT NULL,
  `headline` VARCHAR(120) NOT NULL,
  `highlight` VARCHAR(80) NULL,
  `body` TEXT NOT NULL,
  `imageUrl` VARCHAR(500) NULL,
  `ctaLabel` VARCHAR(60) NULL,
  `ctaUrl` VARCHAR(500) NULL,
  `status` ENUM('SENDING', 'SENT', 'CANCELLED') NOT NULL DEFAULT 'SENDING',
  `total` INTEGER NOT NULL DEFAULT 0,
  `createdBy` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finishedAt` DATETIME(3) NULL,
  KEY `broadcasts_createdAt_idx` (`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `broadcast_recipients` (
  `broadcastId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `name` VARCHAR(120) NULL,
  `status` ENUM('PENDING', 'CLAIMED', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `claimToken` CHAR(32) NULL,
  `claimedAt` DATETIME(3) NULL,
  `sentAt` DATETIME(3) NULL,
  PRIMARY KEY (`broadcastId`, `userId`),
  KEY `broadcast_recipients_status_idx` (`broadcastId`, `status`),
  CONSTRAINT `broadcast_recipients_broadcastId_fkey` FOREIGN KEY (`broadcastId`) REFERENCES `broadcasts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `email_unsubscribes` (
  `email` VARCHAR(254) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
