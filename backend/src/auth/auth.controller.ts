import { Controller, Get } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Get('status')
  getStatus() {
    return {
      module: 'auth',
      status: 'scaffold-ready',
      message: 'Authentication endpoints will be implemented next.',
    };
  }
}
