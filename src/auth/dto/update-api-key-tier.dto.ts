import { IsEnum, IsOptional, IsObject } from 'class-validator';

/**
 * UpdateApiKeyTierDto
 *
 * Request payload for updating an API key's tier.
 * Used when a customer upgrades or downgrades their subscription.
 */
export class UpdateApiKeyTierDto {
  @IsEnum(['free', 'pro', 'business', 'enterprise'])
  tier: 'free' | 'pro' | 'business' | 'enterprise';

  @IsObject()
  @IsOptional()
  rateLimitOverrides?: {
    requests_per_minute?: number;
    requests_per_day?: number;
    requests_per_second?: number;
  };
}
