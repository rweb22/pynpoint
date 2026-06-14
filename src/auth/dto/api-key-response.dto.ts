/**
 * ApiKeyResponseDto
 *
 * Response payload for API key operations.
 *
 * IMPORTANT: Full API key is only returned once on creation!
 * Subsequent responses only include the prefix for security.
 */
export class ApiKeyResponseDto {
  id: string;
  externalCustomerId: string;
  key?: string;
  prefix: string;
  tier: string;
  environment: string;
  isActive: boolean;
  lastUsedAt?: Date | null;
  expiresAt?: Date | null;
  rateLimitOverrides?: {
    requests_per_minute?: number;
    requests_per_day?: number;
    requests_per_second?: number;
  } | null;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ApiKeyCreatedResponseDto
 *
 * Response payload specifically for key creation.
 * Includes the full API key (returned ONCE only).
 */
export class ApiKeyCreatedResponseDto extends ApiKeyResponseDto {
  declare key: string; // Override optional key from parent to make it required
  warning: string;
}
