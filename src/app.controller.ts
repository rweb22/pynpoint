import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

/**
 * AppController
 *
 * Root endpoint (/) providing API welcome message and documentation
 * This endpoint does not require authentication
 */
@Controller()
@ApiTags('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'API Welcome & Status',
    description: 'Returns API information, version, available endpoints, and system status. This endpoint does not require authentication.',
  })
  @ApiResponse({
    status: 200,
    description: 'API information and status',
    schema: {
      example: {
        message: 'Welcome to PinPoint India API',
        version: '1.0.0',
        status: 'operational',
        features: ['PINCODE lookup', 'DIGIPIN geocoding', 'Distance calculation'],
        documentation: '/api/docs',
      },
    },
  })
  getWelcome() {
    return this.appService.getWelcome();
  }
}
