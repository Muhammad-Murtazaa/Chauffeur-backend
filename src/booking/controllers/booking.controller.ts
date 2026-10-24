import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookingService } from '../services/booking.service';
import { PaymentService } from '../payment/payment.service';
import { CreateBookingDto, ProcessPaymentDto, CancelBookingDto } from '../dto';
import { StripeService } from '../payment/stripe.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Customer Bookings')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly paymentService: PaymentService,
    private readonly stripeService: StripeService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create booking from accepted quote' })
  async createBooking(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingService.createBookingFromQuote(userId, dto);
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all bookings for authenticated customer' })
  async getMyBookings(@CurrentUser('id') userId: number) {
    return this.bookingService.getCustomerBookings(userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get complete booking details and status' })
  async getBooking(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.bookingService.getBookingDetails(id, user);
  }

  @Post(':id/create-payment-intent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create Stripe PaymentIntent for booking' })
  async createPaymentIntent(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const booking = await this.bookingService.getBookingDetails(id, {
      id: userId,
      role: 'CUSTOMER',
    });
    return this.stripeService.createPaymentIntent({
      amount: Number(booking.totalPrice),
      currency: booking.currency,
      bookingId: booking.id,
      customerEmail: booking.passengerEmail,
      metadata: {
        referenceNumber: booking.referenceNumber,
        passengerName: booking.passengerName,
      },
    });
  }

  @Post(':id/payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process payment for booking' })
  async processPayment(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProcessPaymentDto,
  ) {
    return this.paymentService.processPayment(id, userId, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel booking and calculate cancellation fee' })
  async cancelBooking(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingService.cancelBooking(id, user, dto);
  }
}
