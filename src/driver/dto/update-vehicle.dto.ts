import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { VehicleCategory } from './register-vehicle.dto';
import { VEHICLE_CATEGORIES } from './register-vehicle.dto';

export class UpdateVehicleDto {
  @ApiPropertyOptional({
    example: 'Mercedes-Benz',
    description: 'Vehicle manufacturer/make',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  make?: string;

  @ApiPropertyOptional({
    example: 'S-Class S 580',
    description: 'Vehicle model',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  model?: string;

  @ApiPropertyOptional({
    example: 2024,
    description: 'Manufacturing year of the vehicle',
    minimum: 1990,
  })
  @IsOptional()
  @IsInt({ message: 'Year must be an integer' })
  @Min(1990, { message: 'Year must be 1990 or newer' })
  @Max(new Date().getFullYear() + 1, { message: 'Year cannot be in the future' })
  year?: number;

  @ApiPropertyOptional({
    example: 'Midnight Black',
    description: 'Vehicle exterior color',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  color?: string;

  @ApiPropertyOptional({
    example: 'NY-CHAUFF-99',
    description: 'Vehicle license plate / registration number',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  registrationNumber?: string;

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

  @ApiPropertyOptional({
    example: 'LUXURY',
    enum: VEHICLE_CATEGORIES,
    description: 'Category tier of the vehicle',
  })
  @IsOptional()
  @IsEnum(VEHICLE_CATEGORIES, {
    message: `Category must be one of: ${VEHICLE_CATEGORIES.join(', ')}`,
  })
  category?: VehicleCategory;

  @ApiPropertyOptional({
    example: 3,
    description: 'Maximum passenger seating capacity (excluding driver)',
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsInt({ message: 'Passenger capacity must be an integer' })
  @Min(1, { message: 'Passenger capacity must be at least 1' })
  @Max(50, { message: 'Passenger capacity cannot exceed 50' })
  passengerCapacity?: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Luggage capacity in standard pieces/suitcases',
    minimum: 0,
    maximum: 50,
  })
  @IsOptional()
  @IsInt({ message: 'Luggage capacity must be an integer' })
  @Min(0, { message: 'Luggage capacity cannot be negative' })
  @Max(50, { message: 'Luggage capacity cannot exceed 50' })
  luggageCapacity?: number;
}
