import { DistanceUnit } from './distance-request.dto';

export class LocationDetailsDto {
  type: 'pincode' | 'digipin' | 'h3' | 'coordinate';
  pincode?: string;
  officeName?: string;
  digipinCode?: string;
  level?: number;
  h3Index?: string;
  resolution?: number;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export class DistanceValueDto {
  value: number;
  unit: DistanceUnit;
}

export class GridDistanceDto {
  cells: number;
  method: 'h3_grid_distance';
}

/**
 * Response for POST /distance/calculate
 */
export class DistanceCalculationResponse {
  from: LocationDetailsDto;
  to: LocationDetailsDto;
  distance: DistanceValueDto;
  gridDistance?: GridDistanceDto;
  method: 'haversine' | 'h3_grid';
}

/**
 * Response for POST /distance/batch
 */
export class BatchDistanceResultDto {
  from: LocationDetailsDto;
  to: LocationDetailsDto;
  distance: DistanceValueDto;
  gridDistance?: GridDistanceDto;
  method: 'haversine' | 'h3_grid';
  success: boolean;
  error?: string;
}

export class BatchDistanceResponse {
  results: BatchDistanceResultDto[];
  total: number;
  successful: number;
  failed: number;
  unit: DistanceUnit;
}
