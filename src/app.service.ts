import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getWelcome() {
    return {
      name: 'PinPoint India API',
      version: '1.0.0',
      description: 'High-performance Indian postal and spatial data API',
      documentation: 'https://github.com/rweb22/pynpoint',
      endpoints: {
        health: '/health',
        pincodes: '/api/v1/pincodes',
        administrative: '/api/v1/administrative',
        documentation: 'See README.md for full API specification',
      },
      features: [
        'Traditional Pincodes (India Post)',
        'DIGIPIN Grid System',
        'Distance Calculations',
        'Administrative Data (States, Districts, Cities)',
      ],
      authentication: 'API key required - Contact us for access',
      status: 'operational',
    };
  }
}
