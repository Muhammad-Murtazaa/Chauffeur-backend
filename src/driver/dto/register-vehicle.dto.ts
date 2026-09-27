import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type VehicleCategory =
  | 'STANDARD'
  | 'EXECUTIVE'
  | 'LUXURY'
  | 'SUV'
  | 'VAN';

export const VEHICLE_CATEGORIES: VehicleCategory[] = [
  'STANDARD',
  'EXECUTIVE',
  'LUXURY',
  'SUV',
  'VAN',
];

export class RegisterVehicleDto {
  @ApiProperty({
    example: 'Mercedes-Benz',
    description: 'Vehicle manufacturer/make',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: 'Vehicle make is required' })
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  make: string;

  @ApiProperty({
    example: 'S-Class S 580',
    description: 'Vehicle model',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: 'Vehicle model is required' })
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  model: string;

  @ApiProperty({
    example: 2024,
    description: 'Manufacturing year of the vehicle',
    minimum: 1990,
  })
  @IsInt({ message: 'Year must be an integer' })
  @Min(1990, { message: 'Year must be 1990 or newer' })
  @Max(new Date().getFullYear() + 1, { message: 'Year cannot be in the future' })
  year: number;

  @ApiProperty({
    example: 'Black',
    description: 'Vehicle exterior color',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty({ message: 'Vehicle color is required' })
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  color: string;

  @ApiProperty({
    example: 'NY-CHAUFF-88',
    description: 'Vehicle license plate / registration number',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: 'Registration number is required' })
  @MaxLength(100)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  registrationNumber: string;

  @ApiPropertyOptional({
    example: '1HGCR2F83HA123456',
    description: 'Vehicle Identification Number (VIN)',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  vinNumber?: string;

  @ApiProperty({
    example: 'LUXURY',
    enum: VEHICLE_CATEGORIES,
    description: 'Category tier of the vehicle',
  })
  @IsEnum(VEHICLE_CATEGORIES, {
    message: `Category must be one of: ${VEHICLE_CATEGORIES.join(', ')}`,
  })
  category: VehicleCategory;

  @ApiProperty({
    example: 3,
    description: 'Maximum passenger seating capacity (excluding driver)',
    minimum: 1,
    maximum: 50,
  })
  @IsInt({ message: 'Passenger capacity must be an integer' })
  @Min(1, { message: 'Passenger capacity must be at least 1' })
  @Max(50, { message: 'Passenger capacity cannot exceed 50' })
  passengerCapacity: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Luggage capacity in standard pieces/suitcases',
    minimum: 0,
    maximum: 50,
    default: 0,
  })
  @IsOptional()
  @IsInt({ message: 'Luggage capacity must be an integer' })
  @Min(0, { message: 'Luggage capacity cannot be negative' })
  @Max(50, { message: 'Luggage capacity cannot exceed 50' })
  luggageCapacity?: number;
}
