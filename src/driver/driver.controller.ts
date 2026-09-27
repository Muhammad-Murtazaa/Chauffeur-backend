import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DriverService } from './driver.service';
import {
  RegisterVehicleDto,
  UpdateVehicleDto,
  CreateDriverDocumentDto,
  CreateVehicleDocumentDto,
  CreateVehiclePhotoDto,
  UpdateAvailabilityDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Driver Portal')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DRIVER')
@Controller('driver')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  // ==========================================
  // DASHBOARD & AVAILABILITY
  // ==========================================

  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Driver Dashboard Overview' })
  async getDashboard(@CurrentUser('id') userId: number) {
    return this.driverService.getDashboardOverview(userId);
  }

  @Get('availability')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Driver Availability Status' })
  async getAvailability(@CurrentUser('id') userId: number) {
    return this.driverService.getAvailability(userId);
  }

  @Patch('availability')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update Driver Availability Status' })
  async updateAvailability(
    @CurrentUser('id') userId: number,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.driverService.updateAvailability(userId, dto.status);
  }

  @Get('verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Verification Status & Audit Trail' })
  async getVerificationStatus(@CurrentUser('id') userId: number) {
    return this.driverService.getVerificationStatus(userId);
  }

  // ==========================================
  // VEHICLE MANAGEMENT
  // ==========================================

  @Post('vehicle')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register Vehicle for Driver' })
  async registerVehicle(
    @CurrentUser('id') userId: number,
    @Body() dto: RegisterVehicleDto,
  ) {
    return this.driverService.registerVehicle(userId, dto);
  }

  @Get('vehicle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Registered Vehicle Details' })
  async getVehicle(@CurrentUser('id') userId: number) {
    return this.driverService.getVehicle(userId);
  }

  @Patch('vehicle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update Vehicle Specifications' })
  async updateVehicle(
    @CurrentUser('id') userId: number,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.driverService.updateVehicle(userId, dto);
  }

  // ==========================================
  // DRIVER LEGAL DOCUMENTS
  // ==========================================

  @Get('documents')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Driver Legal Documents' })
  async getDriverDocuments(@CurrentUser('id') userId: number) {
    return this.driverService.getDriverDocuments(userId);
  }

  @Post('documents')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload / Update Driver Legal Document' })
  async upsertDriverDocument(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateDriverDocumentDto,
  ) {
    return this.driverService.upsertDriverDocument(userId, dto);
  }

  @Delete('documents/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete Driver Legal Document' })
  async deleteDriverDocument(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) docId: number,
  ) {
    return this.driverService.deleteDriverDocument(userId, docId);
  }

  // ==========================================
  // VEHICLE DOCUMENTS
  // ==========================================

  @Get('vehicle/documents')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Vehicle Documents' })
  async getVehicleDocuments(@CurrentUser('id') userId: number) {
    return this.driverService.getVehicleDocuments(userId);
  }

  @Post('vehicle/documents')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload / Update Vehicle Document' })
  async upsertVehicleDocument(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateVehicleDocumentDto,
  ) {
    return this.driverService.upsertVehicleDocument(userId, dto);
  }

  // ==========================================
  // VEHICLE 6-ANGLE PHOTOS
  // ==========================================

  @Get('vehicle/photos')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Vehicle Photos' })
  async getVehiclePhotos(@CurrentUser('id') userId: number) {
    return this.driverService.getVehiclePhotos(userId);
  }

  @Post('vehicle/photos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload / Update Vehicle Photo' })
  async upsertVehiclePhoto(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateVehiclePhotoDto,
  ) {
    return this.driverService.upsertVehiclePhoto(userId, dto);
  }
  // Vehicle photos endpoints above
}

