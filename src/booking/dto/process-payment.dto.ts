import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ProcessPaymentDto {
  @ApiPropertyOptional({
    example: 'MOCK',
    enum: ['STRIPE', 'MOCK', 'CASH', 'SQUARE'],
    default: 'MOCK',
  })
  @IsEnum(['STRIPE', 'MOCK', 'CASH', 'SQUARE'])
  @IsOptional()
  provider?: 'STRIPE' | 'MOCK' | 'CASH' | 'SQUARE' = 'MOCK';

  @ApiPropertyOptional({
    example: 'pm_card_visa_lux_chauffeur',
    description: 'Payment method ID from Stripe / Payment provider',
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
