import {
  IsEnum,
  IsNotEmpty,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export type VehiclePhotoType =
  | 'FRONT'
  | 'BACK'
  | 'LEFT'
  | 'RIGHT'
  | 'INTERIOR'
  | 'LICENSE_PLATE';

export const VEHICLE_PHOTO_TYPES: VehiclePhotoType[] = [
  'FRONT',
  'BACK',
  'LEFT',
  'RIGHT',
  'INTERIOR',
  'LICENSE_PLATE',
];

export class CreateVehiclePhotoDto {
  @ApiProperty({
    example: 'FRONT',
    enum: VEHICLE_PHOTO_TYPES,
    description: 'Vehicle inspection angle',
  })
  @IsEnum(VEHICLE_PHOTO_TYPES, {
    message: `Photo type must be one of: ${VEHICLE_PHOTO_TYPES.join(', ')}`,
  })
  photoType: VehiclePhotoType;

  @ApiProperty({
    example: 'https://images.unsplash.com/photo-1617788138017-80ad40651399',
    description: 'URL of the high-resolution photo',
  })
  @IsString()
  @IsNotEmpty({ message: 'Image URL is required' })
  imageUrl: string;
}
