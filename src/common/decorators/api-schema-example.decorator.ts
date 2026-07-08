import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, getSchemaPath } from '@nestjs/swagger';

/**
 * Custom decorator to add schema-level examples to DTOs
 * 
 * This ensures examples appear at the component schema level,
 * which is required for RapidAPI's code generator to pick them up
 * when using $ref references.
 * 
 * Usage:
 * ```typescript
 * @ApiSchemaExample({
 *   latitude: 28.6139,
 *   longitude: 77.209
 * })
 * export class MyDto { ... }
 * ```
 * 
 * This is a workaround for NestJS which doesn't natively support
 * schema-level examples (only property-level or content-level).
 * 
 * The actual implementation happens in the OpenAPI document customization
 * in main.ts by reading the static `schema.example` property from each class.
 */
export function ApiSchemaExample(example: any) {
  return applyDecorators(
    // Store the example in class metadata for later retrieval
    (target: any) => {
      target.schema = target.schema || {};
      target.schema.example = example;
      return target;
    },
  );
}
