import { IsString, IsEnum, IsOptional, IsObject, IsDateString } from 'class-validator';

/**
 * CreateApiKeyDto
 *
 * Request payload for creating a new API key via Admin API.
 * Used by the main website to provision keys for customers.
 */
export class CreateApiKeyDto {
  @IsString()
  externalCustomerId: string;

  @IsEnum(['free', 'pro', 'business', 'enterprise'])
  tier: 'free' | 'pro' | 'business' | 'enterprise';

  @IsEnum(['live', 'test'])
  @IsOptional()
  environment?: 'live' | 'test';

  @IsObject()
  @IsOptional()
  rateLimitOverrides?: {
    requests_per_minute?: number;
    requests_per_day?: number;
    requests_per_second?: number;
  };

  @IsObject()
  @IsOptional()
  metadata?: {
    name?: string;
    description?: string;
    allowed_ips?: string[];
    scopes?: string[];
    provisioned_by?: string;
  };

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
