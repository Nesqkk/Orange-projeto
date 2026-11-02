import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { AdminSessionGuard } from '../auth/admin-session.guard.js';
import { CustomersService } from './customers.service.js';
import { UpdateCustomerDto } from './customers.dto.js';

@Controller('admin/customers')
@UseGuards(AdminSessionGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list() {
    return this.customersService.list();
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateCustomerDto) {
    return this.customersService.updateName(id, body.name);
  }
}
