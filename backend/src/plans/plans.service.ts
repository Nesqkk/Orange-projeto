import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { CreatePlanDto } from './create-plan.dto.js';
import { UpdatePlanDto } from './update-plan.dto.js';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.plan.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(data: CreatePlanDto) {
    try {
      return await this.prisma.plan.create({ data: { ...data, name: data.name.trim() } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Já existe um plano com esse nome.');
      }
      throw error;
    }
  }

  async update(id: string, data: UpdatePlanDto) {
    try {
      return await this.prisma.plan.update({
        where: { id },
        data: { ...data, ...(data.name ? { name: data.name.trim() } : {}) },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Já existe um plano com esse nome.');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Plano não encontrado.');
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.plan.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Plano não encontrado.');
      }
      throw error;
    }
    return { ok: true };
  }
}
