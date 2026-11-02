import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminSessionGuard } from '../auth/admin-session.guard.js';
import { CreatePlanDto } from './create-plan.dto.js';
import { PlansService } from './plans.service.js';
import { UpdatePlanDto } from './update-plan.dto.js';

@Controller('admin/plans')
@UseGuards(AdminSessionGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  list() {
    return this.plansService.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreatePlanDto) {
    return this.plansService.create(body);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdatePlanDto) {
    return this.plansService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.plansService.remove(id);
  }
}
