import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ProcessPaymentDto {
  @ApiPropertyOptional({
    example: 'STRIPE',
    enum: ['STRIPE', 'SQUARE', 'MOCK', 'CASH'],
    default: 'STRIPE',
  })
  @IsEnum(['STRIPE', 'SQUARE', 'MOCK', 'CASH'])
  @IsOptional()
  provider?: 'STRIPE' | 'SQUARE' | 'MOCK' | 'CASH' = 'STRIPE';

  @ApiPropertyOptional({
    example: 'pm_card_visa',
    description: 'Payment token, PaymentIntent ID, or PaymentMethod ID from Stripe SDK',
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
