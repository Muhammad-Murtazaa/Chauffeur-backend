import { Module } from '@nestjs/common';
import { RouteService } from './route/route.service';
import { PricingService } from './pricing/pricing.service';
import { QuoteService } from './quote/quote.service';
import { QuoteController } from './quote/quote.controller';
import { BookingService } from './services/booking.service';
import { BookingController } from './controllers/booking.controller';
import { PaymentService } from './payment/payment.service';
import { StripeService } from './payment/stripe.service';
import { DriverAssignmentService } from './assignment/driver-assignment.service';
import { AdminBookingController } from './controllers/admin-booking.controller';
import { RideService } from './ride/ride.service';
import { DriverBookingController } from './controllers/driver-booking.controller';

@Module({
  controllers: [
    QuoteController,
    BookingController,
    AdminBookingController,
    DriverBookingController,
  ],
  providers: [
    RouteService,
    PricingService,
    QuoteService,
    BookingService,
    PaymentService,
    StripeService,
    DriverAssignmentService,
    RideService,
  ],
  exports: [
    RouteService,
    PricingService,
    QuoteService,
    BookingService,
    PaymentService,
    StripeService,
    DriverAssignmentService,
    RideService,
  ],
})
export class BookingModule {}
