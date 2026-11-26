import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

export function createDatabaseAdapter() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não foi configurada.');
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL precisa ser uma URL MySQL válida.');
  }

  if (url.protocol !== 'mysql:') {
    throw new Error('DATABASE_URL precisa usar o protocolo mysql:// para MariaDB.');
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  if (!url.hostname || !database || !user) {
    throw new Error('DATABASE_URL precisa informar host, banco e usuário.');
  }

  return new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user,
    password,
    database,
    connectionLimit: 5,
    connectTimeout: 5_000,
    idleTimeout: 300,
  });
}
