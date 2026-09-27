import {
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export type DriverAvailability = 'OFFLINE' | 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE';

export const AVAILABILITY_STATUSES: DriverAvailability[] = [
  'OFFLINE',
  'AVAILABLE',
  'BUSY',
  'UNAVAILABLE',
];

export class UpdateAvailabilityDto {
  @ApiProperty({
    example: 'AVAILABLE',
    enum: AVAILABILITY_STATUSES,
    description: 'Target driver availability status',
  })
  @IsEnum(AVAILABILITY_STATUSES, {
    message: `Availability status must be one of: ${AVAILABILITY_STATUSES.join(', ')}`,
  })
  @IsNotEmpty()
  status: DriverAvailability;
}
