import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../../database';
import type { DrizzleDb } from '../../database';
import {
  bookings,
  bookingAssignments,
  drivers,
  rides,
  bookingStatusHistory,
} from '../../database/schema';
import { DriverActionDto } from '../dto';
import { StripeService } from '../payment/stripe.service';

@Injectable()
export class RideService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly stripeService: StripeService,
  ) {}

  /**
   * Helper to resolve driver record from User ID
   */
  private async getDriverByUserId(userId: number) {
    const [driver] = await this.db
      .select()
      .from(drivers)
      .where(eq(drivers.userId, userId));

    if (!driver) {
      throw new ForbiddenException('Driver profile not found for this account.');
    }
    return driver;
  }

  /**
   * 1. Driver Accept Assignment
   */
  async acceptBooking(userId: number, bookingId: number) {
    const driver = await this.getDriverByUserId(userId);

    const [assignment] = await this.db
      .select()
      .from(bookingAssignments)
      .where(
        and(
          eq(bookingAssignments.bookingId, bookingId),
          eq(bookingAssignments.driverId, driver.id),
          eq(bookingAssignments.status, 'ASSIGNED'),
        ),
      );

    if (!assignment) {
      throw new BadRequestException('No active assignment pending for you on this booking.');
    }

    const [booking] = await this.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!booking) {
      throw new NotFoundException(`Booking #${bookingId} not found.`);
    }

    // Update assignment to ACCEPTED
    await this.db
      .update(bookingAssignments)
      .set({
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bookingAssignments.id, assignment.id));

    // Update booking status to DRIVER_ASSIGNED
    const oldStatus = booking.bookingStatus;
    const newStatus = 'DRIVER_ASSIGNED';

    await this.db
      .update(bookings)
      .set({
        bookingStatus: newStatus as any,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId));

    // Create or update Ride execution entry
    const existingRide = await this.db
      .select()
      .from(rides)
      .where(eq(rides.bookingId, bookingId));

    if (!existingRide.length) {
      await this.db.insert(rides).values({
        bookingId,
        driverId: driver.id,
        vehicleId: assignment.vehicleId,
        status: 'SCHEDULED',
      });
    }

    // Audit status history
    await this.db.insert(bookingStatusHistory).values({
      bookingId,
      oldStatus: oldStatus as any,
      newStatus: newStatus as any,
      changedByUserId: userId,
      reason: `Driver #${driver.id} accepted the booking assignment.`,
    });

    return {
      success: true,
      message: 'Booking accepted successfully.',
      status: newStatus,
    };
  }

  /**
   * 2. Driver Reject Assignment
   */
  async rejectBooking(userId: number, bookingId: number, dto: DriverActionDto) {
    const driver = await this.getDriverByUserId(userId);

    const [assignment] = await this.db
      .select()
      .from(bookingAssignments)
      .where(
        and(
          eq(bookingAssignments.bookingId, bookingId),
          eq(bookingAssignments.driverId, driver.id),
          eq(bookingAssignments.status, 'ASSIGNED'),
        ),
      );

    if (!assignment) {
      throw new BadRequestException('No pending assignment found to reject.');
    }

    const [booking] = await this.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    // Update assignment to REJECTED
    await this.db
      .update(bookingAssignments)
      .set({
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: dto.reason || 'Declined by driver',
        updatedAt: new Date(),
      })
      .where(eq(bookingAssignments.id, assignment.id));

    // Update booking status back to DRIVER_ASSIGNMENT_PENDING
    const oldStatus = booking.bookingStatus;
    const newStatus = 'DRIVER_ASSIGNMENT_PENDING';

    await this.db
      .update(bookings)
      .set({
        bookingStatus: newStatus as any,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId));

    // Audit status history
    await this.db.insert(bookingStatusHistory).values({
      bookingId,
      oldStatus: oldStatus as any,
      newStatus: newStatus as any,
      changedByUserId: userId,
      reason: `Driver #${driver.id} rejected assignment. Reason: ${dto.reason || 'None specified'}.`,
    });

    return {
      success: true,
      message: 'Assignment rejected. Returned to dispatch pool.',
      status: newStatus,
    };
  }

  /**
   * 3. Driver En Route to Pickup
   */
  async driverEnRoute(userId: number, bookingId: number) {
    const driver = await this.getDriverByUserId(userId);

    const [booking] = await this.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!booking) {
      throw new NotFoundException(`Booking #${bookingId} not found.`);
    }

    if (booking.bookingStatus !== 'DRIVER_ASSIGNED') {
      throw new BadRequestException(
        `Cannot start journey: booking status is ${booking.bookingStatus} (expected DRIVER_ASSIGNED).`,
      );
    }

    const oldStatus = booking.bookingStatus;
    const newStatus = 'DRIVER_EN_ROUTE';

    await this.db
      .update(bookings)
      .set({
        bookingStatus: newStatus as any,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId));

    await this.db
      .update(rides)
      .set({
        enRouteAt: new Date(),
        status: 'EN_ROUTE',
        updatedAt: new Date(),
      })
      .where(eq(rides.bookingId, bookingId));

    await this.db.insert(bookingStatusHistory).values({
      bookingId,
      oldStatus: oldStatus as any,
      newStatus: newStatus as any,
      changedByUserId: userId,
      reason: `Chauffeur en route to pickup location.`,
    });

    return {
      success: true,
      message: 'Status updated to Driver En Route.',
      status: newStatus,
    };
  }

  /**
   * 4. Driver Arrived at Pickup Location
   */
  async driverArrived(userId: number, bookingId: number) {
    const driver = await this.getDriverByUserId(userId);

    const [booking] = await this.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!booking) {
      throw new NotFoundException(`Booking #${bookingId} not found.`);
    }

    if (booking.bookingStatus !== 'DRIVER_EN_ROUTE') {
      throw new BadRequestException(
        `Cannot mark arrived: booking status is ${booking.bookingStatus} (expected DRIVER_EN_ROUTE).`,
      );
    }

    const oldStatus = booking.bookingStatus;
    const newStatus = 'DRIVER_ARRIVED';

    await this.db
      .update(bookings)
      .set({
        bookingStatus: newStatus as any,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId));

    await this.db
      .update(rides)
      .set({
        arrivedAt: new Date(),
        status: 'ARRIVED',
        updatedAt: new Date(),
      })
      .where(eq(rides.bookingId, bookingId));

    await this.db.insert(bookingStatusHistory).values({
      bookingId,
      oldStatus: oldStatus as any,
      newStatus: newStatus as any,
      changedByUserId: userId,
      reason: `Chauffeur arrived on site at pickup location.`,
    });

    return {
      success: true,
      message: 'Status updated to Driver Arrived.',
      status: newStatus,
    };
  }

  /**
   * 5. Start Ride (Passenger on board)
   */
  async startRide(userId: number, bookingId: number) {
    const driver = await this.getDriverByUserId(userId);

    const [booking] = await this.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!booking) {
      throw new NotFoundException(`Booking #${bookingId} not found.`);
    }

    if (booking.bookingStatus !== 'DRIVER_ARRIVED') {
      throw new BadRequestException(
        `Cannot start ride: booking status is ${booking.bookingStatus} (expected DRIVER_ARRIVED).`,
      );
    }

    const oldStatus = booking.bookingStatus;
    const newStatus = 'IN_PROGRESS';

    await this.db
      .update(bookings)
      .set({
        bookingStatus: newStatus as any,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId));

    await this.db
      .update(rides)
      .set({
        startedAt: new Date(),
        status: 'IN_PROGRESS',
        updatedAt: new Date(),
      })
      .where(eq(rides.bookingId, bookingId));

    // Update driver availability to BUSY
    await this.db
      .update(drivers)
      .set({
        availabilityStatus: 'BUSY',
        updatedAt: new Date(),
      })
      .where(eq(drivers.id, driver.id));

    await this.db.insert(bookingStatusHistory).values({
      bookingId,
      oldStatus: oldStatus as any,
      newStatus: newStatus as any,
      changedByUserId: userId,
      reason: `Passenger boarded. Ride started.`,
    });

    return {
      success: true,
      message: 'Ride started. Passenger on board.',
      status: newStatus,
    };
  }

  /**
   * 6. Complete Ride
   */
  async completeRide(userId: number, bookingId: number, dto: DriverActionDto) {
    const driver = await this.getDriverByUserId(userId);

    const [booking] = await this.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!booking) {
      throw new NotFoundException(`Booking #${bookingId} not found.`);
    }

    if (booking.bookingStatus !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Cannot complete ride: booking status is ${booking.bookingStatus} (expected IN_PROGRESS).`,
      );
    }

    const oldStatus = booking.bookingStatus;
    const newStatus = 'COMPLETED';

    await this.db
      .update(bookings)
      .set({
        bookingStatus: newStatus as any,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId));

    // Mark assignment completed
    await this.db
      .update(bookingAssignments)
      .set({
        status: 'COMPLETED',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bookingAssignments.bookingId, bookingId),
          eq(bookingAssignments.driverId, driver.id),
        ),
      );

    // Update ride metrics
    await this.db
      .update(rides)
      .set({
        completedAt: new Date(),
        status: 'COMPLETED',
        actualDistanceMeters: dto.actualDistanceMeters || booking.distanceMeters,
        actualDurationSeconds: dto.actualDurationSeconds || booking.estimatedDurationSeconds,
        updatedAt: new Date(),
      })
      .where(eq(rides.bookingId, bookingId));

    // Reset driver availability to AVAILABLE
    await this.db
      .update(drivers)
      .set({
        availabilityStatus: 'AVAILABLE',
        updatedAt: new Date(),
      })
      .where(eq(drivers.id, driver.id));

    await this.db.insert(bookingStatusHistory).values({
      bookingId,
      oldStatus: oldStatus as any,
      newStatus: newStatus as any,
      changedByUserId: userId,
      reason: `Ride completed successfully. Destination reached.`,
    });

    // Automatically calculate & distribute driver earnings (80% payout) via Stripe
    let payoutResult: any = null;
    try {
      payoutResult = await this.stripeService.processRideDriverPayout(
        bookingId,
        driver.id,
      );
    } catch (payoutErr: any) {
      // Payout errors logged inside StripeService
    }

    return {
      success: true,
      message: 'Ride completed successfully.',
      status: newStatus,
      payout: payoutResult,
    };
  }

  /**
   * 7. Report No-Show
   */
  async reportNoShow(userId: number, bookingId: number, dto: DriverActionDto) {
    const driver = await this.getDriverByUserId(userId);

    const [booking] = await this.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!booking) {
      throw new NotFoundException(`Booking #${bookingId} not found.`);
    }

    if (booking.bookingStatus !== 'DRIVER_ARRIVED') {
      throw new BadRequestException(
        `No-show can only be reported after arriving on site (expected DRIVER_ARRIVED).`,
      );
    }

    const oldStatus = booking.bookingStatus;
    const newStatus = 'NO_SHOW';

    await this.db
      .update(bookings)
      .set({
        bookingStatus: newStatus as any,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId));

    await this.db
      .update(rides)
      .set({
        status: 'NO_SHOW',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(rides.bookingId, bookingId));

    // Reset driver availability to AVAILABLE
    await this.db
      .update(drivers)
      .set({
        availabilityStatus: 'AVAILABLE',
        updatedAt: new Date(),
      })
      .where(eq(drivers.id, driver.id));

    await this.db.insert(bookingStatusHistory).values({
      bookingId,
      oldStatus: oldStatus as any,
      newStatus: newStatus as any,
      changedByUserId: userId,
      reason: `Passenger no-show reported by chauffeur. Reason: ${dto.reason || 'Passenger unreachable after wait threshold'}.`,
    });

    return {
      success: true,
      message: 'No-show recorded.',
      status: newStatus,
    };
  }
}
