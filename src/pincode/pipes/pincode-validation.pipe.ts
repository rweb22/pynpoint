import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/**
 * Validation pipe for Indian pincode format
 * 
 * Validates that the pincode is exactly 6 digits
 * This is applied to path parameters in the PincodeController
 */
@Injectable()
export class PincodeValidationPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    // Check if pincode is exactly 6 digits
    const pincodeRegex = /^\d{6}$/;
    
    if (!pincodeRegex.test(value)) {
      throw new BadRequestException(
        `Invalid pincode format: "${value}". Pincode must be exactly 6 digits (0-9).`
      );
    }
    
    return value;
  }
}
