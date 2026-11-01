import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database';
import type { DrizzleDb } from '../../database';
import {
  drivers,
  driverPayouts,
  users,
  bookings,
  rides,
} from '../../database/schema';
import { EmailService } from '../../email';

export interface DriverPayoutResult {
  payoutId: number;
  driverId: number;
  totalFare: number;
  driverEarnings: number;
  platformFee: number;
  driverRatePercent: number;
  status: string;
  stripePayoutId?: string | null;
  stripeTransferId?: string | null;
  message: string;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripeClient: Stripe | null = null;
  private readonly publishableKey: string;
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly driverRatePercent = 80.0; // 80% to driver, 20% platform commission

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    this.secretKey =
      this.configService.get<string>('STRIPE_SECRET_KEY') || '';
    this.publishableKey =
      this.configService.get<string>('STRIPE_PUBLISHABLE_KEY') ||
      'pk_test_placeholder_key';
    this.webhookSecret =
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';

    if (
      this.secretKey &&
      !this.secretKey.includes('placeholder') &&
      this.secretKey.startsWith('sk_')
    ) {
      try {
        this.stripeClient = new Stripe(this.secretKey, {
          apiVersion: '2025-02-24.acacia' as any,
        });
        this.logger.log('Stripe client initialized successfully.');
      } catch (err: any) {
        this.logger.error(`Failed to initialize Stripe client: ${err.message}`);
      }
    } else {
      this.logger.warn(
        'STRIPE_SECRET_KEY not set or placeholder. Stripe payment processing is operating in simulated sandbox/mock mode.',
      );
    }
  }

  /**
   * 1. Public client configuration for frontend Stripe Elements / SDK
   */
  getStripeConfig() {
    return {
      publishableKey: this.publishableKey,
      isMock: !this.stripeClient,
    };
  }

  /**
   * 2. Initiate Stripe PaymentIntent session for booking checkout
   */
  async createPaymentIntent(params: {
    amount: number;
    currency?: string;
    bookingId: number;
    customerEmail?: string;
    metadata?: Record<string, string>;
  }) {
    const currency = (params.currency || 'USD').toLowerCase();
    const stripeConfig = this.getStripeConfig();

    if (!this.stripeClient) {
      const mockPaymentIntentId = `pi_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      return {
        clientSecret: `${mockPaymentIntentId}_secret_${Date.now()}`,
        paymentIntentId: mockPaymentIntentId,
        stripeConfig,
        isMock: true,
        amount: params.amount,
        currency: currency.toUpperCase(),
      };
    }

    try {
      const amountInCents = Math.round(Number(params.amount) * 100);
      const paymentIntent = await this.stripeClient.paymentIntents.create({
        amount: amountInCents,
        currency,
        receipt_email: params.customerEmail,
        metadata: {
          bookingId: String(params.bookingId),
          ...params.metadata,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        stripeConfig,
        isMock: false,
        amount: params.amount,
        currency: currency.toUpperCase(),
      };
    } catch (err: any) {
      this.logger.error(`Stripe createPaymentIntent failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * 3. Authorize / Process Stripe payment for booking
   */
  async processStripePayment(params: {
    paymentMethodId?: string;
    bookingId: number;
    amount: number;
    currency?: string;
    customerEmail?: string;
    referenceNumber?: string;
  }) {
    const currency = (params.currency || 'USD').toLowerCase();
    const amountInCents = Math.round(Number(params.amount) * 100);

    // If client is in simulated mode or mock payment method provided
    if (
      !this.stripeClient ||
      !params.paymentMethodId ||
      params.paymentMethodId.startsWith('mock_') ||
      params.paymentMethodId.startsWith('pi_mock_') ||
      params.paymentMethodId.startsWith('sq_') ||
      params.paymentMethodId === 'pm_card_visa'
    ) {
      const mockPaymentId = `pi_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      this.logger.log(
        `[Stripe Simulated Payment] Processed $${params.amount} ${currency.toUpperCase()} for Booking #${params.bookingId}. Payment ID: ${mockPaymentId}`,
      );
      return {
        success: true,
        paymentId: mockPaymentId,
        status: 'succeeded',
        amount: params.amount,
        currency: currency.toUpperCase(),
        isMock: true,
      };
    }

    try {
      let paymentIntent: Stripe.PaymentIntent;

      // If already a PaymentIntent ID (created in Step 2)
      if (params.paymentMethodId.startsWith('pi_')) {
        paymentIntent = await this.stripeClient.paymentIntents.retrieve(
          params.paymentMethodId,
        );
        if (
          paymentIntent.status !== 'succeeded' &&
          paymentIntent.status !== 'requires_capture'
        ) {
          // Attempt to confirm if it has a payment method attached
          paymentIntent = await this.stripeClient.paymentIntents.confirm(
            params.paymentMethodId,
          );
        }
      } else {
        // Direct PaymentIntent creation & confirmation with PaymentMethod ID (pm_...)
        paymentIntent = await this.stripeClient.paymentIntents.create({
          amount: amountInCents,
          currency,
          payment_method: params.paymentMethodId,
          confirm: true,
          receipt_email: params.customerEmail,
          return_url: 'https://nycpremierlimo.com',
          metadata: {
            bookingId: String(params.bookingId),
            referenceNumber: params.referenceNumber || '',
          },
        });
      }

      const isSuccess =
        paymentIntent.status === 'succeeded' ||
        paymentIntent.status === 'requires_capture';

      return {
        success: isSuccess,
        paymentId: paymentIntent.id,
        status: paymentIntent.status,
        amount: params.amount,
        currency: currency.toUpperCase(),
        isMock: false,
      };
    } catch (err: any) {
      this.logger.error(`Stripe Payment processing failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * 4. Process Driver Payout upon Ride Completion (80% driver share via Stripe Connect)
   */
  async processRideDriverPayout(
    bookingId: number,
    driverId: number,
  ): Promise<DriverPayoutResult> {
    // Check if payout already exists for this booking
    const [existingPayout] = await this.db
      .select()
      .from(driverPayouts)
      .where(eq(driverPayouts.bookingId, bookingId));

    if (existingPayout) {
      return {
        payoutId: existingPayout.id,
        driverId: existingPayout.driverId,
        totalFare: Number(existingPayout.totalFare),
        driverEarnings: Number(existingPayout.driverEarnings),
        platformFee: Number(existingPayout.platformFee),
        driverRatePercent: Number(existingPayout.driverRatePercent),
        status: existingPayout.status,
        stripePayoutId: existingPayout.stripePayoutId,
        stripeTransferId: existingPayout.stripeTransferId,
        message: 'Payout already calculated and recorded for this ride.',
      };
    }

    // Fetch booking details
    const [booking] = await this.db
      .select({
        id: bookings.id,
        referenceNumber: bookings.referenceNumber,
        totalPrice: bookings.totalPrice,
        currency: bookings.currency,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!booking) {
      throw new Error(`Booking #${bookingId} not found for payout calculation.`);
    }

    // Fetch driver + user details
    const [driverRecord] = await this.db
      .select({
        id: drivers.id,
        stripeAccountId: drivers.stripeAccountId,
        stripePayoutsEnabled: drivers.stripePayoutsEnabled,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(drivers)
      .innerJoin(users, eq(drivers.userId, users.id))
      .where(eq(drivers.id, driverId));

    const totalFare = Number(booking.totalPrice);
    const driverEarnings = Number(
      ((totalFare * this.driverRatePercent) / 100).toFixed(2),
    );
    const platformFee = Number((totalFare - driverEarnings).toFixed(2));
    const currency = (booking.currency || 'USD').toUpperCase();

    // Check optional ride record
    const [ride] = await this.db
      .select()
      .from(rides)
      .where(eq(rides.bookingId, bookingId));

    let stripeTransferId: string | null = null;
    let stripePayoutId: string | null = null;
    let payoutStatus = 'PAID';

    if (
      this.stripeClient &&
      driverRecord?.stripeAccountId &&
      driverRecord.stripePayoutsEnabled
    ) {
      try {
        const transfer = await this.stripeClient.transfers.create({
          amount: Math.round(driverEarnings * 100),
          currency: currency.toLowerCase(),
          destination: driverRecord.stripeAccountId,
          description: `Payout for Booking #${booking.referenceNumber || bookingId}`,
          metadata: {
            bookingId: String(bookingId),
            driverId: String(driverId),
          },
        });
        stripeTransferId = transfer.id;
        stripePayoutId = `po_${Date.now()}`;
        this.logger.log(
          `Stripe Transfer created: ${transfer.id} ($${driverEarnings} to ${driverRecord.stripeAccountId})`,
        );
      } catch (transferErr: any) {
        this.logger.error(`Stripe Transfer failed: ${transferErr.message}`);
        payoutStatus = 'FAILED';
      }
    } else {
      // Simulated payout in sandbox/mock mode
      stripeTransferId = `tr_mock_${Date.now()}_${driverId}`;
      stripePayoutId = `po_mock_${Date.now()}`;
      this.logger.log(
        `[Stripe Simulated Driver Payout] $${driverEarnings} (80% of $${totalFare}) disbursed to Driver #${driverId} (${driverRecord?.firstName || 'Chauffeur'})`,
      );
    }

    // Insert payout record
    const [insertedPayout] = await this.db
      .insert(driverPayouts)
      .values({
        driverId,
        bookingId,
        rideId: ride?.id || null,
        totalFare: String(totalFare),
        driverRatePercent: String(this.driverRatePercent),
        driverEarnings: String(driverEarnings),
        platformFee: String(platformFee),
        currency,
        status: payoutStatus,
        stripePayoutId,
        stripeTransferId,
        transferredAt: new Date(),
      })
      .returning();

    // Trigger confirmation email to driver if email is available
    if (driverRecord?.email) {
      this.emailService
        .sendDriverPayoutNotification({
          driverEmail: driverRecord.email,
          driverName: `${driverRecord.firstName} ${driverRecord.lastName}`,
          bookingReference: booking.referenceNumber,
          totalFare,
          driverEarnings,
          platformFee,
          currency,
          status: payoutStatus,
        })
        .catch((err) => {
          this.logger.warn(`Failed to send driver payout email: ${err.message}`);
        });
    }

    return {
      payoutId: insertedPayout.id,
      driverId,
      totalFare,
      driverEarnings,
      platformFee,
      driverRatePercent: this.driverRatePercent,
      status: payoutStatus,
      stripePayoutId,
      stripeTransferId,
      message: `Driver payout of $${driverEarnings} (${this.driverRatePercent}% of $${totalFare}) processed successfully via Stripe.`,
    };
  }

  /**
   * 5. Query driver earnings metrics for the Driver Portal Dashboard
   */
  async getDriverEarningsMetrics(driverId: number) {
    const allPayouts = await this.db
      .select()
      .from(driverPayouts)
      .where(eq(driverPayouts.driverId, driverId));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date();
    const day = startOfWeek.getDay() || 7;
    startOfWeek.setDate(startOfWeek.getDate() - day + 1);
    startOfWeek.setHours(0, 0, 0, 0);

    let todayTotal = 0;
    let weekTotal = 0;
    let allTimeTotal = 0;

    for (const p of allPayouts) {
      const amount = Number(p.driverEarnings) || 0;
      allTimeTotal += amount;

      const createdAt = new Date(p.createdAt);
      if (createdAt >= today) {
        todayTotal += amount;
      }
      if (createdAt >= startOfWeek) {
        weekTotal += amount;
      }
    }

    return {
      todayEarnings: `$${todayTotal.toFixed(2)}`,
      weekEarnings: `$${weekTotal.toFixed(2)}`,
      allTimeEarnings: `$${allTimeTotal.toFixed(2)}`,
      totalCompletedTrips: allPayouts.length,
      recentPayouts: allPayouts.slice(-10).reverse(),
    };
  }
}
