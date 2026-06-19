import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { H3AccuracyValidatorService } from './h3-accuracy-validator.service';
import { ExternalValidatorService } from './external-validator.service';
import { AdminAuthGuard } from '../auth/admin-auth.guard';

@Controller({ path: 'admin/verification', version: '1' })
@UseGuards(AdminAuthGuard)
export class VerificationController {
  constructor(
    private readonly validatorService: H3AccuracyValidatorService,
    private readonly externalValidator: ExternalValidatorService,
  ) {}

  /**
   * Run internal accuracy validation tests
   * GET /admin/verification/validate?sampleSize=1000
   */
  @Get('validate')
  async runValidation(@Query('sampleSize') sampleSize?: string) {
    const size = sampleSize ? parseInt(sampleSize, 10) : 1000;
    return await this.validatorService.validateAccuracy(size);
  }

  /**
   * Run external validation against Google Geocoding API
   * GET /admin/verification/google?sampleSize=100
   * Requires GOOGLE_MAPS_API_KEY environment variable
   */
  @Get('google')
  async runGoogleValidation(@Query('sampleSize') sampleSize?: string) {
    const size = sampleSize ? parseInt(sampleSize, 10) : 100;
    return await this.externalValidator.validateWithGoogle(size);
  }
}
