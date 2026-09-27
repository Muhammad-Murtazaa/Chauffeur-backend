import { IsNumber, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignDriverDto {
  @ApiProperty({ example: 1, description: 'ID of the eligible driver to assign' })
  @IsNumber()
  @IsNotEmpty()
  driverId: number;

  @ApiPropertyOptional({ example: 1, description: 'Optional explicit vehicle ID to assign' })
  @IsNumber()
  @IsOptional()
  vehicleId?: number;

  @ApiPropertyOptional({ example: 'Dispatched for VIP client arrival' })
  @IsString()
  @IsOptional()
  note?: string;
}

export class ReassignDriverDto {
  @ApiProperty({ example: 2, description: 'ID of the new driver' })
  @IsNumber()
  @IsNotEmpty()
  driverId: number;

  @ApiPropertyOptional({ example: 'Previous driver requested reassignment due to traffic delay' })
  @IsString()
  @IsOptional()
  reason?: string;
}
