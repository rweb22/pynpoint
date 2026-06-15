import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pincode } from '../../database/entities/pincode.entity';
import { H3AlgorithmService } from '../../h3/services/h3-algorithm.service';
import { DigipinAlgorithmService } from '../../digipin/services/digipin-algorithm.service';
import { RedisCacheService } from '../../redis/redis-cache.service';
import {
  LocationDto,
  DistanceUnit,
  CalculateDistanceDto,
  BatchDistanceDto,
} from '../dto/distance-request.dto';
import {
  LocationDetailsDto,
  DistanceCalculationResponse,
  BatchDistanceResponse,
  BatchDistanceResultDto,
} from '../dto/distance-response.dto';
import { gridDistance } from 'h3-js';

@Injectable()
export class DistanceService {
  private readonly logger = new Logger(DistanceService.name);

  constructor(
    @InjectRepository(Pincode)
    private readonly pincodeRepository: Repository<Pincode>,
    private readonly h3Algorithm: H3AlgorithmService,
    private readonly digipinAlgorithm: DigipinAlgorithmService,
    private readonly redisCache: RedisCacheService,
  ) {}

  /**
   * POST /distance/calculate
   * Universal distance calculator
   */
  async calculateDistance(dto: CalculateDistanceDto): Promise<DistanceCalculationResponse> {
    this.logger.log(`Calculating distance from ${JSON.stringify(dto.from)} to ${JSON.stringify(dto.to)}`);

    // Resolve both locations to coordinates
    const fromDetails = await this.resolveLocation(dto.from);
    const toDetails = await this.resolveLocation(dto.to);

    // Calculate haversine distance
    const distanceKm = this.haversineDistance(
      fromDetails.coordinates.latitude,
      fromDetails.coordinates.longitude,
      toDetails.coordinates.latitude,
      toDetails.coordinates.longitude,
    );

    // Convert to requested unit
    const unit = dto.unit || DistanceUnit.KM;
    const distance = this.convertDistance(distanceKm, unit);

    const response: DistanceCalculationResponse = {
      from: fromDetails,
      to: toDetails,
      distance: {
        value: Math.round(distance * 1000) / 1000, // Round to 3 decimals
        unit,
      },
      method: 'haversine',
    };

    // Add grid distance if requested and both are H3
    if (dto.includeGridDistance && fromDetails.type === 'h3' && toDetails.type === 'h3') {
      const cells = gridDistance(fromDetails.h3Index!, toDetails.h3Index!);
      response.gridDistance = {
        cells,
        method: 'h3_grid_distance',
      };
      response.method = 'h3_grid';
    }

    return response;
  }

  /**
   * POST /distance/batch
   * Calculate distances for multiple pairs
   */
  async batchDistance(dto: BatchDistanceDto): Promise<BatchDistanceResponse> {
    this.logger.log(`Calculating distances for ${dto.pairs.length} pairs`);

    const results: BatchDistanceResultDto[] = await Promise.all(
      dto.pairs.map(async (pair) => {
        try {
          const result = await this.calculateDistance({
            from: pair.from,
            to: pair.to,
            unit: dto.unit,
            includeGridDistance: dto.includeGridDistance,
          });

          return {
            ...result,
            success: true,
          };
        } catch (error) {
          this.logger.warn(`Failed to calculate distance: ${error.message}`);

          // Create empty location details for failed results
          const emptyLocation: LocationDetailsDto = {
            type: 'coordinate',
            coordinates: { latitude: 0, longitude: 0 },
          };

          return {
            from: emptyLocation,
            to: emptyLocation,
            distance: { value: 0, unit: dto.unit || DistanceUnit.KM },
            method: 'haversine' as const,
            success: false,
            error: error.message,
          };
        }
      }),
    );

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      results,
      total: dto.pairs.length,
      successful,
      failed,
      unit: dto.unit || DistanceUnit.KM,
    };
  }

  /**
   * Resolve a location to coordinates and details
   */
  private async resolveLocation(location: LocationDto): Promise<LocationDetailsDto> {
    // Validate: exactly one property must be set
    const props = [location.pincode, location.digipin, location.h3, location.coordinate];
    const defined = props.filter((p) => p !== undefined && p !== null);

    if (defined.length === 0) {
      throw new BadRequestException('Location must have one of: pincode, digipin, h3, or coordinate');
    }

    if (defined.length > 1) {
      throw new BadRequestException('Location must have exactly ONE of: pincode, digipin, h3, or coordinate');
    }

    // Handle each type
    if (location.pincode) {
      return this.resolvePincode(location.pincode);
    }

    if (location.digipin) {
      return this.resolveDigipin(location.digipin);
    }

    if (location.h3) {
      return this.resolveH3(location.h3);
    }

    if (location.coordinate) {
      return this.resolveCoordinate(location.coordinate);
    }

    throw new BadRequestException('Location must have one of: pincode, digipin, h3, or coordinate');
  }

  /**
   * Resolve pincode to coordinates
   */
  private async resolvePincode(pincode: string): Promise<LocationDetailsDto> {
    // Query with PostGIS to get coordinates
    const result = await this.pincodeRepository.query(
      `SELECT
        pincode,
        office_name,
        ST_Y(centroid::geometry) as lat,
        ST_X(centroid::geometry) as lng
      FROM pincodes
      WHERE pincode = $1 AND is_active = true
      LIMIT 1`,
      [pincode],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(`Pincode ${pincode} not found`);
    }

    const row = result[0];

    return {
      type: 'pincode',
      pincode: row.pincode,
      officeName: row.office_name,
      coordinates: {
        latitude: parseFloat(row.lat),
        longitude: parseFloat(row.lng),
      },
    };
  }

  /**
   * Resolve DIGIPIN to coordinates
   */
  private async resolveDigipin(digipinCode: string): Promise<LocationDetailsDto> {
    const decoded = this.digipinAlgorithm.decode(digipinCode);

    return {
      type: 'digipin',
      digipinCode,
      level: digipinCode.length,
      coordinates: {
        latitude: decoded.lat,
        longitude: decoded.lng,
      },
    };
  }

  /**
   * Resolve H3 to coordinates
   */
  private async resolveH3(h3Index: string): Promise<LocationDetailsDto> {
    const decoded = this.h3Algorithm.decode(h3Index);

    return {
      type: 'h3',
      h3Index,
      resolution: decoded.resolution,
      coordinates: {
        latitude: decoded.lat,
        longitude: decoded.lng,
      },
    };
  }

  /**
   * Resolve raw coordinate
   */
  private async resolveCoordinate(coordinate: { lat: number; lng: number }): Promise<LocationDetailsDto> {
    return {
      type: 'coordinate',
      coordinates: {
        latitude: coordinate.lat,
        longitude: coordinate.lng,
      },
    };
  }

  /**
   * Haversine distance between two points
   */
  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Convert distance from km to requested unit
   */
  private convertDistance(km: number, unit: DistanceUnit): number {
    switch (unit) {
      case DistanceUnit.KM:
        return km;
      case DistanceUnit.MI:
        return km * 0.621371; // km to miles
      case DistanceUnit.M:
        return km * 1000; // km to meters
      default:
        return km;
    }
  }
}
