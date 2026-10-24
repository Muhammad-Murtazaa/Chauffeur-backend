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
  stripeTransferId?: string | null;
  message: string;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe | null = null;
  private readonly driverRatePercent = 80.0; // 80% to driver, 20% platform commission

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (secretKey && !secretKey.includes('placeholder')) {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-02-24.acacia' as any,
      });
      this.logger.log('Stripe client initialized successfully.');
    } else {
      this.logger.warn(
        'STRIPE_SECRET_KEY not set or placeholder. Operating in simulated/test mode.',
      );
    }
  }

  /**
   * 1. Create a PaymentIntent for customer ride checkout
   */
  async createPaymentIntent(params: {
    amount: number; // In dollars e.g. 150.00
    currency?: string;
    bookingId?: number;
    customerEmail?: string;
    metadata?: Record<string, string>;
  }) {
    const amountInCents = Math.round(Number(params.amount) * 100);
    const currency = (params.currency || 'usd').toLowerCase();

    if (!this.stripe) {
      const mockId = `pi_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      return {
        clientSecret: `${mockId}_secret_test`,
        paymentIntentId: mockId,
        isMock: true,
        amount: params.amount,
        currency,
      };
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency,
        receipt_email: params.customerEmail,
        metadata: {
          bookingId: String(params.bookingId || ''),
          ...params.metadata,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        isMock: false,
        amount: params.amount,
        currency,
      };
    } catch (err: any) {
      this.logger.error(`Failed to create Stripe PaymentIntent: ${err.message}`);
      throw err;
    }
  }

  /**
   * 2. Generate a Stripe Connect Onboarding Link for a Driver
   */
  async createDriverConnectOnboardingLink(driverId: number, returnUrl: string) {
    const [driverRecord] = await this.db
      .select({
        driverId: drivers.id,
        stripeAccountId: drivers.stripeAccountId,
        userEmail: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(drivers)
      .innerJoin(users, eq(drivers.userId, users.id))
      .where(eq(drivers.id, driverId));

    if (!driverRecord) {
      throw new Error(`Driver #${driverId} not found.`);
    }

    if (!this.stripe) {
      return {
        url: `${returnUrl}?connect=simulated_success&account=acct_mock_${driverId}`,
        accountId: `acct_mock_${driverId}`,
        isMock: true,
      };
    }

    let accountId = driverRecord.stripeAccountId;

    // Create new express account if driver doesn't have one
    if (!accountId) {
      const account = await this.stripe.accounts.create({
        type: 'express',
        email: driverRecord.userEmail,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: 'individual',
        individual: {
          first_name: driverRecord.firstName,
          last_name: driverRecord.lastName,
          email: driverRecord.userEmail,
        },
      });
      accountId = account.id;

      await this.db
        .update(drivers)
        .set({ stripeAccountId: accountId, updatedAt: new Date() })
        .where(eq(drivers.id, driverId));
    }

    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${returnUrl}?refresh=true`,
      return_url: `${returnUrl}?success=true`,
      type: 'account_onboarding',
    });

    return {
      url: accountLink.url,
      accountId,
      isMock: false,
    };
  }

  /**
   * 3. Process Driver Payout upon Ride Completion (80% driver share)
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
    let payoutStatus = 'PENDING'; // PENDING, PAID, FAILED

    // Attempt Stripe Transfer if Stripe is initialized and driver has connected account
    if (this.stripe && driverRecord?.stripeAccountId) {
      try {
        const transfer = await this.stripe.transfers.create({
          amount: Math.round(driverEarnings * 100), // in cents
          currency: currency.toLowerCase(),
          destination: driverRecord.stripeAccountId,
          description: `Chauffeur earnings for ride ${booking.referenceNumber}`,
          metadata: {
            bookingId: String(bookingId),
            driverId: String(driverId),
            totalFare: String(totalFare),
          },
        });
        stripeTransferId = transfer.id;
        payoutStatus = 'PAID';
        this.logger.log(
          `Stripe Transfer ${transfer.id} sent: $${driverEarnings} to driver #${driverId} (${driverRecord.stripeAccountId})`,
        );
      } catch (transferErr: any) {
        this.logger.error(
          `Stripe Connect transfer failed for driver #${driverId}: ${transferErr.message}`,
        );
        payoutStatus = 'FAILED';
      }
    } else {
      // In simulated mode or pending Stripe Connect setup, mark as PAID or PENDING
      if (!this.stripe) {
        stripeTransferId = `tr_simulated_${Date.now()}_${driverId}`;
        payoutStatus = 'PAID';
        this.logger.log(
          `[Simulated Driver Payout] $${driverEarnings} (80% of $${totalFare}) allocated to Driver #${driverId} (${driverRecord?.firstName || 'Chauffeur'})`,
        );
      } else {
        payoutStatus = 'PENDING'; // Awaiting driver Stripe onboarding
        this.logger.warn(
          `Driver #${driverId} has not connected a Stripe account. Payout of $${driverEarnings} logged as PENDING.`,
        );
      }
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
        stripeTransferId,
        transferredAt: payoutStatus === 'PAID' ? new Date() : null,
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
      stripeTransferId,
      message: `Driver payout of $${driverEarnings} (${this.driverRatePercent}% of $${totalFare}) processed successfully.`,
    };
  }

  /**
   * 4. Query driver earnings metrics for the Driver Portal Dashboard
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
