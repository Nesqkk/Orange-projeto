import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import mariadb from 'mariadb';
import { PrismaClient } from './generated/prisma/client.js';
import { createDatabaseAdapter } from './database/mariadb-adapter.js';
import { seedAdminUsers } from './database/seed-admin.js';

const runtimeDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = resolve(runtimeDirectory, 'prisma/migrations');

async function applyMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL nao foi configurada.');

  const url = new URL(databaseUrl);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (url.protocol !== 'mysql:' || !url.hostname || !database) {
    throw new Error('DATABASE_URL precisa ser uma URL MySQL valida.');
  }

  const connection = await mariadb.createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    connectTimeout: 5_000,
  });

  try {
    const migrationTable = [
      'CREATE TABLE IF NOT EXISTS `_prisma_migrations` (',
      '  `id` VARCHAR(36) NOT NULL,',
      '  `checksum` VARCHAR(64) NOT NULL,',
      '  `finished_at` DATETIME(3) NULL,',
      '  `migration_name` VARCHAR(255) NOT NULL,',
      '  `logs` TEXT NULL,',
      '  `rolled_back_at` DATETIME(3) NULL,',
      '  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),',
      '  `applied_steps_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,',
      '  PRIMARY KEY (`id`)',
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
    ].join('\n');
    await connection.query(migrationTable);

    const folders = (await readdir(migrationsDirectory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const migrationName of folders) {
      const sql = await readFile(resolve(migrationsDirectory, migrationName, 'migration.sql'), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const rows = await connection.query(
        'SELECT `checksum`, `finished_at`, `rolled_back_at` FROM `_prisma_migrations` WHERE `migration_name` = ? ORDER BY `started_at` DESC LIMIT 1',
        [migrationName],
      ) as Array<{ checksum: string; finished_at: Date | null; rolled_back_at: Date | null }>;
      const existing = rows[0];

      if (existing?.finished_at && !existing.rolled_back_at) {
        if (existing.checksum !== checksum) throw new Error('Checksum divergente na migracao ' + migrationName + '.');
        continue;
      }
      if (existing && !existing.rolled_back_at) {
        throw new Error('A migracao ' + migrationName + ' esta incompleta; verifique o banco antes de tentar novamente.');
      }

      const id = randomUUID();
      await connection.query(
        'INSERT INTO `_prisma_migrations` (`id`, `checksum`, `migration_name`, `started_at`) VALUES (?, ?, ?, NOW(3))',
        [id, checksum, migrationName],
      );
      const statements = sql.split(';').map((statement) => statement.trim()).filter(Boolean);

      try {
        for (let index = 0; index < statements.length; index += 1) {
          await connection.query(statements[index]);
          await connection.query(
            'UPDATE `_prisma_migrations` SET `applied_steps_count` = ? WHERE `id` = ?',
            [index + 1, id],
          );
        }
        await connection.query('UPDATE `_prisma_migrations` SET `finished_at` = NOW(3) WHERE `id` = ?', [id]);
        console.log('Migracao aplicada: ' + migrationName);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await connection.query('UPDATE `_prisma_migrations` SET `logs` = ? WHERE `id` = ?', [message, id]);
        throw error;
      }
    }
  } finally {
    await connection.end();
  }
}

async function start() {
  await applyMigrations();
  const prisma = new PrismaClient({ adapter: createDatabaseAdapter() });
  try {
    await seedAdminUsers(prisma);
  } finally {
    await prisma.$disconnect();
  }

  import('./application.js').catch((error: unknown) => {
    console.error('Nao foi possivel iniciar a API.', error);
    process.exitCode = 1;
  });
}

start().catch((error: unknown) => {
  console.error('Nao foi possivel preparar o banco e iniciar a API.', error);
  process.exitCode = 1;
});
