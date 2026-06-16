import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * Query DTO for H3 parent request
 */
export class H3ParentQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(15)
  @Type(() => Number)
  @Transform(({ value }) => parseInt(value, 10))
  resolution?: number;
}

/**
 * Query DTO for H3 children request
 */
export class H3ChildrenQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(15)
  @Type(() => Number)
  @Transform(({ value }) => parseInt(value, 10))
  resolution?: number;
}
