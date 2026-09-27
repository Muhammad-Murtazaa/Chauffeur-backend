import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, desc, inArray, or } from 'drizzle-orm';
import { DRIZZLE } from '../../database';
import type { DrizzleDb } from '../../database';
import {
  bookings,
  bookingStops,
  quotes,
  quoteVehicleOptions,
  vehicleTypes,
  bookingAssignments,
  bookingStatusHistory,
  payments,
  rides,
  drivers,
  users,
  vehicles,
} from '../../database/schema';
import { CreateBookingDto, CancelBookingDto } from '../dto';

@Injectable()
export class BookingService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  /**
   * Helper to generate unique reference e.g. CH-20260927-A82K
   */
  private generateReferenceNumber(): string {
    const today = new Date();
    const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `CH-${yyyymmdd}-${randomHex}`;
  }

  /**
   * Helper to resolve driver record from User ID
   */
  private async getDriverByUserId(userId: number) {
    const [driver] = await this.db
      .select()
      .from(drivers)
      .where(eq(drivers.userId, userId));
    return driver || null;
  }

  /**
   * Create Booking from an active quote snapshot
   */
  async createBookingFromQuote(userId: number, dto: CreateBookingDto) {
    // 1. Fetch Quote
    const [quote] = await this.db
      .select()
      .from(quotes)
      .where(eq(quotes.id, dto.quoteId));

    if (!quote) {
      throw new NotFoundException(`Quote with ID #${dto.quoteId} not found.`);
    }

    if (new Date(quote.expiresAt).getTime() < Date.now()) {
      throw new BadRequestException(
        'This quote has expired. Please calculate a fresh quote.',
      );
    }

    // 2. Fetch Selected Vehicle Option
    const [selectedOption] = await this.db
      .select()
      .from(quoteVehicleOptions)
      .where(
        and(
          eq(quoteVehicleOptions.quoteId, dto.quoteId),
          eq(quoteVehicleOptions.vehicleTypeId, dto.vehicleTypeId),
        ),
      );

    if (!selectedOption) {
      throw new BadRequestException(
        'Selected vehicle category does not match this quote.',
      );
    }

    const referenceNumber = this.generateReferenceNumber();

    // 3. Create Booking Record
    const [insertedBooking] = await this.db
      .insert(bookings)
      .values({
        referenceNumber,
        customerId: userId,
        quoteId: quote.id,
        bookingType: quote.bookingType,
        vehicleTypeId: selectedOption.vehicleTypeId,
        pickupAt: quote.pickupAt,
        passengerCount: quote.passengerCount,
        luggageCount: quote.luggageCount,
        passengerName: dto.passengerName,
        passengerPhone: dto.passengerPhone,
        passengerEmail: dto.passengerEmail,
        flightNumber: dto.flightNumber || null,
        specialInstructions: dto.specialInstructions || null,
        distanceMeters: quote.distanceMeters,
        estimatedDurationSeconds: quote.durationSeconds,
        subtotal: selectedOption.basePrice,
        surcharges: selectedOption.surcharges,
        discount: selectedOption.discount,
        tax: selectedOption.tax,
        totalPrice: selectedOption.totalPrice,
        currency: quote.currency,
        paymentStatus: 'PENDING',
        bookingStatus: 'PENDING_PAYMENT',
      })
      .returning();

    // 4. Create Pickup & Dropoff Stops
    await this.db.insert(bookingStops).values([
      {
        bookingId: insertedBooking.id,
        type: 'PICKUP',
        placeId: quote.pickupPlaceId,
        address: quote.pickupAddress,
        latitude: quote.pickupLat,
        longitude: quote.pickupLng,
        sequence: 0,
        estimatedArrival: quote.pickupAt,
      },
      {
        bookingId: insertedBooking.id,
        type: 'DROPOFF',
        placeId: quote.dropoffPlaceId,
        address: quote.dropoffAddress || 'As Directed',
        latitude: quote.dropoffLat,
        longitude: quote.dropoffLng,
        sequence: 1,
        estimatedArrival: new Date(
          new Date(quote.pickupAt).getTime() + quote.durationSeconds * 1000,
        ),
      },
    ]);

    // 5. Audit Log Initial Booking Status
    await this.db.insert(bookingStatusHistory).values({
      bookingId: insertedBooking.id,
      oldStatus: null,
      newStatus: 'PENDING_PAYMENT',
      changedByUserId: userId,
      reason: `Booking initialized with reference ${referenceNumber} via quote #${quote.id}.`,
    });

    return this.getBookingDetails(insertedBooking.id, { id: userId, role: 'CUSTOMER' });
  }

  /**
   * Get complete details of a single booking
   */
  async getBookingDetails(bookingId: number, user: { id: number; role: string }) {
    const [booking] = await this.db
      .select({
        id: bookings.id,
        referenceNumber: bookings.referenceNumber,
        customerId: bookings.customerId,
        quoteId: bookings.quoteId,
        bookingType: bookings.bookingType,
        vehicleTypeId: bookings.vehicleTypeId,
        pickupAt: bookings.pickupAt,
        passengerCount: bookings.passengerCount,
        luggageCount: bookings.luggageCount,
        passengerName: bookings.passengerName,
        passengerPhone: bookings.passengerPhone,
        passengerEmail: bookings.passengerEmail,
        flightNumber: bookings.flightNumber,
        specialInstructions: bookings.specialInstructions,
        distanceMeters: bookings.distanceMeters,
        estimatedDurationSeconds: bookings.estimatedDurationSeconds,
        subtotal: bookings.subtotal,
        surcharges: bookings.surcharges,
        discount: bookings.discount,
        tax: bookings.tax,
        totalPrice: bookings.totalPrice,
        currency: bookings.currency,
        paymentStatus: bookings.paymentStatus,
        bookingStatus: bookings.bookingStatus,
        cancelledBy: bookings.cancelledBy,
        cancelledAt: bookings.cancelledAt,
        cancellationReason: bookings.cancellationReason,
        cancellationFee: bookings.cancellationFee,
        createdAt: bookings.createdAt,
        updatedAt: bookings.updatedAt,
        vehicleCategory: vehicleTypes.category,
        vehicleTypeName: vehicleTypes.name,
        vehicleImageUrl: vehicleTypes.imageUrl,
      })
      .from(bookings)
      .leftJoin(vehicleTypes, eq(bookings.vehicleTypeId, vehicleTypes.id))
      .where(eq(bookings.id, bookingId));

    if (!booking) {
      throw new NotFoundException(`Booking with ID #${bookingId} not found.`);
    }

    // Access Control
    if (user.role === 'CUSTOMER' && booking.customerId !== user.id) {
      throw new ForbiddenException('Access denied to this reservation.');
    }

    // Fetch Stops
    const stops = await this.db
      .select()
      .from(bookingStops)
      .where(eq(bookingStops.bookingId, bookingId))
      .orderBy(bookingStops.sequence);

    // Fetch Assignments & Assigned Driver
    const assignments = await this.db
      .select({
        id: bookingAssignments.id,
        status: bookingAssignments.status,
        assignedAt: bookingAssignments.assignedAt,
        acceptedAt: bookingAssignments.acceptedAt,
        driverId: drivers.id,
        driverFirstName: users.firstName,
        driverLastName: users.lastName,
        driverPhone: users.phone,
        driverProfileImage: drivers.profileImageUrl,
        vehicleMake: vehicles.make,
        vehicleModel: vehicles.model,
        vehicleYear: vehicles.year,
        vehicleColor: vehicles.color,
        vehicleRegistration: vehicles.registrationNumber,
      })
      .from(bookingAssignments)
      .leftJoin(drivers, eq(bookingAssignments.driverId, drivers.id))
      .leftJoin(users, eq(drivers.userId, users.id))
      .leftJoin(vehicles, eq(bookingAssignments.vehicleId, vehicles.id))
      .where(eq(bookingAssignments.bookingId, bookingId))
      .orderBy(desc(bookingAssignments.createdAt));

    // Fetch Ride Execution Data
    const [ride] = await this.db
      .select()
      .from(rides)
      .where(eq(rides.bookingId, bookingId));

    // Fetch Payments
    const bookingPayments = await this.db
      .select()
      .from(payments)
      .where(eq(payments.bookingId, bookingId));

    // Fetch Status History
    const statusHistory = await this.db
      .select()
      .from(bookingStatusHistory)
      .where(eq(bookingStatusHistory.bookingId, bookingId))
      .orderBy(desc(bookingStatusHistory.createdAt));

    return {
      ...booking,
      stops,
      assignments,
      assignedDriver: assignments[0] || null,
      ride: ride || null,
      payments: bookingPayments,
      statusHistory,
    };
  }

  /**
   * Get all bookings for the logged-in customer
   */
  async getCustomerBookings(customerId: number) {
    const customerBookings = await this.db
      .select({
        id: bookings.id,
        referenceNumber: bookings.referenceNumber,
        bookingType: bookings.bookingType,
        pickupAt: bookings.pickupAt,
        passengerName: bookings.passengerName,
        passengerPhone: bookings.passengerPhone,
        passengerCount: bookings.passengerCount,
        luggageCount: bookings.luggageCount,
        distanceMeters: bookings.distanceMeters,
        estimatedDurationSeconds: bookings.estimatedDurationSeconds,
        totalPrice: bookings.totalPrice,
        currency: bookings.currency,
        paymentStatus: bookings.paymentStatus,
        bookingStatus: bookings.bookingStatus,
        createdAt: bookings.createdAt,
        vehicleCategory: vehicleTypes.category,
        vehicleTypeName: vehicleTypes.name,
      })
      .from(bookings)
      .leftJoin(vehicleTypes, eq(bookings.vehicleTypeId, vehicleTypes.id))
      .where(eq(bookings.customerId, customerId))
      .orderBy(desc(bookings.createdAt));

    // Attach pickup and dropoff addresses
    const enriched = await Promise.all(
      customerBookings.map(async (b) => {
        const stops = await this.db
          .select()
          .from(bookingStops)
          .where(eq(bookingStops.bookingId, b.id))
          .orderBy(bookingStops.sequence);
        const pickupStop = stops.find((s) => s.type === 'PICKUP') || stops[0];
        const dropoffStop = stops.find((s) => s.type === 'DROPOFF') || stops[stops.length - 1];

        return {
          ...b,
          pickupAddress: pickupStop?.address || 'Pickup location',
          dropoffAddress: dropoffStop?.address || 'Dropoff location',
        };
      }),
    );

    return enriched;
  }

  /**
   * Get upcoming bookings for logged-in driver
   */
  async getDriverUpcomingBookings(userId: number) {
    const driver = await this.getDriverByUserId(userId);
    if (!driver) return { bookings: [], total: 0 };

    const upcomingAssignments = await this.db
      .select({
        assignmentId: bookingAssignments.id,
        assignmentStatus: bookingAssignments.status,
        bookingId: bookings.id,
        referenceNumber: bookings.referenceNumber,
        bookingType: bookings.bookingType,
        pickupAt: bookings.pickupAt,
        passengerName: bookings.passengerName,
        passengerPhone: bookings.passengerPhone,
        passengerCount: bookings.passengerCount,
        luggageCount: bookings.luggageCount,
        flightNumber: bookings.flightNumber,
        specialInstructions: bookings.specialInstructions,
        distanceMeters: bookings.distanceMeters,
        estimatedDurationSeconds: bookings.estimatedDurationSeconds,
        totalPrice: bookings.totalPrice,
        currency: bookings.currency,
        bookingStatus: bookings.bookingStatus,
        vehicleCategory: vehicleTypes.category,
        vehicleTypeName: vehicleTypes.name,
      })
      .from(bookingAssignments)
      .innerJoin(bookings, eq(bookingAssignments.bookingId, bookings.id))
      .leftJoin(vehicleTypes, eq(bookings.vehicleTypeId, vehicleTypes.id))
      .where(
        and(
          eq(bookingAssignments.driverId, driver.id),
          inArray(bookingAssignments.status, ['ASSIGNED', 'ACCEPTED']),
          inArray(bookings.bookingStatus, [
            'DRIVER_ASSIGNMENT_PENDING',
            'DRIVER_ASSIGNED',
          ]),
        ),
      )
      .orderBy(bookings.pickupAt);

    const enriched = await Promise.all(
      upcomingAssignments.map(async (b) => {
        const stops = await this.db
          .select()
          .from(bookingStops)
          .where(eq(bookingStops.bookingId, b.bookingId))
          .orderBy(bookingStops.sequence);
        const pickupStop = stops.find((s) => s.type === 'PICKUP') || stops[0];
        const dropoffStop = stops.find((s) => s.type === 'DROPOFF') || stops[stops.length - 1];

        return {
          ...b,
          pickupAddress: pickupStop?.address || 'Pickup location',
          dropoffAddress: dropoffStop?.address || 'Dropoff location',
        };
      }),
    );

    return {
      bookings: enriched,
      total: enriched.length,
    };
  }

  /**
   * Get current active ride assignment for driver
   */
  async getDriverActiveBooking(userId: number) {
    const driver = await this.getDriverByUserId(userId);
    if (!driver) return { activeRide: null, message: 'Driver profile not found.' };

    const [activeAssignment] = await this.db
      .select({
        assignmentId: bookingAssignments.id,
        assignmentStatus: bookingAssignments.status,
        bookingId: bookings.id,
        referenceNumber: bookings.referenceNumber,
        bookingType: bookings.bookingType,
        pickupAt: bookings.pickupAt,
        passengerName: bookings.passengerName,
        passengerPhone: bookings.passengerPhone,
        passengerEmail: bookings.passengerEmail,
        passengerCount: bookings.passengerCount,
        luggageCount: bookings.luggageCount,
        flightNumber: bookings.flightNumber,
        specialInstructions: bookings.specialInstructions,
        distanceMeters: bookings.distanceMeters,
        estimatedDurationSeconds: bookings.estimatedDurationSeconds,
        totalPrice: bookings.totalPrice,
        currency: bookings.currency,
        bookingStatus: bookings.bookingStatus,
        vehicleCategory: vehicleTypes.category,
        vehicleTypeName: vehicleTypes.name,
      })
      .from(bookingAssignments)
      .innerJoin(bookings, eq(bookingAssignments.bookingId, bookings.id))
      .leftJoin(vehicleTypes, eq(bookings.vehicleTypeId, vehicleTypes.id))
      .where(
        and(
          eq(bookingAssignments.driverId, driver.id),
          inArray(bookings.bookingStatus, [
            'DRIVER_ASSIGNED',
            'DRIVER_EN_ROUTE',
            'DRIVER_ARRIVED',
            'IN_PROGRESS',
          ]),
        ),
      );

    if (!activeAssignment) {
      return {
        activeRide: null,
        message: 'No active ride assignment currently in progress.',
      };
    }

    const stops = await this.db
      .select()
      .from(bookingStops)
      .where(eq(bookingStops.bookingId, activeAssignment.bookingId))
      .orderBy(bookingStops.sequence);

    const [ride] = await this.db
      .select()
      .from(rides)
      .where(eq(rides.bookingId, activeAssignment.bookingId));

    const pickupStop = stops.find((s) => s.type === 'PICKUP') || stops[0];
    const dropoffStop = stops.find((s) => s.type === 'DROPOFF') || stops[stops.length - 1];

    return {
      activeRide: {
        ...activeAssignment,
        pickupAddress: pickupStop?.address || 'Pickup location',
        dropoffAddress: dropoffStop?.address || 'Dropoff location',
        stops,
        ride: ride || null,
      },
    };
  }

  /**
   * Get past booking history for driver
   */
  async getDriverBookingHistory(userId: number) {
    const driver = await this.getDriverByUserId(userId);
    if (!driver) return { history: [], total: 0 };

    const pastAssignments = await this.db
      .select({
        assignmentId: bookingAssignments.id,
        assignmentStatus: bookingAssignments.status,
        bookingId: bookings.id,
        referenceNumber: bookings.referenceNumber,
        bookingType: bookings.bookingType,
        pickupAt: bookings.pickupAt,
        passengerName: bookings.passengerName,
        passengerPhone: bookings.passengerPhone,
        totalPrice: bookings.totalPrice,
        currency: bookings.currency,
        bookingStatus: bookings.bookingStatus,
        createdAt: bookings.createdAt,
      })
      .from(bookingAssignments)
      .innerJoin(bookings, eq(bookingAssignments.bookingId, bookings.id))
      .where(
        and(
          eq(bookingAssignments.driverId, driver.id),
          inArray(bookings.bookingStatus, [
            'COMPLETED',
            'NO_SHOW',
            'CANCELLED',
          ]),
        ),
      )
      .orderBy(desc(bookings.pickupAt));

    const enriched = await Promise.all(
      pastAssignments.map(async (b) => {
        const stops = await this.db
          .select()
          .from(bookingStops)
          .where(eq(bookingStops.bookingId, b.bookingId))
          .orderBy(bookingStops.sequence);
        const pickupStop = stops.find((s) => s.type === 'PICKUP') || stops[0];
        const dropoffStop = stops.find((s) => s.type === 'DROPOFF') || stops[stops.length - 1];

        return {
          ...b,
          pickupAddress: pickupStop?.address || 'Pickup location',
          dropoffAddress: dropoffStop?.address || 'Dropoff location',
        };
      }),
    );

    return {
      history: enriched,
      total: enriched.length,
    };
  }

  /**
   * Cancel Booking with strict policy calculation
   */
  async cancelBooking(
    bookingId: number,
    user: { id: number; role: string },
    dto: CancelBookingDto,
  ) {
    const [booking] = await this.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!booking) {
      throw new NotFoundException(`Booking with ID #${bookingId} not found.`);
    }

    if (user.role === 'CUSTOMER' && booking.customerId !== user.id) {
      throw new ForbiddenException('You cannot cancel this booking.');
    }

    const nonCancellableStatuses = ['COMPLETED', 'NO_SHOW', 'CANCELLED'];
    if (nonCancellableStatuses.includes(booking.bookingStatus)) {
      throw new BadRequestException(
        `Booking cannot be cancelled in state ${booking.bookingStatus}.`,
      );
    }

    // Cancellation policy calculation
    const msUntilPickup = new Date(booking.pickupAt).getTime() - Date.now();
    const hoursUntilPickup = msUntilPickup / (1000 * 60 * 60);

    let cancellationFee = 0;
    const total = Number(booking.totalPrice);

    if (hoursUntilPickup > 24) {
      cancellationFee = 0; // Free cancellation
    } else if (hoursUntilPickup >= 6) {
      cancellationFee = Math.round(total * 0.2 * 100) / 100; // 20% cancellation fee
    } else {
      cancellationFee = total; // 100% cancellation fee within 6 hours
    }

    const oldStatus = booking.bookingStatus;
    const newStatus = 'CANCELLED';

    await this.db
      .update(bookings)
      .set({
        bookingStatus: newStatus as any,
        cancelledBy: user.role,
        cancelledAt: new Date(),
        cancellationReason: dto.reason,
        cancellationFee: String(cancellationFee),
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId));

    // Release driver if assigned
    await this.db
      .update(bookingAssignments)
      .set({
        status: 'CANCELLED',
        rejectionReason: `Booking cancelled by ${user.role}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bookingAssignments.bookingId, bookingId),
          inArray(bookingAssignments.status, ['ASSIGNED', 'ACCEPTED']),
        ),
      );

    // Audit status history
    await this.db.insert(bookingStatusHistory).values({
      bookingId,
      oldStatus: oldStatus as any,
      newStatus: newStatus as any,
      changedByUserId: user.id,
      reason: `Booking cancelled by ${user.role}. Reason: ${dto.reason}. Cancellation fee: $${cancellationFee}.`,
    });

    return {
      success: true,
      message: 'Booking cancelled successfully.',
      cancellationFee,
      refundAmount: Math.max(0, total - cancellationFee),
    };
  }
}
