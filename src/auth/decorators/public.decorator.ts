import { SetMetadata } from '@nestjs/common';

/**
 * Public Decorator
 * 
 * Marks a route as public, bypassing authentication guards.
 * 
 * Usage:
 *   @Public()
 *   @Get('/health')
 *   async healthCheck() { ... }
 * 
 * Guards must check for this metadata using Reflector.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
