import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { UserRequest, UserSessionGuard } from '../auth/user-session.guard.js';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CreateTicketDto, TicketMessageDto } from './support.dto.js';
import { SupportService } from './support.service.js';

@Controller('support/tickets')
@UseGuards(UserSessionGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  list(@Req() request: UserRequest) {
    return this.supportService.listForUser(request.user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(ThrottlerGuard)
  create(@Req() request: UserRequest, @Body() body: CreateTicketDto) {
    return this.supportService.create(request.user, body.subject, body.content);
  }

  @Get(':id')
  get(@Req() request: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.supportService.get(id, request.user);
  }

  @Post(':id/messages')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(ThrottlerGuard)
  addMessage(@Req() request: UserRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: TicketMessageDto) {
    return this.supportService.addMessage(id, request.user, body.content);
  }
}

import { AdminSessionGuard } from '../auth/admin-session.guard.js';
import { UpdateTicketStatusDto } from './support.dto.js';

@Controller('admin/operations/tickets')
@UseGuards(AdminSessionGuard)
export class OperationsController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  list() {
    return this.supportService.listForOperations();
  }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateTicketStatusDto) {
    return this.supportService.updateStatus(id, body.status);
  }
}
