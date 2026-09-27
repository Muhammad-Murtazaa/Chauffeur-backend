import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type VehicleDocType =
  | 'REGISTRATION'
  | 'INSURANCE'
  | 'INSPECTION_CERTIFICATE'
  | 'COMMERCIAL_LICENSE'
  | 'OTHER';

export const VEHICLE_DOC_TYPES: VehicleDocType[] = [
  'REGISTRATION',
  'INSURANCE',
  'INSPECTION_CERTIFICATE',
  'COMMERCIAL_LICENSE',
  'OTHER',
];

export class CreateVehicleDocumentDto {
  @ApiProperty({
    example: 'INSURANCE',
    enum: VEHICLE_DOC_TYPES,
    description: 'Type of vehicle compliance document',
  })
  @IsEnum(VEHICLE_DOC_TYPES, {
    message: `Document type must be one of: ${VEHICLE_DOC_TYPES.join(', ')}`,
  })
  documentType: VehicleDocType;

  @ApiPropertyOptional({
    example: 'POL-COMM-994012A',
    description: 'Document or policy number',
    maxLength: 150,
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  documentNumber?: string;

  @ApiProperty({
    example: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c',
    description: 'URL of the document file/scan',
  })
  @IsString()
  @IsNotEmpty({ message: 'File URL is required' })
  fileUrl: string;

  @ApiPropertyOptional({
    example: '2024-01-01',
    description: 'Issue date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  issueDate?: string;

  @ApiPropertyOptional({
    example: '2027-01-01',
    description: 'Expiration date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  expiryDate?: string;
}
