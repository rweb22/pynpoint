import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getWelcome() {
    return {
      service: 'PinPoint India API',
      version: '1.0.0',
      tagline: 'High-performance Indian postal code and spatial data API',
      description:
        'Access comprehensive Indian pincode data, DIGIPIN grid coordinates, administrative boundaries, and distance calculations through a fast, modern REST API.',
      documentation: 'https://github.com/rweb22/pynpoint',

      features: {
        pincodes: {
          description: 'Traditional Indian postal codes (India Post)',
          capabilities: [
            'Lookup by pincode',
            'Search by state/district/city',
            'Reverse geocoding (coordinates → pincode)',
            'Bulk lookup operations',
            'Nearby pincode search',
          ],
        },
        digipin: {
          description: 'Hierarchical grid system for precise location encoding',
          capabilities: [
            'Encode coordinates to DIGIPIN (10 precision levels)',
            'Decode DIGIPIN to coordinates',
            'Hierarchical navigation (parent/children/ancestors)',
            'Neighbor discovery',
            'DIGIPIN to pincode conversion',
          ],
          precision: 'Level 10 = ~4m × 4m grid cells',
        },
        administrative: {
          description: 'Indian administrative divisions',
          capabilities: [
            'List all states and union territories',
            'Get state details',
            'List districts by state',
            'List cities by district',
          ],
          coverage: '38 states/UTs, 750+ districts, 19,000+ pincodes',
        },
        distance: {
          description: 'Universal distance calculator',
          capabilities: [
            'Calculate distance between any two points',
            'Supports pincodes, DIGIPINs, or coordinates',
            'Multiple units (km, miles, meters)',
            'Batch distance calculations',
          ],
          method: 'Haversine formula (great-circle distance)',
        },
      },

      apiEndpoints: {
        track1a_pincodes: {
          base: '/api/v1/pincodes',
          endpoints: [
            'GET /:pincode - Get pincode details',
            'GET / - Search pincodes (by state/district/city)',
            'GET /:pincode/validate - Validate pincode',
            'GET /:pincode/nearby - Find nearby pincodes',
            'POST /reverse-geocode - Coordinate → pincode',
            'POST /bulk/lookup - Bulk pincode lookup',
          ],
        },
        track1b_administrative: {
          base: '/api/v1/administrative',
          endpoints: [
            'GET /states - List all states',
            'GET /states/:code - Get state details',
            'GET /districts - List districts (filter by state)',
            'GET /cities - List cities (filter by state/district)',
          ],
        },
        track2_digipin: {
          base: '/api/v1/digipin',
          endpoints: [
            'POST /encode - Coordinate → DIGIPIN',
            'POST /decode - DIGIPIN → coordinate',
            'POST /validate - Validate DIGIPIN code',
            'POST /to-pincode - DIGIPIN → pincode',
            'GET /:code - Get DIGIPIN details',
            'GET /:code/parent - Get parent cell',
            'GET /:code/children - Get children cells',
            'GET /:code/ancestors - Get all ancestors',
            'GET /neighbors/:code - Get 8 neighboring cells',
            'GET /nearby - Find nearby cells',
          ],
        },
        track3_distance: {
          base: '/api/v1/distance',
          endpoints: [
            'POST /calculate - Calculate distance between two points',
            'POST /batch - Batch distance calculations',
          ],
        },
      },

      architecture: {
        database: 'PostgreSQL with PostGIS spatial extensions',
        cache: 'Redis for performance optimization',
        spatial: 'GIST spatial index for fast reverse geocoding',
        grid: 'Algorithmic DIGIPIN encoding (no pre-computed cells)',
        performance: '<50ms typical response time (cached)',
      },

      authentication: {
        required: true,
        method: 'Bearer token in Authorization header',
        header: 'Authorization: Bearer YOUR_API_KEY',
        contact: 'Contact us for API key access',
      },

      status: 'operational',
      uptime: 'Railway deployment - auto-scaling enabled',
    };
  }
}
