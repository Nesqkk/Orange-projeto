"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const password_1 = require("../src/auth/password");
async function main() {
    const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password || password.length < 16) {
        throw new Error('Configure SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD (mínimo de 16 caracteres) antes de executar db:seed.');
    }
    const prisma = new client_1.PrismaClient();
    try {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            if (existing.role !== 'ADMIN')
                await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' } });
            console.log(`Conta administrativa já existe: ${email}`);
            return;
        }
        await prisma.user.create({
            data: { email, passwordHash: await (0, password_1.hashPassword)(password), role: 'ADMIN' },
        });
        console.log(`Conta administrativa criada: ${email}`);
    }
    finally {
        await prisma.$disconnect();
    }
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=seed.js.map