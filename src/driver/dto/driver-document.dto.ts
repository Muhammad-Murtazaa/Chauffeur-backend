import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type DriverDocType =
  | 'DRIVING_LICENSE'
  | 'IDENTITY_DOCUMENT'
  | 'BACKGROUND_CHECK'
  | 'WORK_PERMIT'
  | 'OTHER';

export const DRIVER_DOC_TYPES: DriverDocType[] = [
  'DRIVING_LICENSE',
  'IDENTITY_DOCUMENT',
  'BACKGROUND_CHECK',
  'WORK_PERMIT',
  'OTHER',
];

export class CreateDriverDocumentDto {
  @ApiProperty({
    example: 'DRIVING_LICENSE',
    enum: DRIVER_DOC_TYPES,
    description: 'Type of driver compliance document',
  })
  @IsEnum(DRIVER_DOC_TYPES, {
    message: `Document type must be one of: ${DRIVER_DOC_TYPES.join(', ')}`,
  })
  documentType: DriverDocType;

  @ApiPropertyOptional({
    example: 'NY-TLC-98402144',
    description: 'Document identification number',
    maxLength: 150,
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  documentNumber?: string;

  @ApiPropertyOptional({
    example: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f',
    description: 'URL of the front document image / scan',
  })
  @IsOptional()
  @IsString()
  frontImageUrl?: string;

  @ApiPropertyOptional({
    example: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f',
    description: 'URL of the back document image / scan',
  })
  @IsOptional()
  @IsString()
  backImageUrl?: string;

  @ApiPropertyOptional({
    example: '2024-01-01',
    description: 'Issue date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  issueDate?: string;

  @ApiPropertyOptional({
    example: '2028-01-01',
    description: 'Expiration date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  expiryDate?: string;
}
