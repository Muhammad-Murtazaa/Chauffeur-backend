import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DriverActionDto {
  @ApiPropertyOptional({
    example: 'Client did not arrive after 20 minutes waiting period',
    description: 'Reason for action (required for reject / no-show)',
  })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ example: 28400, description: 'Actual distance traveled in meters' })
  @IsNumber()
  @IsOptional()
  actualDistanceMeters?: number;

  @ApiPropertyOptional({ example: 2450, description: 'Actual duration in seconds' })
  @IsNumber()
  @IsOptional()
  actualDurationSeconds?: number;
}
