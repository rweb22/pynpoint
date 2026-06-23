import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

/**
 * AppController
 *
 * Root endpoint (/) providing API welcome message and documentation
 * This endpoint does not require authentication
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getWelcome() {
    return this.appService.getWelcome();
  }
}
