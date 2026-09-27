import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateQuoteDto {
  @ApiProperty({
    example: 'ONE_WAY',
    enum: ['ONE_WAY', 'RETURN', 'HOURLY', 'CITY_TO_CITY'],
    default: 'ONE_WAY',
  })
  @IsEnum(['ONE_WAY', 'RETURN', 'HOURLY', 'CITY_TO_CITY'])
  @IsOptional()
  bookingType?: 'ONE_WAY' | 'RETURN' | 'HOURLY' | 'CITY_TO_CITY' = 'ONE_WAY';

  @ApiProperty({
    example: 'John F. Kennedy International Airport (JFK), Queens, NY',
    description: 'Full pickup address or terminal name',
  })
  @IsString()
  @IsNotEmpty()
  pickupAddress: string;

  @ApiPropertyOptional({
    example: 'ChIJ...JFKPlaceId',
    description: 'Google Place ID for pickup',
  })
  @IsString()
  @IsOptional()
  pickupPlaceId?: string;

  @ApiPropertyOptional({ example: 40.6413, description: 'Pickup latitude' })
  @IsNumber()
  @IsOptional()
  pickupLat?: number;

  @ApiPropertyOptional({ example: -73.7781, description: 'Pickup longitude' })
  @IsNumber()
  @IsOptional()
  pickupLng?: number;

  @ApiPropertyOptional({
    example: 'The Plaza Hotel, 5th Ave, New York, NY 10019',
    description: 'Full dropoff address or hotel name',
  })
  @IsString()
  @IsOptional()
  dropoffAddress?: string;

  @ApiPropertyOptional({
    example: 'ChIJ...PlazaPlaceId',
    description: 'Google Place ID for dropoff',
  })
  @IsString()
  @IsOptional()
  dropoffPlaceId?: string;

  @ApiPropertyOptional({ example: 40.7645, description: 'Dropoff latitude' })
  @IsNumber()
  @IsOptional()
  dropoffLat?: number;

  @ApiPropertyOptional({ example: -73.9745, description: 'Dropoff longitude' })
  @IsNumber()
  @IsOptional()
  dropoffLng?: number;

  @ApiProperty({
    example: '2026-09-28T10:00:00.000Z',
    description: 'Scheduled pickup date and time in ISO format',
  })
  @IsDateString()
  @IsNotEmpty()
  pickupAt: string;

  @ApiPropertyOptional({ example: 2, default: 1 })
  @IsNumber()
  @Min(1)
  @Max(20)
  @IsOptional()
  passengerCount?: number = 1;

  @ApiPropertyOptional({ example: 2, default: 0 })
  @IsNumber()
  @Min(0)
  @Max(20)
  @IsOptional()
  luggageCount?: number = 0;

  @ApiPropertyOptional({
    example: 3,
    description: 'Number of hours (required if bookingType is HOURLY)',
  })
  @IsNumber()
  @Min(0)
  @Max(24)
  @IsOptional()
  hours?: number = 0;

  @ApiPropertyOptional({
    example: 'BA 178',
    description: 'Optional flight number for airport pickups',
  })
  @IsString()
  @IsOptional()
  flightNumber?: string;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string = 'USD';
}
