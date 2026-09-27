import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../database';
import type { DrizzleDb } from '../../database';
import {
  bookings,
  payments,
  bookingStatusHistory,
} from '../../database/schema';
import { ProcessPaymentDto } from '../dto';

@Injectable()
export class PaymentService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  /**
   * Process payment for a booking
   */
  async processPayment(
    bookingId: number,
    userId: number,
    dto: ProcessPaymentDto,
  ) {
    const [booking] = await this.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found.`);
    }

    if (booking.customerId !== userId) {
      throw new BadRequestException(
        'You are not authorized to process payment for this booking.',
      );
    }

    if (booking.paymentStatus === 'PAID') {
      throw new BadRequestException('This booking has already been paid.');
    }

    const provider = dto.provider || 'MOCK';
    const isMock = provider === 'MOCK';
    const isSuccess = isMock ? (dto.mockSuccess !== false) : true;

    const providerPaymentId = isMock
      ? `mock_pay_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      : dto.paymentMethodId || `pay_${Date.now()}`;

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
        errorMessage: isSuccess ? null : 'Simulated payment failure / decline',
      })
      .returning();

    // 2. Update Booking Status
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
        : `Payment failed via ${provider}. Reason: Simulated decline.`,
    });

    return {
      success: isSuccess,
      payment: paymentRecord,
      booking: updatedBooking,
      message: isSuccess
        ? 'Payment authorized and booking confirmed.'
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
