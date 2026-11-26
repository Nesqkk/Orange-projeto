import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { UserIdentity } from '../auth/auth.service.js';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: UserIdentity, subject: string, content: string) {
    if (user.role !== 'CUSTOMER') throw new ForbiddenException('Somente clientes podem abrir chamados.');
    return this.prisma.supportTicket.create({
      data: {
        userId: user.id,
        subject: subject.trim(),
        messages: { create: { authorId: user.id, content: content.trim() } },
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
        messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, email: true, name: true, role: true } } } },
      },
    });
  }

  listForUser(user: UserIdentity) {
    return this.prisma.supportTicket.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, email: true, name: true, role: true } } } },
      },
    });
  }

  listForOperations() {
    return this.prisma.supportTicket.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true } },
        messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, email: true, name: true, role: true } } } },
      },
    });
  }

  async get(ticketId: string, user: UserIdentity) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, ...(user.role === 'ADMIN' ? {} : { userId: user.id }) },
      include: {
        user: { select: { id: true, email: true, name: true } },
        messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, email: true, name: true, role: true } } } },
      },
    });
    if (!ticket) throw new NotFoundException('Solicitacao nao encontrada.');
    return ticket;
  }

  async addMessage(ticketId: string, user: UserIdentity, content: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, ...(user.role === 'ADMIN' ? {} : { userId: user.id }) },
    });
    if (!ticket) throw new NotFoundException('Solicitacao nao encontrada.');
    if (ticket.status === 'CLOSED') throw new ForbiddenException('Esta solicitacao foi encerrada.');
    const nextStatus = user.role === 'ADMIN' && ticket.status === 'OPEN'
      ? 'IN_PROGRESS'
      : user.role === 'CUSTOMER' && ticket.status === 'RESOLVED' ? 'OPEN' : ticket.status;
    await this.prisma.ticketMessage.create({ data: { ticketId, authorId: user.id, content: content.trim() } });
    if (nextStatus !== ticket.status) await this.prisma.supportTicket.update({ where: { id: ticketId }, data: { status: nextStatus } });
    else await this.prisma.supportTicket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });
    return this.get(ticketId, user);
  }

  async updateStatus(ticketId: string, status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED') {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Solicitacao nao encontrada.');
    return this.prisma.supportTicket.update({
      where: { id: ticketId }, data: { status },
      include: {
        user: { select: { id: true, email: true, name: true } },
        messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, email: true, name: true, role: true } } } },
      },
    });
  }
}
