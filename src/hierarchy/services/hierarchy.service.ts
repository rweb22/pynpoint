import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SpatialConverter } from 'h3-digipin';
import { cellToLatLng, getResolution } from 'h3-js';
import {
  H3ParentResponse,
  H3ChildrenResponse,
  H3AncestorsResponse,
  DigipinParentResponse,
  DigipinChildrenResponse,
  DigipinAncestorsResponse,
} from '../dto/hierarchy-response.dto';

/**
 * HierarchyService
 * 
 * Implements parent/child/ancestor navigation for H3 and DIGIPIN cells
 * Uses h3-digipin library for all hierarchy operations
 */
@Injectable()
export class HierarchyService {
  private readonly logger = new Logger(HierarchyService.name);
  private readonly spatialConverter: SpatialConverter;

  constructor() {
    this.spatialConverter = new SpatialConverter();
  }

  /**
   * Get H3 parent cell
   */
  async getH3Parent(h3Index: string, parentResolution?: number): Promise<H3ParentResponse> {
    this.logger.log(`Getting H3 parent for ${h3Index}, resolution: ${parentResolution}`);

    try {
      const resolution = getResolution(h3Index);
      const parent = this.spatialConverter.getH3Parent(h3Index, parentResolution);
      const parentRes = getResolution(parent);
      const [lat, lng] = cellToLatLng(h3Index);

      return {
        h3Index,
        resolution,
        parent,
        parentResolution: parentRes,
        center: { latitude: lat, longitude: lng },
      };
    } catch (error) {
      throw new BadRequestException(`Invalid H3 index: ${error.message}`);
    }
  }

  /**
   * Get H3 children cells
   */
  async getH3Children(h3Index: string, childResolution?: number): Promise<H3ChildrenResponse> {
    this.logger.log(`Getting H3 children for ${h3Index}, resolution: ${childResolution}`);

    try {
      const resolution = getResolution(h3Index);
      const children = this.spatialConverter.getH3Children(h3Index, childResolution);
      const childRes = childResolution || resolution + 1;
      const [lat, lng] = cellToLatLng(h3Index);

      return {
        h3Index,
        resolution,
        children,
        childrenResolution: childRes,
        totalChildren: children.length,
        center: { latitude: lat, longitude: lng },
      };
    } catch (error) {
      throw new BadRequestException(`Invalid H3 index: ${error.message}`);
    }
  }

  /**
   * Get all H3 ancestors (from resolution 0 to current)
   */
  async getH3Ancestors(h3Index: string): Promise<H3AncestorsResponse> {
    this.logger.log(`Getting H3 ancestors for ${h3Index}`);

    try {
      const resolution = getResolution(h3Index);
      const ancestors = this.spatialConverter.getH3Ancestors(h3Index);
      const [lat, lng] = cellToLatLng(h3Index);

      return {
        h3Index,
        resolution,
        ancestors: ancestors.map((cell, index) => ({
          cell,
          resolution: index,
        })),
        totalAncestors: ancestors.length,
        center: { latitude: lat, longitude: lng },
      };
    } catch (error) {
      throw new BadRequestException(`Invalid H3 index: ${error.message}`);
    }
  }

  /**
   * Get DIGIPIN parent cell
   */
  async getDigipinParent(digipinCode: string): Promise<DigipinParentResponse> {
    this.logger.log(`Getting DIGIPIN parent for ${digipinCode}`);

    try {
      const level = this.spatialConverter.getDigipinLevel(digipinCode);
      const parent = this.spatialConverter.getDigipinParent(digipinCode);
      const parentLevel = level - 1;
      const { lat, lng } = this.spatialConverter.decodeDigipin(digipinCode);

      return {
        digipinCode,
        level,
        parent,
        parentLevel,
        center: { latitude: lat, longitude: lng },
      };
    } catch (error) {
      throw new BadRequestException(`Invalid DIGIPIN code: ${error.message}`);
    }
  }

  /**
   * Get DIGIPIN children cells
   */
  async getDigipinChildren(digipinCode: string): Promise<DigipinChildrenResponse> {
    this.logger.log(`Getting DIGIPIN children for ${digipinCode}`);

    try {
      const level = this.spatialConverter.getDigipinLevel(digipinCode);
      const children = this.spatialConverter.getDigipinChildren(digipinCode);
      const childrenLevel = level + 1;
      const { lat, lng } = this.spatialConverter.decodeDigipin(digipinCode);

      return {
        digipinCode,
        level,
        children,
        childrenLevel,
        totalChildren: children.length,
        center: { latitude: lat, longitude: lng },
      };
    } catch (error) {
      throw new BadRequestException(`Invalid DIGIPIN code: ${error.message}`);
    }
  }

  /**
   * Get all DIGIPIN ancestors (from level 1 to current)
   */
  async getDigipinAncestors(digipinCode: string): Promise<DigipinAncestorsResponse> {
    this.logger.log(`Getting DIGIPIN ancestors for ${digipinCode}`);

    try {
      const level = this.spatialConverter.getDigipinLevel(digipinCode);
      const ancestors = this.spatialConverter.getDigipinAncestors(digipinCode);
      const { lat, lng } = this.spatialConverter.decodeDigipin(digipinCode);

      return {
        digipinCode,
        level,
        ancestors: ancestors.map((cell, index) => ({
          cell,
          level: index + 1,
        })),
        totalAncestors: ancestors.length,
        center: { latitude: lat, longitude: lng },
      };
    } catch (error) {
      throw new BadRequestException(`Invalid DIGIPIN code: ${error.message}`);
    }
  }
}
