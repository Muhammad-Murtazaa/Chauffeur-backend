import {
  IsNumber,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({
    example: 1,
    description: 'ID of the active quote to convert into a booking',
  })
  @IsNumber()
  @IsNotEmpty()
  quoteId: number;

  @ApiProperty({
    example: 2,
    description: 'Selected vehicle type ID from the quote options',
  })
  @IsNumber()
  @IsNotEmpty()
  vehicleTypeId: number;

  @ApiProperty({ example: 'Lord Alexander Vance', description: 'Passenger full name' })
  @IsString()
  @IsNotEmpty()
  passengerName: string;

  @ApiProperty({ example: '+1 (555) 987-6543', description: 'Passenger contact phone number' })
  @IsString()
  @IsNotEmpty()
  passengerPhone: string;

  @ApiProperty({ example: 'alexander.vance@vip.luxury.com', description: 'Passenger email' })
  @IsEmail()
  @IsNotEmpty()
  passengerEmail: string;

  @ApiPropertyOptional({ example: 'BA 178', description: 'Optional incoming flight number' })
  @IsString()
  @IsOptional()
  flightNumber?: string;

  @ApiPropertyOptional({
    example: 'Please prepare sparkling water and chilled San Pellegrino upon boarding.',
    description: 'Special requests, child seat, or instructions for the chauffeur',
  })
  @IsString()
  @IsOptional()
  specialInstructions?: string;
}
