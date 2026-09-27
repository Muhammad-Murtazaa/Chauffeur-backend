import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { eq, and, or, inArray, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database';
import type { DrizzleDb } from '../../database';
import {
  bookings,
  bookingAssignments,
  drivers,
  users,
  vehicles,
  vehicleTypes,
  bookingStatusHistory,
} from '../../database/schema';

@Injectable()
export class DriverAssignmentService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  /**
   * Get all unassigned or pending-assignment bookings for Admin Dispatch
   */
  async getUnassignedBookings() {
    return this.db
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
        vehicleTypeCategory: vehicleTypes.category,
        vehicleTypeName: vehicleTypes.name,
      })
      .from(bookings)
      .leftJoin(vehicleTypes, eq(bookings.vehicleTypeId, vehicleTypes.id))
      .where(
        inArray(bookings.bookingStatus, [
          'CONFIRMED',
          'DRIVER_ASSIGNMENT_PENDING',
        ]),
      )
      .orderBy(bookings.pickupAt);
  }

  /**
   * Find eligible drivers matching booking category with buffer conflict checks
   */
  async getEligibleDriversForBooking(bookingId: number) {
    const [booking] = await this.db
      .select({
        id: bookings.id,
        pickupAt: bookings.pickupAt,
        estimatedDurationSeconds: bookings.estimatedDurationSeconds,
        vehicleTypeId: bookings.vehicleTypeId,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found.`);
    }

    const [vType] = await this.db
      .select()
      .from(vehicleTypes)
      .where(eq(vehicleTypes.id, booking.vehicleTypeId));

    if (!vType) {
      throw new NotFoundException('Vehicle type for this booking not found.');
    }

    // 1. Query drivers with active status, approved verification, and approved vehicle
    const candidates = await this.db
      .select({
        driverId: drivers.id,
        userId: drivers.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        driverStatus: drivers.status,
        verificationStatus: drivers.verificationStatus,
        availabilityStatus: drivers.availabilityStatus,
        yearsOfExperience: drivers.yearsOfExperience,
        profileImageUrl: drivers.profileImageUrl,
        vehicleId: vehicles.id,
        vehicleMake: vehicles.make,
        vehicleModel: vehicles.model,
        vehicleYear: vehicles.year,
        vehicleColor: vehicles.color,
        vehicleReg: vehicles.registrationNumber,
        vehicleCategory: vehicles.category,
        vehicleStatus: vehicles.status,
      })
      .from(drivers)
      .innerJoin(users, eq(drivers.userId, users.id))
      .innerJoin(vehicles, eq(drivers.id, vehicles.driverId))
      .where(
        and(
          eq(drivers.status, 'ACTIVE'),
          eq(drivers.verificationStatus, 'APPROVED'),
          eq(vehicles.status, 'APPROVED'),
        ),
      );

    // Calculate booking window: [start, end + 30 min buffer]
    const bookingStart = new Date(booking.pickupAt).getTime();
    const durationMs = (booking.estimatedDurationSeconds || 3600) * 1000;
    const bufferMs = 30 * 60 * 1000; // 30 minutes
    const bookingEnd = bookingStart + durationMs + bufferMs;

    const results: any[] = [];

    for (const cand of candidates) {
      // Check category match
      const isCategoryMatch = cand.vehicleCategory === vType.category;

      // Check schedule conflicts
      const overlappingAssignments = await this.db
        .select({
          assignmentId: bookingAssignments.id,
          bookingPickupAt: bookings.pickupAt,
          bookingDuration: bookings.estimatedDurationSeconds,
          status: bookingAssignments.status,
        })
        .from(bookingAssignments)
        .innerJoin(bookings, eq(bookingAssignments.bookingId, bookings.id))
        .where(
          and(
            eq(bookingAssignments.driverId, cand.driverId),
            inArray(bookingAssignments.status, ['ASSIGNED', 'ACCEPTED']),
          ),
        );

      let hasConflict = false;
      let conflictReason: string | null = null;

      for (const asgn of overlappingAssignments) {
        const asgnStart = new Date(asgn.bookingPickupAt).getTime();
        const asgnEnd = asgnStart + (asgn.bookingDuration || 3600) * 1000 + bufferMs;

        // Overlap condition: startA < endB && endA > startB
        if (bookingStart < asgnEnd && bookingEnd > asgnStart) {
          hasConflict = true;
          conflictReason = `Scheduled on another booking from ${new Date(asgnStart).toLocaleTimeString()} to ${new Date(asgnEnd).toLocaleTimeString()}`;
          break;
        }
      }

      const isEligible = isCategoryMatch && !hasConflict;

      results.push({
        ...cand,
        isCategoryMatch,
        hasConflict,
        conflictReason,
        isEligible,
      });
    }

    return {
      bookingId,
      requiredCategory: vType.category,
      bookingWindow: {
        start: new Date(bookingStart).toISOString(),
        end: new Date(bookingEnd).toISOString(),
      },
      drivers: results.sort((a, b) => (b.isEligible ? 1 : 0) - (a.isEligible ? 1 : 0)),
    };
  }

  /**
   * Assign driver to booking (with strict validation)
   */
  async assignDriver(
    bookingId: number,
    driverId: number,
    assignedByUserId: number,
    vehicleId?: number,
    note?: string,
  ) {
    const [booking] = await this.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found.`);
    }

    const [driver] = await this.db
      .select()
      .from(drivers)
      .where(eq(drivers.id, driverId));

    if (!driver || driver.status !== 'ACTIVE' || driver.verificationStatus !== 'APPROVED') {
      throw new BadRequestException('Driver is not verified or currently active.');
    }

    // Resolve vehicle
    let resolvedVehicleId = vehicleId;
    if (!resolvedVehicleId) {
      const [v] = await this.db
        .select()
        .from(vehicles)
        .where(and(eq(vehicles.driverId, driverId), eq(vehicles.status, 'APPROVED')));
      if (!v) {
        throw new BadRequestException('No approved vehicle found for this driver.');
      }
      resolvedVehicleId = v.id;
    }

    // Cancel any existing pending assignments for this booking
    await this.db
      .update(bookingAssignments)
      .set({
        status: 'CANCELLED',
        rejectionReason: 'Replaced by new admin dispatch assignment',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bookingAssignments.bookingId, bookingId),
          eq(bookingAssignments.status, 'ASSIGNED'),
        ),
      );

    // Create new assignment
    const [newAssignment] = await this.db
      .insert(bookingAssignments)
      .values({
        bookingId,
        driverId,
        vehicleId: resolvedVehicleId,
        status: 'ASSIGNED',
        assignedBy: assignedByUserId,
        assignedAt: new Date(),
      })
      .returning();

    // Update booking status
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
      changedByUserId: assignedByUserId,
      reason: `Driver #${driverId} assigned by dispatch admin #${assignedByUserId}. ${note || ''}`.trim(),
    });

    return {
      success: true,
      message: 'Driver dispatched successfully. Waiting for driver acceptance.',
      assignment: newAssignment,
    };
  }

  /**
   * Reassign driver to booking
   */
  async reassignDriver(
    bookingId: number,
    newDriverId: number,
    assignedByUserId: number,
    reason?: string,
  ) {
    return this.assignDriver(
      bookingId,
      newDriverId,
      assignedByUserId,
      undefined,
      reason ? `Reassignment reason: ${reason}` : 'Reassignment by dispatch admin',
    );
  }
}
