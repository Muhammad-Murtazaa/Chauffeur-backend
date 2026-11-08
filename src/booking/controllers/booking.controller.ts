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
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookingService } from '../services/booking.service';
import { PaymentService } from '../payment/payment.service';
import { CreateBookingDto, ProcessPaymentDto, CancelBookingDto } from '../dto';
import { StripeService } from '../payment/stripe.service';
import { JwtOptionalGuard } from '../../auth/guards/jwt-optional.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Customer Bookings')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtOptionalGuard)
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
    @CurrentUser() user: any,
    @Body() dto: CreateBookingDto,
  ) {
    const customerId = user?.role === 'CUSTOMER' ? user.id : null;
    return this.bookingService.createBookingFromQuote(customerId, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
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
    @Headers('x-booking-access-token') guestAccessToken?: string,
  ) {
    return this.bookingService.getBookingDetails(
      id,
      user?.role === 'CUSTOMER' ? user : { id: 0, role: 'GUEST' },
      guestAccessToken,
    );
  }

  @Get('payment/stripe-config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Stripe Elements publishable key and client configuration' })
  getStripeConfig() {
    return this.stripeService.getStripeConfig();
  }

  @Get('payment/square-config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Legacy alias: redirects/returns payment client configuration' })
  getLegacyPaymentConfig() {
    return this.stripeService.getStripeConfig();
  }

  @Post(':id/create-payment-intent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initialize Stripe payment session for booking' })
  async createPaymentIntent(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-booking-access-token') guestAccessToken?: string,
  ) {
    const booking = await this.bookingService.getBookingDetails(
      id,
      user?.role === 'CUSTOMER' ? user : { id: 0, role: 'GUEST' },
      guestAccessToken,
    );
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
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProcessPaymentDto,
    @Headers('x-booking-access-token') guestAccessToken?: string,
  ) {
    await this.bookingService.getBookingDetails(
      id,
      user?.role === 'CUSTOMER' ? user : { id: 0, role: 'GUEST' },
      guestAccessToken,
    );
    const customerId = user?.role === 'CUSTOMER' ? user.id : null;
    return this.paymentService.processPayment(id, customerId, dto, !customerId);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel booking and calculate cancellation fee' })
  async cancelBooking(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelBookingDto,
    @Headers('x-booking-access-token') guestAccessToken?: string,
  ) {
    await this.bookingService.getBookingDetails(
      id,
      user?.role === 'CUSTOMER' ? user : { id: 0, role: 'GUEST' },
      guestAccessToken,
    );
    return this.bookingService.cancelBooking(
      id,
      user?.role === 'CUSTOMER' ? user : { id: 0, role: 'GUEST' },
      dto,
    );
  }
}
