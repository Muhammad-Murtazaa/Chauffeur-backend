import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookingService } from '../services/booking.service';
import { RideService } from '../ride/ride.service';
import { DriverActionDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Driver Booking & Ride Lifecycle')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DRIVER')
@Controller('driver/bookings')
export class DriverBookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly rideService: RideService,
  ) {}

  @Get('active')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current active ride assignment in progress' })
  async getActiveBooking(@CurrentUser('id') userId: number) {
    return this.bookingService.getDriverActiveBooking(userId);
  }

  @Get('upcoming')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get upcoming assigned and accepted bookings' })
  async getUpcomingBookings(@CurrentUser('id') userId: number) {
    return this.bookingService.getDriverUpcomingBookings(userId);
  }

  @Get('history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get past completed ride history' })
  async getBookingHistory(@CurrentUser('id') userId: number) {
    return this.bookingService.getDriverBookingHistory(userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get booking details for assigned driver' })
  async getBookingDetails(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.bookingService.getBookingDetails(id, user);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept booking assignment' })
  async acceptBooking(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.rideService.acceptBooking(userId, id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject booking assignment' })
  async rejectBooking(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DriverActionDto,
  ) {
    return this.rideService.rejectBooking(userId, id, dto);
  }

  @Post(':id/en-route')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark chauffeur en route to pickup location' })
  async driverEnRoute(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.rideService.driverEnRoute(userId, id);
  }

  @Post(':id/arrived')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark chauffeur arrived at pickup location' })
  async driverArrived(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.rideService.driverArrived(userId, id);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start ride (passenger on board)' })
  async startRide(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.rideService.startRide(userId, id);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete ride and record actual metrics' })
  async completeRide(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DriverActionDto,
  ) {
    return this.rideService.completeRide(userId, id, dto);
  }

  @Post(':id/no-show')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Report passenger no-show' })
  async reportNoShow(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DriverActionDto,
  ) {
    return this.rideService.reportNoShow(userId, id, dto);
  }
}
