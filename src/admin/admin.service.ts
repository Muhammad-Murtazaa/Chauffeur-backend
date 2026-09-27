import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, desc, sql, and, like, or } from 'drizzle-orm';
import { 
  DRIZZLE, 
  users, 
  drivers, 
  vehicles, 
  driverDocuments, 
  vehicleDocuments, 
  bookings, 
  quotes,
  rides, 
  vehicleTypes, 
  bookingAssignments, 
  payments 
} from '../database';
import type { DrizzleDb } from '../database';

@Injectable()
export class AdminService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  /**
   * 1. Dashboard Metrics & Analytics
   */
  async getDashboardStats() {
    // Total bookings count & revenue
    const [bookingStats] = await this.db
      .select({
        totalBookings: sql<number>`count(${bookings.id})::int`,
        totalRevenue: sql<number>`coalesce(sum(${bookings.totalPrice}), 0)::float`,
        pendingPayment: sql<number>`count(case when ${bookings.bookingStatus} = 'PENDING_PAYMENT' then 1 end)::int`,
        confirmed: sql<number>`count(case when ${bookings.bookingStatus} = 'CONFIRMED' then 1 end)::int`,
        activeRides: sql<number>`count(case when ${bookings.bookingStatus} in ('DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'IN_PROGRESS') then 1 end)::int`,
        completed: sql<number>`count(case when ${bookings.bookingStatus} = 'COMPLETED' then 1 end)::int`,
        cancelled: sql<number>`count(case when ${bookings.bookingStatus} in ('CANCELLED', 'NO_SHOW') then 1 end)::int`,
      })
      .from(bookings);

    // Customer count
    const [customerStats] = await this.db
      .select({
        totalCustomers: sql<number>`count(${users.id})::int`,
        activeCustomers: sql<number>`count(case when ${users.isActive} = true then 1 end)::int`,
      })
      .from(users)
      .where(eq(users.role, 'CUSTOMER'));

    // Driver count & verification breakdown
    const [driverStats] = await this.db
      .select({
        totalDrivers: sql<number>`count(${drivers.id})::int`,
        approvedDrivers: sql<number>`count(case when ${drivers.verificationStatus} = 'APPROVED' then 1 end)::int`,
        pendingDrivers: sql<number>`count(case when ${drivers.verificationStatus} = 'PENDING' then 1 end)::int`,
        availableDrivers: sql<number>`count(case when ${drivers.availabilityStatus} = 'AVAILABLE' then 1 end)::int`,
      })
      .from(drivers);

    // Vehicle count
    const [vehicleStats] = await this.db
      .select({
        totalVehicles: sql<number>`count(${vehicles.id})::int`,
        approvedVehicles: sql<number>`count(case when ${vehicles.status} = 'APPROVED' then 1 end)::int`,
        pendingVehicles: sql<number>`count(case when ${vehicles.status} = 'PENDING' then 1 end)::int`,
      })
      .from(vehicles);

    // Recent 8 Bookings
    const recentBookings = await this.db
      .select({
        id: bookings.id,
        referenceNumber: bookings.referenceNumber,
        bookingType: bookings.bookingType,
        bookingStatus: bookings.bookingStatus,
        paymentStatus: bookings.paymentStatus,
        pickupAddress: quotes.pickupAddress,
        dropoffAddress: quotes.dropoffAddress,
        pickupAt: bookings.pickupAt,
        passengerName: bookings.passengerName,
        passengerPhone: bookings.passengerPhone,
        totalPrice: bookings.totalPrice,
        currency: bookings.currency,
        createdAt: bookings.createdAt,
        vehicleCategory: vehicleTypes.category,
        vehicleTypeName: vehicleTypes.name,
      })
      .from(bookings)
      .leftJoin(quotes, eq(bookings.quoteId, quotes.id))
      .leftJoin(vehicleTypes, eq(bookings.vehicleTypeId, vehicleTypes.id))
      .orderBy(desc(bookings.createdAt))
      .limit(8);

    // Recent 5 Drivers
    const recentDrivers = await this.db
      .select({
        id: drivers.id,
        userId: drivers.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        verificationStatus: drivers.verificationStatus,
        status: drivers.status,
        availabilityStatus: drivers.availabilityStatus,
        yearsOfExperience: drivers.yearsOfExperience,
        createdAt: drivers.createdAt,
        vehicleMake: vehicles.make,
        vehicleModel: vehicles.model,
        vehicleYear: vehicles.year,
        vehicleRegistration: vehicles.registrationNumber,
        vehicleCategory: vehicles.category,
        vehicleStatus: vehicles.status,
      })
      .from(drivers)
      .innerJoin(users, eq(drivers.userId, users.id))
      .leftJoin(vehicles, eq(drivers.id, vehicles.driverId))
      .orderBy(desc(drivers.createdAt))
      .limit(5);

    return {
      metrics: {
        totalRevenue: bookingStats?.totalRevenue || 0,
        totalBookings: bookingStats?.totalBookings || 0,
        activeRides: bookingStats?.activeRides || 0,
        completedRides: bookingStats?.completed || 0,
        confirmedBookings: bookingStats?.confirmed || 0,
        pendingPayments: bookingStats?.pendingPayment || 0,
        cancelledBookings: bookingStats?.cancelled || 0,
        totalCustomers: customerStats?.totalCustomers || 0,
        activeCustomers: customerStats?.activeCustomers || 0,
        totalDrivers: driverStats?.totalDrivers || 0,
        approvedDrivers: driverStats?.approvedDrivers || 0,
        pendingDrivers: driverStats?.pendingDrivers || 0,
        availableDrivers: driverStats?.availableDrivers || 0,
        totalVehicles: vehicleStats?.totalVehicles || 0,
        approvedVehicles: vehicleStats?.approvedVehicles || 0,
        pendingVehicles: vehicleStats?.pendingVehicles || 0,
      },
      recentBookings,
      recentDrivers,
    };
  }

  /**
   * 2. Customer Management
   */
  async getCustomers(query?: { search?: string }) {
    const search = query?.search?.trim().toLowerCase();

    const customerList = await this.db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        emailVerified: users.emailVerified,
        phoneVerified: users.phoneVerified,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.role, 'CUSTOMER'))
      .orderBy(desc(users.createdAt));

    // Attach booking stats per customer
    const customerIds = customerList.map((c) => c.id);
    let bookingAggregates: Record<number, { count: number; totalSpent: number }> = {};

    if (customerIds.length > 0) {
      const aggRows = await this.db
        .select({
          customerId: bookings.customerId,
          rideCount: sql<number>`count(${bookings.id})::int`,
          totalSpent: sql<number>`coalesce(sum(${bookings.totalPrice}), 0)::float`,
        })
        .from(bookings)
        .groupBy(bookings.customerId);

      for (const row of aggRows) {
        if (row.customerId) {
          bookingAggregates[row.customerId] = {
            count: row.rideCount,
            totalSpent: row.totalSpent,
          };
        }
      }
    }

    let results = customerList.map((cust) => ({
      ...cust,
      rideCount: bookingAggregates[cust.id]?.count || 0,
      totalSpent: bookingAggregates[cust.id]?.totalSpent || 0,
    }));

    if (search) {
      results = results.filter(
        (c) =>
          c.firstName?.toLowerCase().includes(search) ||
          c.lastName?.toLowerCase().includes(search) ||
          c.email?.toLowerCase().includes(search) ||
          c.phone?.includes(search),
      );
    }

    return results;
  }

  async updateCustomerStatus(customerId: number, isActive: boolean) {
    const [updated] = await this.db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(and(eq(users.id, customerId), eq(users.role, 'CUSTOMER')))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Customer #${customerId} not found`);
    }

    return {
      success: true,
      message: `Customer ${isActive ? 'activated' : 'deactivated'} successfully`,
      customer: {
        id: updated.id,
        email: updated.email,
        isActive: updated.isActive,
      },
    };
  }

  /**
   * 3. Driver & Vehicle Management (shows every driver's vehicle)
   */
  async getDrivers(filters?: { status?: string; verificationStatus?: string }) {
    const allDrivers = await this.db
      .select({
        id: drivers.id,
        userId: drivers.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        isUserActive: users.isActive,
        profileImageUrl: drivers.profileImageUrl,
        dateOfBirth: drivers.dateOfBirth,
        address: drivers.address,
        city: drivers.city,
        yearsOfExperience: drivers.yearsOfExperience,
        emergencyContactName: drivers.emergencyContactName,
        emergencyContactPhone: drivers.emergencyContactPhone,
        verificationStatus: drivers.verificationStatus,
        status: drivers.status,
        availabilityStatus: drivers.availabilityStatus,
        verifiedAt: drivers.verifiedAt,
        createdAt: drivers.createdAt,
        updatedAt: drivers.updatedAt,
        // Vehicle fields
        vehicleId: vehicles.id,
        vehicleMake: vehicles.make,
        vehicleModel: vehicles.model,
        vehicleYear: vehicles.year,
        vehicleColor: vehicles.color,
        vehicleCategory: vehicles.category,
        vehicleRegistrationNumber: vehicles.registrationNumber,
        vehicleVinNumber: vehicles.vinNumber,
        vehiclePassengerCapacity: vehicles.passengerCapacity,
        vehicleLuggageCapacity: vehicles.luggageCapacity,
        vehicleStatus: vehicles.status,
        vehicleRejectionReason: vehicles.rejectionReason,
        vehicleVerifiedAt: vehicles.verifiedAt,
      })
      .from(drivers)
      .innerJoin(users, eq(drivers.userId, users.id))
      .leftJoin(vehicles, eq(drivers.id, vehicles.driverId))
      .orderBy(desc(drivers.createdAt));

    let results = allDrivers.map((d) => ({
      id: d.id,
      userId: d.userId,
      name: `${d.firstName} ${d.lastName}`.trim(),
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      phone: d.phone,
      isUserActive: d.isUserActive,
      profileImageUrl: d.profileImageUrl,
      dateOfBirth: d.dateOfBirth,
      address: d.address,
      city: d.city,
      yearsOfExperience: d.yearsOfExperience,
      emergencyContactName: d.emergencyContactName,
      emergencyContactPhone: d.emergencyContactPhone,
      verificationStatus: d.verificationStatus,
      status: d.status,
      availabilityStatus: d.availabilityStatus,
      verifiedAt: d.verifiedAt,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      vehicle: d.vehicleId
        ? {
            id: d.vehicleId,
            make: d.vehicleMake,
            model: d.vehicleModel,
            year: d.vehicleYear,
            color: d.vehicleColor,
            category: d.vehicleCategory,
            registrationNumber: d.vehicleRegistrationNumber,
            vinNumber: d.vehicleVinNumber,
            passengerCapacity: d.vehiclePassengerCapacity,
            luggageCapacity: d.vehicleLuggageCapacity,
            status: d.vehicleStatus,
            rejectionReason: d.vehicleRejectionReason,
            verifiedAt: d.vehicleVerifiedAt,
          }
        : null,
    }));

    if (filters?.verificationStatus) {
      results = results.filter((d) => d.verificationStatus === filters.verificationStatus);
    }
    if (filters?.status) {
      results = results.filter((d) => d.status === filters.status);
    }

    return results;
  }

  async updateDriverStatus(
    driverId: number,
    dto: { verificationStatus?: any; status?: any; rejectionReason?: string },
    adminUserId: number,
  ) {
    const updatePayload: any = {
      updatedAt: new Date(),
    };

    if (dto.verificationStatus) {
      updatePayload.verificationStatus = dto.verificationStatus;
      if (dto.verificationStatus === 'APPROVED') {
        updatePayload.verifiedBy = adminUserId;
        updatePayload.verifiedAt = new Date();
        updatePayload.status = 'ACTIVE';
      } else if (dto.verificationStatus === 'REJECTED') {
        updatePayload.status = 'REJECTED';
      }
    }

    if (dto.status) {
      updatePayload.status = dto.status;
    }

    const [updated] = await this.db
      .update(drivers)
      .set(updatePayload)
      .where(eq(drivers.id, driverId))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Driver #${driverId} not found`);
    }

    return {
      success: true,
      message: `Driver status updated to ${updated.verificationStatus} / ${updated.status}`,
      driver: updated,
    };
  }

  async updateVehicleStatus(
    vehicleId: number,
    dto: { status: any; rejectionReason?: string },
    adminUserId: number,
  ) {
    const updatePayload: any = {
      status: dto.status,
      rejectionReason: dto.rejectionReason || null,
      updatedAt: new Date(),
    };

    if (dto.status === 'APPROVED') {
      updatePayload.verifiedBy = adminUserId;
      updatePayload.verifiedAt = new Date();
    }

    const [updated] = await this.db
      .update(vehicles)
      .set(updatePayload)
      .where(eq(vehicles.id, vehicleId))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Vehicle #${vehicleId} not found`);
    }

    return {
      success: true,
      message: `Vehicle status updated to ${updated.status}`,
      vehicle: updated,
    };
  }

  /**
   * 4. Pricing Rules & Vehicle Types Rate Cards
   */
  async getPricingRules() {
    const rates = await this.db
      .select()
      .from(vehicleTypes)
      .orderBy(vehicleTypes.id);

    return rates.map((r) => ({
      id: r.id,
      category: r.category,
      name: r.name,
      passengerCapacity: r.passengerCapacity,
      luggageCapacity: r.luggageCapacity,
      baseFare: Number(r.baseFare),
      pricePerDistance: Number(r.pricePerDistance),
      pricePerMinute: Number(r.pricePerMinute),
      minimumFare: Number(r.minimumFare),
      hourlyRate: Number(r.hourlyRate || 100),
      imageUrl: r.imageUrl,
      description: r.description,
      isActive: r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async updatePricingRule(id: number, dto: Partial<{
    name: string;
    passengerCapacity: number;
    luggageCapacity: number;
    baseFare: number;
    pricePerDistance: number;
    pricePerMinute: number;
    minimumFare: number;
    hourlyRate: number;
    description: string;
    imageUrl: string;
    isActive: boolean;
  }>) {
    const updatePayload: any = {
      updatedAt: new Date(),
    };

    if (dto.name !== undefined) updatePayload.name = dto.name;
    if (dto.passengerCapacity !== undefined) updatePayload.passengerCapacity = dto.passengerCapacity;
    if (dto.luggageCapacity !== undefined) updatePayload.luggageCapacity = dto.luggageCapacity;
    if (dto.baseFare !== undefined) updatePayload.baseFare = String(dto.baseFare);
    if (dto.pricePerDistance !== undefined) updatePayload.pricePerDistance = String(dto.pricePerDistance);
    if (dto.pricePerMinute !== undefined) updatePayload.pricePerMinute = String(dto.pricePerMinute);
    if (dto.minimumFare !== undefined) updatePayload.minimumFare = String(dto.minimumFare);
    if (dto.hourlyRate !== undefined) updatePayload.hourlyRate = String(dto.hourlyRate);
    if (dto.description !== undefined) updatePayload.description = dto.description;
    if (dto.imageUrl !== undefined) updatePayload.imageUrl = dto.imageUrl;
    if (dto.isActive !== undefined) updatePayload.isActive = dto.isActive;

    const [updated] = await this.db
      .update(vehicleTypes)
      .set(updatePayload)
      .where(eq(vehicleTypes.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Pricing rule #${id} not found`);
    }

    return {
      success: true,
      message: `Pricing rule for ${updated.name} updated successfully`,
      pricingRule: {
        id: updated.id,
        category: updated.category,
        name: updated.name,
        baseFare: Number(updated.baseFare),
        pricePerDistance: Number(updated.pricePerDistance),
        pricePerMinute: Number(updated.pricePerMinute),
        minimumFare: Number(updated.minimumFare),
        hourlyRate: Number(updated.hourlyRate),
        isActive: updated.isActive,
      },
    };
  }
}
