import 'dotenv/config';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, env } from 'prisma/config';

const configDirectory = dirname(fileURLToPath(import.meta.url));
const isRuntimeCopy = basename(configDirectory) === 'dist';
const seedFile = resolve(configDirectory, isRuntimeCopy ? 'database/seed-admin.js' : 'dist/database/seed-admin.js');

export default defineConfig({
  schema: resolve(configDirectory, 'prisma/schema.prisma'),
  migrations: {
    path: resolve(configDirectory, 'prisma/migrations'),
    seed: `"${process.execPath}" "${seedFile}"`,
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
