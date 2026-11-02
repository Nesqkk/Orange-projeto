import { PrismaClient } from '../generated/prisma/client.js';
import { hashPassword } from '../auth/password.js';
import { createDatabaseAdapter } from './mariadb-adapter.js';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type AdminSeed = { email: string; password: string };

function getAdminSeeds(): AdminSeed[] {
  const serialized = process.env.SEED_ADMIN_USERS?.trim();
  let seeds: unknown[];

  if (serialized) {
    try {
      const parsed: unknown = JSON.parse(serialized);
      if (!Array.isArray(parsed)) throw new Error();
      seeds = parsed;
    } catch {
      throw new Error('SEED_ADMIN_USERS deve ser um array JSON de objetos com email e password.');
    }
  } else {
    seeds = [{ email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD }];
  }

  if (seeds.length === 0) {
    throw new Error('Configure ao menos uma conta administrativa em SEED_ADMIN_USERS.');
  }

  const emails = new Set<string>();
  return seeds.map((seed) => {
    if (!seed || typeof seed !== 'object' || !('email' in seed) || !('password' in seed)) {
      throw new Error('Cada conta em SEED_ADMIN_USERS deve conter email e password.');
    }

    const email = typeof seed.email === 'string' ? seed.email.trim().toLowerCase() : '';
    const password = typeof seed.password === 'string' ? seed.password : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 16) {
      throw new Error('Cada conta administrativa precisa de um e-mail válido e uma senha com no mínimo 16 caracteres.');
    }
    if (emails.has(email)) {
      throw new Error(`E-mail administrativo duplicado: ${email}`);
    }
    emails.add(email);
    return { email, password };
  });
}

export async function seedAdminUsers(prisma: PrismaClient) {
  const admins = getAdminSeeds();
  for (const { email, password } of admins) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role !== 'ADMIN') {
        throw new Error(`A conta ${email} ja existe como cliente. Promocao automatica para ADMIN bloqueada; revise a conta no banco antes do deploy.`);
      }
      console.log(`Conta administrativa já existe: ${email}`);
      continue;
    }

    await prisma.user.create({
      data: { email, passwordHash: await hashPassword(password), role: 'ADMIN' },
    });
  }
}

async function main() {
  const prisma = new PrismaClient({ adapter: createDatabaseAdapter() });
  try {
    await seedAdminUsers(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
