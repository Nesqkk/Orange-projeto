-- Orange · Comunicados por e-mail
-- Importe no phpMyAdmin, no banco da API (o mesmo do orange-config.php), depois de um backup.
-- Só cria tabelas novas: não altera nem apaga dados existentes. Pode ser importado mais de uma vez.

SET NAMES utf8mb4;

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
  PRIMARY KEY (`id`),
  KEY `broadcasts_createdAt_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `email_unsubscribes` (
  `email` VARCHAR(254) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
