import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import {
  DRIZZLE,
  drivers,
  vehicles,
  driverDocuments,
  vehicleDocuments,
  vehiclePhotos,
  verificationHistory,
  users,
} from '../database';
import type { DrizzleDb } from '../database';
import {
  RegisterVehicleDto,
  UpdateVehicleDto,
  CreateDriverDocumentDto,
  CreateVehicleDocumentDto,
  CreateVehiclePhotoDto,
  DriverAvailability,
} from './dto';

@Injectable()
export class DriverService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  /**
   * Helper to retrieve driver record by user ID
   */
  async getDriverRecord(userId: number) {
    const driver = await this.db.query.drivers.findFirst({
      where: eq(drivers.userId, userId),
    });

    if (!driver) {
      throw new NotFoundException(
        'Driver profile not found. Please complete driver registration first.',
      );
    }

    return driver;
  }

  // ==========================================
  // VEHICLE MANAGEMENT (1:1 Vehicle)
  // ==========================================

  /**
   * Register a new vehicle for the authenticated driver
   */
  async registerVehicle(userId: number, dto: RegisterVehicleDto) {
    const driver = await this.getDriverRecord(userId);

    // Enforce 1:1 Driver to Vehicle constraint
    const existingDriverVehicle = await this.db.query.vehicles.findFirst({
      where: eq(vehicles.driverId, driver.id),
    });

    if (existingDriverVehicle) {
      throw new ConflictException(
        'You already have a registered vehicle. Please update your existing vehicle or contact support.',
      );
    }

    const normalizedReg = dto.registrationNumber.trim().toUpperCase();
    const normalizedVin = dto.vinNumber?.trim().toUpperCase();

    // Check unique registration number
    const existingReg = await this.db.query.vehicles.findFirst({
      where: eq(vehicles.registrationNumber, normalizedReg),
    });

    if (existingReg) {
      throw new ConflictException(
        'A vehicle with this registration/license plate number is already registered in the system.',
      );
    }

    // Check unique VIN if provided
    if (normalizedVin) {
      const existingVin = await this.db.query.vehicles.findFirst({
        where: eq(vehicles.vinNumber, normalizedVin),
      });

      if (existingVin) {
        throw new ConflictException(
          'A vehicle with this VIN number is already registered in the system.',
        );
      }
    }

    // Insert new vehicle in PENDING status
    const [newVehicle] = await this.db
      .insert(vehicles)
      .values({
        driverId: driver.id,
        make: dto.make.trim(),
        model: dto.model.trim(),
        year: dto.year,
        color: dto.color.trim(),
        registrationNumber: normalizedReg,
        vinNumber: normalizedVin || null,
        category: dto.category,
        passengerCapacity: dto.passengerCapacity,
        luggageCapacity: dto.luggageCapacity ?? 0,
        status: 'PENDING',
      })
      .returning();

    // Log to audit history
    await this.db.insert(verificationHistory).values({
      entityType: 'VEHICLE',
      entityId: newVehicle.id,
      oldStatus: null,
      newStatus: 'PENDING',
      reason: 'Initial vehicle registration submitted for compliance audit.',
    });

    return {
      vehicle: newVehicle,
      message:
        'Vehicle registered successfully with PENDING status. Please upload vehicle documents and photos for admin review.',
    };
  }

  /**
   * Get authenticated driver's vehicle details including documents & photos
   */
  async getVehicle(userId: number) {
    const driver = await this.getDriverRecord(userId);

    const vehicle = await this.db.query.vehicles.findFirst({
      where: eq(vehicles.driverId, driver.id),
      with: {
        documents: true,
        photos: true,
      },
    });

    return vehicle || null;
  }

  /**
   * Update authenticated driver's vehicle
   */
  async updateVehicle(userId: number, dto: UpdateVehicleDto) {
    const driver = await this.getDriverRecord(userId);

    const currentVehicle = await this.db.query.vehicles.findFirst({
      where: eq(vehicles.driverId, driver.id),
    });

    if (!currentVehicle) {
      throw new NotFoundException('No registered vehicle found to update.');
    }

    const updateData: Partial<typeof vehicles.$inferInsert> = {};
    let isCoreIdentityChanged = false;

    if (dto.make !== undefined && dto.make.trim() !== currentVehicle.make) {
      updateData.make = dto.make.trim();
      isCoreIdentityChanged = true;
    }

    if (dto.model !== undefined && dto.model.trim() !== currentVehicle.model) {
      updateData.model = dto.model.trim();
      isCoreIdentityChanged = true;
    }

    if (dto.year !== undefined && dto.year !== currentVehicle.year) {
      updateData.year = dto.year;
      isCoreIdentityChanged = true;
    }

    if (dto.color !== undefined) {
      updateData.color = dto.color.trim();
    }

    if (dto.registrationNumber !== undefined) {
      const normalizedReg = dto.registrationNumber.trim().toUpperCase();
      if (normalizedReg !== currentVehicle.registrationNumber) {
        const existingReg = await this.db.query.vehicles.findFirst({
          where: eq(vehicles.registrationNumber, normalizedReg),
        });

        if (existingReg && existingReg.id !== currentVehicle.id) {
          throw new ConflictException(
            'This registration number is already in use by another vehicle.',
          );
        }

        updateData.registrationNumber = normalizedReg;
        isCoreIdentityChanged = true;
      }
    }

    if (dto.vinNumber !== undefined) {
      const normalizedVin = dto.vinNumber.trim().toUpperCase();
      if (normalizedVin !== currentVehicle.vinNumber) {
        const existingVin = await this.db.query.vehicles.findFirst({
          where: eq(vehicles.vinNumber, normalizedVin),
        });

        if (existingVin && existingVin.id !== currentVehicle.id) {
          throw new ConflictException(
            'This VIN number is already in use by another vehicle.',
          );
        }

        updateData.vinNumber = normalizedVin;
        isCoreIdentityChanged = true;
      }
    }

    if (dto.category !== undefined) {
      updateData.category = dto.category;
    }

    if (dto.passengerCapacity !== undefined) {
      updateData.passengerCapacity = dto.passengerCapacity;
    }

    if (dto.luggageCapacity !== undefined) {
      updateData.luggageCapacity = dto.luggageCapacity;
    }

    if (Object.keys(updateData).length === 0) {
      return { vehicle: currentVehicle, message: 'No changes detected.' };
    }

    if (isCoreIdentityChanged) {
      updateData.status = 'PENDING';
      updateData.verifiedBy = null;
      updateData.verifiedAt = null;
      updateData.rejectionReason = null;
    }

    updateData.updatedAt = new Date();

    const [updatedVehicle] = await this.db
      .update(vehicles)
      .set(updateData)
      .where(eq(vehicles.id, currentVehicle.id))
      .returning();

    if (isCoreIdentityChanged) {
      await this.db.insert(verificationHistory).values({
        entityType: 'VEHICLE',
        entityId: updatedVehicle.id,
        oldStatus: currentVehicle.status,
        newStatus: 'PENDING',
        reason: 'Core vehicle specs updated by driver, reset for re-verification.',
      });
    }

    return {
      vehicle: updatedVehicle,
      message: isCoreIdentityChanged
        ? 'Vehicle updated. Because core vehicle details changed, verification status has been reset to PENDING for admin review.'
        : 'Vehicle details updated successfully.',
    };
  }

  // ==========================================
  // DRIVER LEGAL DOCUMENTS
  // ==========================================

  async getDriverDocuments(userId: number) {
    const driver = await this.getDriverRecord(userId);
    return this.db.query.driverDocuments.findMany({
      where: eq(driverDocuments.driverId, driver.id),
      orderBy: [desc(driverDocuments.createdAt)],
    });
  }

  async upsertDriverDocument(userId: number, dto: CreateDriverDocumentDto) {
    const driver = await this.getDriverRecord(userId);

    const existing = await this.db.query.driverDocuments.findFirst({
      where: and(
        eq(driverDocuments.driverId, driver.id),
        eq(driverDocuments.documentType, dto.documentType),
      ),
    });

    if (existing) {
      const [updated] = await this.db
        .update(driverDocuments)
        .set({
          documentNumber: dto.documentNumber || existing.documentNumber,
          frontImageUrl: dto.frontImageUrl || existing.frontImageUrl,
          backImageUrl: dto.backImageUrl || existing.backImageUrl,
          issueDate: dto.issueDate || existing.issueDate,
          expiryDate: dto.expiryDate || existing.expiryDate,
          status: 'PENDING',
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(driverDocuments.id, existing.id))
        .returning();

      return { document: updated, message: 'Driver document updated and submitted for review.' };
    }

    const [created] = await this.db
      .insert(driverDocuments)
      .values({
        driverId: driver.id,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber || null,
        frontImageUrl: dto.frontImageUrl || null,
        backImageUrl: dto.backImageUrl || null,
        issueDate: dto.issueDate || null,
        expiryDate: dto.expiryDate || null,
        status: 'PENDING',
      })
      .returning();

    return { document: created, message: 'Driver document uploaded successfully for review.' };
  }

  async deleteDriverDocument(userId: number, docId: number) {
    const driver = await this.getDriverRecord(userId);
    await this.db
      .delete(driverDocuments)
      .where(
        and(
          eq(driverDocuments.id, docId),
          eq(driverDocuments.driverId, driver.id),
        ),
      );
    return { message: 'Document removed successfully.' };
  }

  // ==========================================
  // VEHICLE DOCUMENTS
  // ==========================================

  async getVehicleDocuments(userId: number) {
    const driver = await this.getDriverRecord(userId);
    const vehicle = await this.db.query.vehicles.findFirst({
      where: eq(vehicles.driverId, driver.id),
    });

    if (!vehicle) {
      return [];
    }

    return this.db.query.vehicleDocuments.findMany({
      where: eq(vehicleDocuments.vehicleId, vehicle.id),
      orderBy: [desc(vehicleDocuments.createdAt)],
    });
  }

  async upsertVehicleDocument(userId: number, dto: CreateVehicleDocumentDto) {
    const driver = await this.getDriverRecord(userId);
    let vehicle = await this.db.query.vehicles.findFirst({
      where: eq(vehicles.driverId, driver.id),
    });

    if (!vehicle) {
      throw new NotFoundException('Please register your vehicle before uploading vehicle documents.');
    }

    const existing = await this.db.query.vehicleDocuments.findFirst({
      where: and(
        eq(vehicleDocuments.vehicleId, vehicle.id),
        eq(vehicleDocuments.documentType, dto.documentType),
      ),
    });

    if (existing) {
      const [updated] = await this.db
        .update(vehicleDocuments)
        .set({
          documentNumber: dto.documentNumber || existing.documentNumber,
          fileUrl: dto.fileUrl || existing.fileUrl,
          issueDate: dto.issueDate || existing.issueDate,
          expiryDate: dto.expiryDate || existing.expiryDate,
          status: 'PENDING',
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(vehicleDocuments.id, existing.id))
        .returning();

      return { document: updated, message: 'Vehicle document updated and submitted for review.' };
    }

    const [created] = await this.db
      .insert(vehicleDocuments)
      .values({
        vehicleId: vehicle.id,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber || null,
        fileUrl: dto.fileUrl,
        issueDate: dto.issueDate || null,
        expiryDate: dto.expiryDate || null,
        status: 'PENDING',
      })
      .returning();

    return { document: created, message: 'Vehicle document uploaded successfully for review.' };
  }

  // ==========================================
  // VEHICLE 6-ANGLE PHOTOS
  // ==========================================

  async getVehiclePhotos(userId: number) {
    const driver = await this.getDriverRecord(userId);
    const vehicle = await this.db.query.vehicles.findFirst({
      where: eq(vehicles.driverId, driver.id),
    });

    if (!vehicle) {
      return [];
    }

    return this.db.query.vehiclePhotos.findMany({
      where: eq(vehiclePhotos.vehicleId, vehicle.id),
      orderBy: [desc(vehiclePhotos.createdAt)],
    });
  }

  async upsertVehiclePhoto(userId: number, dto: CreateVehiclePhotoDto) {
    const driver = await this.getDriverRecord(userId);
    let vehicle = await this.db.query.vehicles.findFirst({
      where: eq(vehicles.driverId, driver.id),
    });

    if (!vehicle) {
      throw new NotFoundException('Please register your vehicle before uploading vehicle photos.');
    }

    const existing = await this.db.query.vehiclePhotos.findFirst({
      where: and(
        eq(vehiclePhotos.vehicleId, vehicle.id),
        eq(vehiclePhotos.photoType, dto.photoType),
      ),
    });

    if (existing) {
      const [updated] = await this.db
        .update(vehiclePhotos)
        .set({
          imageUrl: dto.imageUrl,
          status: 'PENDING',
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(vehiclePhotos.id, existing.id))
        .returning();

      return { photo: updated, message: 'Vehicle photo updated and submitted for inspection.' };
    }

    const [created] = await this.db
      .insert(vehiclePhotos)
      .values({
        vehicleId: vehicle.id,
        photoType: dto.photoType,
        imageUrl: dto.imageUrl,
        status: 'PENDING',
      })
      .returning();

    return { photo: created, message: 'Vehicle photo uploaded successfully.' };
  }

  // ==========================================
  // DRIVER AVAILABILITY
  // ==========================================

  async getAvailability(userId: number) {
    const driver = await this.getDriverRecord(userId);
    return {
      availabilityStatus: driver.availabilityStatus,
      verificationStatus: driver.verificationStatus,
      status: driver.status,
    };
  }

  async updateAvailability(userId: number, targetStatus: DriverAvailability) {
    const driver = await this.getDriverRecord(userId);

    const [updated] = await this.db
      .update(drivers)
      .set({
        availabilityStatus: targetStatus,
        updatedAt: new Date(),
      })
      .where(eq(drivers.id, driver.id))
      .returning();

    return {
      availabilityStatus: updated.availabilityStatus,
      message: `Driver status changed to ${updated.availabilityStatus}.`,
    };
  }

  // ==========================================
  // VERIFICATION CHECKLIST & AUDIT LOGS
  // ==========================================

  async getVerificationStatus(userId: number) {
    const driver = await this.getDriverRecord(userId);
    const vehicle = await this.db.query.vehicles.findFirst({
      where: eq(vehicles.driverId, driver.id),
      with: { documents: true, photos: true },
    });
    const driverDocs = await this.db.query.driverDocuments.findMany({
      where: eq(driverDocuments.driverId, driver.id),
    });

    const auditLogs = await this.db.query.verificationHistory.findMany({
      orderBy: [desc(verificationHistory.createdAt)],
      limit: 10,
    });

    return {
      driver,
      vehicle: vehicle || null,
      driverDocuments: driverDocs,
      auditLogs,
    };
  }

  // ==========================================
  // DRIVER DASHBOARD OVERVIEW & BOOKINGS
  // ==========================================

  async getDashboardOverview(userId: number) {
    const driver = await this.getDriverRecord(userId);
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    const vehicle = await this.db.query.vehicles.findFirst({
      where: eq(vehicles.driverId, driver.id),
    });

    const driverDocs = await this.db.query.driverDocuments.findMany({
      where: eq(driverDocuments.driverId, driver.id),
    });

    return {
      user: user
        ? {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
          }
        : null,
      driver,
      vehicle: vehicle || null,
      documentsCount: driverDocs.length,
      stats: {
        todayEarnings: '$0.00',
        weekEarnings: '$0.00',
        completedTrips: 0,
        rating: '5.0',
      },
      activeRide: null,
      upcomingBookings: [],
      bookingHistory: [],
    };
  }
}
