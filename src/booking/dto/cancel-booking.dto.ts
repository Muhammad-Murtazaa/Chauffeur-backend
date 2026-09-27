import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelBookingDto {
  @ApiProperty({
    example: 'Flight delayed by airline / schedule changed',
    description: 'Reason for cancellation',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
