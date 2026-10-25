import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ProcessPaymentDto {
  @ApiPropertyOptional({
    example: 'SQUARE',
    enum: ['SQUARE', 'MOCK', 'CASH'],
    default: 'SQUARE',
  })
  @IsEnum(['SQUARE', 'MOCK', 'CASH'])
  @IsOptional()
  provider?: 'SQUARE' | 'MOCK' | 'CASH' = 'SQUARE';

  @ApiPropertyOptional({
    example: 'cnon:card-nonce-ok',
    description: 'Payment token or source ID from Square Web Payments SDK',
  })
  @IsString()
  @IsOptional()
  paymentMethodId?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether mock payment should immediately simulate success',
  })
  @IsBoolean()
  @IsOptional()
  mockSuccess?: boolean = true;
}
