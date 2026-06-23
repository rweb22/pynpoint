import { DistanceUnit } from './distance-request.dto';

export class LocationDetailsDto {
  type: 'pincode' | 'digipin' | 'coordinate';
  pincode?: string;
  officeName?: string;
  digipinCode?: string;
  level?: number;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export class DistanceValueDto {
  value: number;
  unit: DistanceUnit;
}

/**
 * Response for POST /distance/calculate
 */
export class DistanceCalculationResponse {
  from: LocationDetailsDto;
  to: LocationDetailsDto;
  distance: DistanceValueDto;
  method: 'haversine';
}

/**
 * Response for POST /distance/batch
 */
export class BatchDistanceResultDto {
  from: LocationDetailsDto;
  to: LocationDetailsDto;
  distance: DistanceValueDto;
  method: 'haversine';
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
