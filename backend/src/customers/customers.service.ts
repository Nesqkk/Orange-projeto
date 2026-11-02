import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      orderBy: [{ createdAt: 'desc' }, { email: 'asc' }],
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        _count: { select: { tickets: true } },
      },
    });
  }

  async updateName(id: string, name: string) {
    try {
      return await this.prisma.user.update({
        where: { id, role: 'CUSTOMER' },
        data: { name: name.trim() || null },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          _count: { select: { tickets: true } },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Cliente não encontrado.');
      }
      throw error;
    }
  }
}
