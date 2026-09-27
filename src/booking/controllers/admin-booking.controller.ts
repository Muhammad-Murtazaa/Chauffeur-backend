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
import { DriverAssignmentService } from '../assignment/driver-assignment.service';
import { AssignDriverDto, ReassignDriverDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Admin Dispatch & Fleet Assignment')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/bookings')
export class AdminBookingController {
  constructor(
    private readonly assignmentService: DriverAssignmentService,
  ) {}

  @Get('unassigned')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all unassigned bookings ready for chauffeur dispatch' })
  async getUnassignedBookings() {
    return this.assignmentService.getUnassignedBookings();
  }

  @Get(':id/eligible-drivers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Query eligible active drivers with schedule conflict checks' })
  async getEligibleDrivers(@Param('id', ParseIntPipe) id: number) {
    return this.assignmentService.getEligibleDriversForBooking(id);
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dispatch and assign driver to booking' })
  async assignDriver(
    @CurrentUser('id') adminUserId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignDriverDto,
  ) {
    return this.assignmentService.assignDriver(
      id,
      dto.driverId,
      adminUserId,
      dto.vehicleId,
      dto.note,
    );
  }

  @Post(':id/reassign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reassign booking to a different driver' })
  async reassignDriver(
    @CurrentUser('id') adminUserId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReassignDriverDto,
  ) {
    return this.assignmentService.reassignDriver(
      id,
      dto.driverId,
      adminUserId,
      dto.reason,
    );
  }
}
