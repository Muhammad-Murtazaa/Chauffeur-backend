import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Admin Management Portal')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Dashboard Analytics & KPIs
   */
  @Get('dashboard/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get aggregated admin KPIs, financial metrics, and active bookings' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  /**
   * Customer Management
   */
  @Get('customers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all customers with trip volume and revenue spend' })
  async getCustomers(@Query('search') search?: string) {
    return this.adminService.getCustomers({ search });
  }

  @Patch('customers/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate or deactivate customer account' })
  async updateCustomerStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { isActive: boolean },
  ) {
    return this.adminService.updateCustomerStatus(id, Boolean(body.isActive));
  }

  /**
   * Driver & Fleet Vehicle Management
   */
  @Get('drivers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all drivers with their assigned vehicle and verification status' })
  async getDrivers(
    @Query('status') status?: string,
    @Query('verificationStatus') verificationStatus?: string,
  ) {
    return this.adminService.getDrivers({ status, verificationStatus });
  }

  @Patch('drivers/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve, reject, or suspend driver verification status' })
  async updateDriverStatus(
    @CurrentUser('id') adminUserId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { verificationStatus?: string; status?: string; rejectionReason?: string },
  ) {
    return this.adminService.updateDriverStatus(id, body, adminUserId);
  }

  @Patch('vehicles/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve or reject vehicle verification status' })
  async updateVehicleStatus(
    @CurrentUser('id') adminUserId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: string; rejectionReason?: string },
  ) {
    return this.adminService.updateVehicleStatus(id, body, adminUserId);
  }

  /**
   * Pricing Rules Management
   */
  @Get('pricing')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all vehicle class pricing rules and rate cards' })
  async getPricingRules() {
    return this.adminService.getPricingRules();
  }

  @Patch('pricing/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update vehicle class base rates, mileage, hourly, and minute fares' })
  async updatePricingRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    return this.adminService.updatePricingRule(id, body);
  }
}
