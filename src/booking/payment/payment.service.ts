import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database';
import type { DrizzleDb } from '../../database';
import {
  bookings,
  payments,
  bookingStatusHistory,
} from '../../database/schema';
import { ProcessPaymentDto } from '../dto';
import { DriverAssignmentService } from '../assignment/driver-assignment.service';
import { StripeService } from './stripe.service';

@Injectable()
export class PaymentService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly driverAssignmentService: DriverAssignmentService,
    private readonly stripeService: StripeService,
  ) {}

  /**
   * Process payment for a booking.
   * On successful payment, auto-assigns the least-recently-assigned eligible driver.
   */
  async processPayment(
    bookingId: number,
    userId: number | null,
    dto: ProcessPaymentDto,
    guestAuthorized = false,
  ) {
    const [booking] = await this.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found.`);
    }

    if (booking.customerId !== userId && !guestAuthorized) {
      throw new BadRequestException(
        'You are not authorized to process payment for this booking.',
      );
    }

    if (booking.paymentStatus === 'PAID') {
      throw new BadRequestException('This booking has already been paid.');
    }

    const provider = dto.provider || 'STRIPE';
    let isSuccess = true;
    let providerPaymentId = dto.paymentMethodId || `pi_${Date.now()}`;
    let errorMessage: string | null = null;

    if (provider === 'STRIPE' || provider === 'SQUARE') {
      try {
        const stripeResult = await this.stripeService.processStripePayment({
          paymentMethodId: dto.paymentMethodId,
          bookingId: booking.id,
          amount: Number(booking.totalPrice),
          currency: booking.currency,
          customerEmail: booking.passengerEmail,
          referenceNumber: booking.referenceNumber,
        });
        isSuccess = stripeResult.success;
        providerPaymentId = stripeResult.paymentId;
      } catch (err: any) {
        isSuccess = false;
        errorMessage = err.message || 'Stripe payment authorization failed';
      }
    } else {
      const isMock = provider === 'MOCK';
      isSuccess = isMock ? dto.mockSuccess !== false : true;
      providerPaymentId = isMock
        ? `mock_pay_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        : dto.paymentMethodId || `pay_${Date.now()}`;
      errorMessage = isSuccess ? null : 'Simulated payment failure / decline';
    }

    // 1. Create Payment Record
    const [paymentRecord] = await this.db
      .insert(payments)
      .values({
        bookingId: booking.id,
        provider: provider as any,
        providerPaymentId,
        amount: booking.totalPrice,
        currency: booking.currency,
        status: isSuccess ? 'PAID' : 'FAILED',
        paidAt: isSuccess ? new Date() : null,
        failedAt: isSuccess ? null : new Date(),
        errorMessage,
      })
      .returning();

    // 2. Update Booking Status to CONFIRMED
    const oldStatus = booking.bookingStatus;
    const newStatus = isSuccess ? 'CONFIRMED' : 'PAYMENT_FAILED';
    const newPaymentStatus = isSuccess ? 'PAID' : 'FAILED';

    const [updatedBooking] = await this.db
      .update(bookings)
      .set({
        paymentStatus: newPaymentStatus as any,
        bookingStatus: newStatus as any,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id))
      .returning();

    // 3. Log Status History
    await this.db.insert(bookingStatusHistory).values({
      bookingId: booking.id,
      oldStatus: oldStatus as any,
      newStatus: newStatus as any,
      changedByUserId: userId,
      reason: isSuccess
        ? `Payment of ${booking.currency} ${booking.totalPrice} processed successfully via ${provider}. Transaction ID: ${providerPaymentId}`
        : `Payment failed via ${provider}. Reason: ${errorMessage || 'Payment authorization failed'}.`,
    });

    if (!isSuccess) {
      throw new BadRequestException(
        errorMessage || 'Payment authorization failed. Please check your card details and try again.',
      );
    }

    // 4. Auto-assign a driver immediately after successful payment
    let autoAssignment: { assigned: boolean; message: string; assignment?: any } | null = null;
    if (isSuccess) {
      autoAssignment = await this.driverAssignmentService.autoAssignDriver(booking.id);
    }

    return {
      success: isSuccess,
      payment: paymentRecord,
      booking: updatedBooking,
      autoAssignment,
      message: isSuccess
        ? autoAssignment?.assigned
          ? `Payment confirmed and driver auto-assigned. ${autoAssignment.message}`
          : `Payment confirmed. ${autoAssignment?.message ?? 'Awaiting driver dispatch.'}`
        : 'Payment could not be processed.',
    };
  }

  /**
   * Get payment details for a booking
   */
  async getBookingPayments(bookingId: number) {
    return this.db
      .select()
      .from(payments)
      .where(eq(payments.bookingId, bookingId));
  }
}
