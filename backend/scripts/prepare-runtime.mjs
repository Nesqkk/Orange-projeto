import { cpSync, copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist/prisma', { recursive: true });
copyFileSync('prisma.config.ts', 'dist/prisma.config.ts');
copyFileSync('prisma/schema.prisma', 'dist/prisma/schema.prisma');
cpSync('prisma/migrations', 'dist/prisma/migrations', { recursive: true });
