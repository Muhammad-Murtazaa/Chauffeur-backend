import {
  pgTable,
  pgEnum,
  bigserial,
  bigint,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * =========================
 * Enums
 * =========================
 */

export const bookingTypeEnum = pgEnum("booking_type", [
  "ONE_WAY",
  "RETURN",
  "HOURLY",
  "CITY_TO_CITY",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "DRIVER_ASSIGNMENT_PENDING",
  "DRIVER_ASSIGNED",
  "DRIVER_EN_ROUTE",
  "DRIVER_ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "PAYMENT_FAILED",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
]);

export const paymentProviderEnum = pgEnum("payment_provider", [
  "STRIPE",
  "MOCK",
  "CASH",
  "SQUARE",
]);

export const assignmentStatusEnum = pgEnum("assignment_status", [
  "ASSIGNED",
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
  "COMPLETED",
]);

export const stopTypeEnum = pgEnum("stop_type", [
  "PICKUP",
  "STOP",
  "DROPOFF",
]);

export const rideStatusEnum = pgEnum("ride_status", [
  "SCHEDULED",
  "EN_ROUTE",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]);

export const userRoleEnum = pgEnum("user_role", [
  "CUSTOMER",
  "DRIVER",
  "ADMIN",
]);

export const driverVerificationStatusEnum = pgEnum(
  "driver_verification_status",
  ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"],
);

export const driverStatusEnum = pgEnum("driver_status", [
  "PENDING",
  "ACTIVE",
  "SUSPENDED",
  "REJECTED",
  "INACTIVE",
]);

export const driverAvailabilityStatusEnum = pgEnum(
  "driver_availability_status",
  ["OFFLINE", "AVAILABLE", "BUSY", "UNAVAILABLE"],
);

export const documentVerificationStatusEnum = pgEnum(
  "document_verification_status",
  ["PENDING", "APPROVED", "REJECTED", "EXPIRED"],
);

export const driverDocumentTypeEnum = pgEnum("driver_document_type", [
  "DRIVING_LICENSE",
  "IDENTITY_DOCUMENT",
  "BACKGROUND_CHECK",
  "WORK_PERMIT",
  "OTHER",
]);

export const vehicleCategoryEnum = pgEnum("vehicle_category", [
  "STANDARD",
  "EXECUTIVE",
  "LUXURY",
  "SUV",
  "VAN",
]);

export const vehicleStatusEnum = pgEnum("vehicle_status", [
  "PENDING",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
]);

export const vehicleDocumentTypeEnum = pgEnum("vehicle_document_type", [
  "REGISTRATION",
  "INSURANCE",
  "INSPECTION_CERTIFICATE",
  "COMMERCIAL_LICENSE",
  "OTHER",
]);

export const vehiclePhotoTypeEnum = pgEnum("vehicle_photo_type", [
  "FRONT",
  "BACK",
  "LEFT",
  "RIGHT",
  "INTERIOR",
  "LICENSE_PLATE",
]);

export const photoVerificationStatusEnum = pgEnum(
  "photo_verification_status",
  ["PENDING", "APPROVED", "REJECTED"],
);

export const verificationEntityTypeEnum = pgEnum(
  "verification_entity_type",
  ["DRIVER", "VEHICLE", "DOCUMENT"],
);

/**
 * =========================
 * Users
 * =========================
 *
 * Authentication / authorization only.
 */

export const users = pgTable(
  "users",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),

    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 30 }).notNull(),

    // Store only an Argon2/bcrypt hash here.
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),

    role: userRoleEnum("role").notNull().default("CUSTOMER"),

    emailVerified: boolean("email_verified").notNull().default(false),
    phoneVerified: boolean("phone_verified").notNull().default(false),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
    phoneUnique: uniqueIndex("users_phone_unique").on(table.phone),
    roleIdx: index("users_role_idx").on(table.role),
  }),
);

/**
 * =========================
 * Drivers
 * =========================
 *
 * One User can have at most one Driver profile.
 */

export const drivers = pgTable(
  "drivers",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),


    profileImageUrl: text("profile_image_url"),

    dateOfBirth: date("date_of_birth"),

    address: text("address"),
    city: varchar("city", { length: 100 }),

    yearsOfExperience: integer("years_of_experience").notNull().default(0),

    emergencyContactName: varchar("emergency_contact_name", {
      length: 150,
    }),

    emergencyContactPhone: varchar("emergency_contact_phone", {
      length: 30,
    }),

    verificationStatus: driverVerificationStatusEnum("verification_status")
      .notNull()
      .default("PENDING"),

    status: driverStatusEnum("status").notNull().default("PENDING"),

    availabilityStatus: driverAvailabilityStatusEnum("availability_status")
      .notNull()
      .default("OFFLINE"),

    verifiedBy: bigint("verified_by", { mode: "number" }).references(
      () => users.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),

    verifiedAt: timestamp("verified_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Enforces User 1:1 Driver
    userUnique: uniqueIndex("drivers_user_id_unique").on(table.userId),

    statusIdx: index("drivers_status_idx").on(table.status),
    verificationStatusIdx: index("drivers_verification_status_idx").on(
      table.verificationStatus,
    ),
    availabilityIdx: index("drivers_availability_status_idx").on(
      table.availabilityStatus,
    ),
  }),
);

/**
 * =========================
 * Driver Documents
 * =========================
 */

export const driverDocuments = pgTable(
  "driver_documents",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    driverId: bigint("driver_id", { mode: "number" })
      .notNull()
      .references(() => drivers.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    documentType: driverDocumentTypeEnum("document_type").notNull(),

    documentNumber: varchar("document_number", { length: 150 }),

    frontImageUrl: text("front_image_url"),
    backImageUrl: text("back_image_url"),

    issueDate: date("issue_date"),
    expiryDate: date("expiry_date"),

    status: documentVerificationStatusEnum("status")
      .notNull()
      .default("PENDING"),

    verifiedBy: bigint("verified_by", { mode: "number" }).references(
      () => users.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),

    verifiedAt: timestamp("verified_at", { withTimezone: true }),

    rejectionReason: text("rejection_reason"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    driverIdx: index("driver_documents_driver_id_idx").on(table.driverId),
    statusIdx: index("driver_documents_status_idx").on(table.status),

    // Prevents duplicate document categories for the same driver.
    // Remove this if you want multiple records of the same type/history.
    driverDocumentTypeUnique: uniqueIndex(
      "driver_documents_driver_type_unique",
    ).on(table.driverId, table.documentType),
  }),
);

/**
 * =========================
 * Vehicles
 * =========================
 *
 * Business rule:
 * One Driver can have exactly one active vehicle record.
 *
 * The UNIQUE driver_id constraint enforces 1:1 from Driver -> Vehicle.
 */

export const vehicles = pgTable(
  "vehicles",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    driverId: bigint("driver_id", { mode: "number" })
      .notNull()
      .references(() => drivers.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    make: varchar("make", { length: 100 }).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    year: integer("year").notNull(),
    color: varchar("color", { length: 50 }).notNull(),

    registrationNumber: varchar("registration_number", {
      length: 100,
    }).notNull(),

    vinNumber: varchar("vin_number", { length: 100 }),

    category: vehicleCategoryEnum("category").notNull(),

    passengerCapacity: integer("passenger_capacity").notNull(),
    luggageCapacity: integer("luggage_capacity").notNull().default(0),

    status: vehicleStatusEnum("status").notNull().default("PENDING"),

    verifiedBy: bigint("verified_by", { mode: "number" }).references(
      () => users.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),

    verifiedAt: timestamp("verified_at", { withTimezone: true }),

    rejectionReason: text("rejection_reason"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Enforces Driver 1:1 Vehicle
    driverUnique: uniqueIndex("vehicles_driver_id_unique").on(table.driverId),

    registrationUnique: uniqueIndex(
      "vehicles_registration_number_unique",
    ).on(table.registrationNumber),

    vinUnique: uniqueIndex("vehicles_vin_number_unique").on(table.vinNumber),

    statusIdx: index("vehicles_status_idx").on(table.status),
    categoryIdx: index("vehicles_category_idx").on(table.category),
  }),
);

/**
 * =========================
 * Vehicle Documents
 * =========================
 */

export const vehicleDocuments = pgTable(
  "vehicle_documents",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    vehicleId: bigint("vehicle_id", { mode: "number" })
      .notNull()
      .references(() => vehicles.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    documentType: vehicleDocumentTypeEnum("document_type").notNull(),

    documentNumber: varchar("document_number", { length: 150 }),

    fileUrl: text("file_url").notNull(),

    issueDate: date("issue_date"),
    expiryDate: date("expiry_date"),

    status: documentVerificationStatusEnum("status")
      .notNull()
      .default("PENDING"),

    verifiedBy: bigint("verified_by", { mode: "number" }).references(
      () => users.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),

    verifiedAt: timestamp("verified_at", { withTimezone: true }),

    rejectionReason: text("rejection_reason"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    vehicleIdx: index("vehicle_documents_vehicle_id_idx").on(table.vehicleId),
    statusIdx: index("vehicle_documents_status_idx").on(table.status),

    // One current document record per type.
    vehicleDocumentTypeUnique: uniqueIndex(
      "vehicle_documents_vehicle_type_unique",
    ).on(table.vehicleId, table.documentType),
  }),
);

/**
 * =========================
 * Vehicle Photos
 * =========================
 */

export const vehiclePhotos = pgTable(
  "vehicle_photos",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    vehicleId: bigint("vehicle_id", { mode: "number" })
      .notNull()
      .references(() => vehicles.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    photoType: vehiclePhotoTypeEnum("photo_type").notNull(),

    imageUrl: text("image_url").notNull(),

    status: photoVerificationStatusEnum("status")
      .notNull()
      .default("PENDING"),

    rejectionReason: text("rejection_reason"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    vehicleIdx: index("vehicle_photos_vehicle_id_idx").on(table.vehicleId),

    // Exactly one photo per required angle/type.
    vehiclePhotoTypeUnique: uniqueIndex(
      "vehicle_photos_vehicle_type_unique",
    ).on(table.vehicleId, table.photoType),
  }),
);

/**
 * =========================
 * Verification History
 * =========================
 *
 * Generic audit trail for driver / vehicle / document approvals.
 *
 * Note:
 * entityId cannot have a standard FK because it can reference
 * multiple different tables depending on entityType.
 */

export const verificationHistory = pgTable(
  "verification_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    entityType: verificationEntityTypeEnum("entity_type").notNull(),

    entityId: bigint("entity_id", { mode: "number" }).notNull(),

    oldStatus: varchar("old_status", { length: 30 }),
    newStatus: varchar("new_status", { length: 30 }).notNull(),

    reviewedBy: bigint("reviewed_by", { mode: "number" }).references(
      () => users.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),

    reason: text("reason"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    entityIdx: index("verification_history_entity_idx").on(
      table.entityType,
      table.entityId,
    ),
    reviewedByIdx: index("verification_history_reviewed_by_idx").on(
      table.reviewedBy,
    ),
  }),
);

/**
 * =========================
 * Drizzle Relations
 * =========================
 */

export const usersRelations = relations(users, ({ one, many }) => ({
  driver: one(drivers, {
    fields: [users.id],
    references: [drivers.userId],
  }),

  driverVerifications: many(drivers, {
    relationName: "driver_verified_by",
  }),

  vehicleVerifications: many(vehicles, {
    relationName: "vehicle_verified_by",
  }),

  driverDocumentVerifications: many(driverDocuments, {
    relationName: "driver_document_verified_by",
  }),

  vehicleDocumentVerifications: many(vehicleDocuments, {
    relationName: "vehicle_document_verified_by",
  }),

  verificationReviews: many(verificationHistory, {
    relationName: "verification_reviewed_by",
  }),
}));

export const driversRelations = relations(drivers, ({ one, many }) => ({
  user: one(users, {
    fields: [drivers.userId],
    references: [users.id],
  }),

  verifiedByUser: one(users, {
    fields: [drivers.verifiedBy],
    references: [users.id],
    relationName: "driver_verified_by",
  }),

  vehicle: one(vehicles, {
    fields: [drivers.id],
    references: [vehicles.driverId],
  }),

  documents: many(driverDocuments),
}));

export const driverDocumentsRelations = relations(
  driverDocuments,
  ({ one }) => ({
    driver: one(drivers, {
      fields: [driverDocuments.driverId],
      references: [drivers.id],
    }),

    verifiedByUser: one(users, {
      fields: [driverDocuments.verifiedBy],
      references: [users.id],
      relationName: "driver_document_verified_by",
    }),
  }),
);

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  driver: one(drivers, {
    fields: [vehicles.driverId],
    references: [drivers.id],
  }),

  verifiedByUser: one(users, {
    fields: [vehicles.verifiedBy],
    references: [users.id],
    relationName: "vehicle_verified_by",
  }),

  documents: many(vehicleDocuments),
  photos: many(vehiclePhotos),
}));

export const vehicleDocumentsRelations = relations(
  vehicleDocuments,
  ({ one }) => ({
    vehicle: one(vehicles, {
      fields: [vehicleDocuments.vehicleId],
      references: [vehicles.id],
    }),

    verifiedByUser: one(users, {
      fields: [vehicleDocuments.verifiedBy],
      references: [users.id],
      relationName: "vehicle_document_verified_by",
    }),
  }),
);

export const vehiclePhotosRelations = relations(vehiclePhotos, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [vehiclePhotos.vehicleId],
    references: [vehicles.id],
  }),
}));

export const verificationHistoryRelations = relations(
  verificationHistory,
  ({ one }) => ({
    reviewedByUser: one(users, {
      fields: [verificationHistory.reviewedBy],
      references: [users.id],
      relationName: "verification_reviewed_by",
    }),
  }),
);

/**
 * =========================
 * Vehicle Types (Catalog & Base Rates)
 * =========================
 */

export const vehicleTypes = pgTable(
  "vehicle_types",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    category: vehicleCategoryEnum("category").notNull(),
    name: varchar("name", { length: 100 }).notNull(),

    passengerCapacity: integer("passenger_capacity").notNull(),
    luggageCapacity: integer("luggage_capacity").notNull().default(0),

    baseFare: numeric("base_fare", { precision: 10, scale: 2 }).notNull(),
    pricePerDistance: numeric("price_per_distance", {
      precision: 10,
      scale: 2,
    }).notNull(),
    pricePerMinute: numeric("price_per_minute", {
      precision: 10,
      scale: 2,
    }).notNull(),
    minimumFare: numeric("minimum_fare", {
      precision: 10,
      scale: 2,
    }).notNull(),
    hourlyRate: numeric("hourly_rate", {
      precision: 10,
      scale: 2,
    }).notNull().default("100.00"),

    imageUrl: text("image_url"),
    description: text("description"),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    categoryUnique: uniqueIndex("vehicle_types_category_unique").on(
      table.category,
    ),
    activeIdx: index("vehicle_types_is_active_idx").on(table.isActive),
  }),
);

/**
 * =========================
 * Quotes & Quote Vehicle Options
 * =========================
 */

export const quotes = pgTable(
  "quotes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    customerId: bigint("customer_id", { mode: "number" }).references(
      () => users.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),

    bookingType: bookingTypeEnum("booking_type").notNull().default("ONE_WAY"),

    pickupAddress: text("pickup_address").notNull(),
    pickupPlaceId: varchar("pickup_place_id", { length: 255 }),
    pickupLat: numeric("pickup_lat", { precision: 10, scale: 7 }),
    pickupLng: numeric("pickup_lng", { precision: 10, scale: 7 }),

    dropoffAddress: text("dropoff_address"),
    dropoffPlaceId: varchar("dropoff_place_id", { length: 255 }),
    dropoffLat: numeric("dropoff_lat", { precision: 10, scale: 7 }),
    dropoffLng: numeric("dropoff_lng", { precision: 10, scale: 7 }),

    distanceMeters: integer("distance_meters").notNull().default(0),
    durationSeconds: integer("duration_seconds").notNull().default(0),

    pickupAt: timestamp("pickup_at", { withTimezone: true }).notNull(),

    passengerCount: integer("passenger_count").notNull().default(1),
    luggageCount: integer("luggage_count").notNull().default(0),
    hours: integer("hours").default(0),

    currency: varchar("currency", { length: 10 }).notNull().default("USD"),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    customerIdx: index("quotes_customer_id_idx").on(table.customerId),
    expiresIdx: index("quotes_expires_at_idx").on(table.expiresAt),
  }),
);

export const quoteVehicleOptions = pgTable(
  "quote_vehicle_options",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    quoteId: bigint("quote_id", { mode: "number" })
      .notNull()
      .references(() => quotes.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    vehicleTypeId: bigint("vehicle_type_id", { mode: "number" })
      .notNull()
      .references(() => vehicleTypes.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    category: vehicleCategoryEnum("category").notNull(),
    name: varchar("name", { length: 100 }).notNull(),

    basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
    distancePrice: numeric("distance_price", {
      precision: 10,
      scale: 2,
    }).notNull().default("0.00"),
    durationPrice: numeric("duration_price", {
      precision: 10,
      scale: 2,
    }).notNull().default("0.00"),
    surcharges: numeric("surcharges", {
      precision: 10,
      scale: 2,
    }).notNull().default("0.00"),
    extras: numeric("extras", {
      precision: 10,
      scale: 2,
    }).notNull().default("0.00"),
    discount: numeric("discount", {
      precision: 10,
      scale: 2,
    }).notNull().default("0.00"),
    tax: numeric("tax", { precision: 10, scale: 2 }).notNull().default("0.00"),
    totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    quoteIdx: index("quote_vehicle_options_quote_id_idx").on(table.quoteId),
  }),
);

/**
 * =========================
 * Bookings & Stops
 * =========================
 */

export const bookings = pgTable(
  "bookings",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    referenceNumber: varchar("reference_number", { length: 50 }).notNull(),

    customerId: bigint("customer_id", { mode: "number" })
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    quoteId: bigint("quote_id", { mode: "number" }).references(
      () => quotes.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),

    bookingType: bookingTypeEnum("booking_type").notNull().default("ONE_WAY"),

    vehicleTypeId: bigint("vehicle_type_id", { mode: "number" })
      .notNull()
      .references(() => vehicleTypes.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    pickupAt: timestamp("pickup_at", { withTimezone: true }).notNull(),

    passengerCount: integer("passenger_count").notNull().default(1),
    luggageCount: integer("luggage_count").notNull().default(0),

    passengerName: varchar("passenger_name", { length: 150 }).notNull(),
    passengerPhone: varchar("passenger_phone", { length: 50 }).notNull(),
    passengerEmail: varchar("passenger_email", { length: 255 }).notNull(),

    flightNumber: varchar("flight_number", { length: 50 }),
    specialInstructions: text("special_instructions"),

    distanceMeters: integer("distance_meters").notNull().default(0),
    estimatedDurationSeconds: integer("estimated_duration_seconds")
      .notNull()
      .default(0),

    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
    surcharges: numeric("surcharges", {
      precision: 10,
      scale: 2,
    }).notNull().default("0.00"),
    discount: numeric("discount", {
      precision: 10,
      scale: 2,
    }).notNull().default("0.00"),
    tax: numeric("tax", { precision: 10, scale: 2 }).notNull().default("0.00"),
    totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),

    currency: varchar("currency", { length: 10 }).notNull().default("USD"),

    paymentStatus: paymentStatusEnum("payment_status")
      .notNull()
      .default("PENDING"),
    bookingStatus: bookingStatusEnum("booking_status")
      .notNull()
      .default("PENDING_PAYMENT"),

    cancelledBy: varchar("cancelled_by", { length: 50 }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    cancellationFee: numeric("cancellation_fee", {
      precision: 10,
      scale: 2,
    }).notNull().default("0.00"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    referenceUnique: uniqueIndex("bookings_reference_number_unique").on(
      table.referenceNumber,
    ),
    customerIdx: index("bookings_customer_id_idx").on(table.customerId),
    statusIdx: index("bookings_status_idx").on(table.bookingStatus),
    paymentStatusIdx: index("bookings_payment_status_idx").on(
      table.paymentStatus,
    ),
    pickupAtIdx: index("bookings_pickup_at_idx").on(table.pickupAt),
  }),
);

export const bookingStops = pgTable(
  "booking_stops",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    bookingId: bigint("booking_id", { mode: "number" })
      .notNull()
      .references(() => bookings.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    type: stopTypeEnum("type").notNull().default("STOP"),

    placeId: varchar("place_id", { length: 255 }),
    address: text("address").notNull(),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),

    sequence: integer("sequence").notNull().default(0),

    estimatedArrival: timestamp("estimated_arrival", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    bookingIdx: index("booking_stops_booking_id_idx").on(table.bookingId),
    sequenceIdx: index("booking_stops_sequence_idx").on(
      table.bookingId,
      table.sequence,
    ),
  }),
);

/**
 * =========================
 * Payments Table
 * =========================
 */

export const payments = pgTable(
  "payments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    bookingId: bigint("booking_id", { mode: "number" })
      .notNull()
      .references(() => bookings.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    provider: paymentProviderEnum("provider").notNull().default("STRIPE"),

    providerPaymentId: varchar("provider_payment_id", { length: 255 }),
    providerSessionId: varchar("provider_session_id", { length: 255 }),

    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("USD"),

    status: paymentStatusEnum("status").notNull().default("PENDING"),

    paidAt: timestamp("paid_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),

    errorMessage: text("error_message"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    bookingIdx: index("payments_booking_id_idx").on(table.bookingId),
    providerPaymentIdx: index("payments_provider_payment_id_idx").on(
      table.providerPaymentId,
    ),
    statusIdx: index("payments_status_idx").on(table.status),
  }),
);

/**
 * =========================
 * Booking Assignments
 * =========================
 */

export const bookingAssignments = pgTable(
  "booking_assignments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    bookingId: bigint("booking_id", { mode: "number" })
      .notNull()
      .references(() => bookings.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    driverId: bigint("driver_id", { mode: "number" })
      .notNull()
      .references(() => drivers.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    vehicleId: bigint("vehicle_id", { mode: "number" }).references(
      () => vehicles.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),

    status: assignmentStatusEnum("status").notNull().default("ASSIGNED"),

    assignedBy: bigint("assigned_by", { mode: "number" }).references(
      () => users.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),

    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),

    rejectionReason: text("rejection_reason"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    bookingIdx: index("booking_assignments_booking_id_idx").on(table.bookingId),
    driverIdx: index("booking_assignments_driver_id_idx").on(table.driverId),
    statusIdx: index("booking_assignments_status_idx").on(table.status),
  }),
);

/**
 * =========================
 * Booking Status History (Audit Trail)
 * =========================
 */

export const bookingStatusHistory = pgTable(
  "booking_status_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    bookingId: bigint("booking_id", { mode: "number" })
      .notNull()
      .references(() => bookings.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    oldStatus: bookingStatusEnum("old_status"),
    newStatus: bookingStatusEnum("new_status").notNull(),

    changedByUserId: bigint("changed_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),

    reason: text("reason"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    bookingIdx: index("booking_status_history_booking_id_idx").on(
      table.bookingId,
    ),
    createdAtIdx: index("booking_status_history_created_at_idx").on(
      table.createdAt,
    ),
  }),
);

/**
 * =========================
 * Rides (Execution Tracking)
 * =========================
 */

export const rides = pgTable(
  "rides",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    bookingId: bigint("booking_id", { mode: "number" })
      .notNull()
      .references(() => bookings.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    driverId: bigint("driver_id", { mode: "number" })
      .notNull()
      .references(() => drivers.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    vehicleId: bigint("vehicle_id", { mode: "number" }).references(
      () => vehicles.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),

    enRouteAt: timestamp("en_route_at", { withTimezone: true }),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    actualDistanceMeters: integer("actual_distance_meters"),
    actualDurationSeconds: integer("actual_duration_seconds"),

    status: rideStatusEnum("status").notNull().default("SCHEDULED"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    bookingIdx: index("rides_booking_id_idx").on(table.bookingId),
    driverIdx: index("rides_driver_id_idx").on(table.driverId),
    statusIdx: index("rides_status_idx").on(table.status),
  }),
);

/**
 * =========================
 * Booking Engine Relations
 * =========================
 */

export const vehicleTypesRelations = relations(
  vehicleTypes,
  ({ many }) => ({
    quoteOptions: many(quoteVehicleOptions),
    bookings: many(bookings),
  }),
);

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  customer: one(users, {
    fields: [quotes.customerId],
    references: [users.id],
  }),
  vehicleOptions: many(quoteVehicleOptions),
  bookings: many(bookings),
}));

export const quoteVehicleOptionsRelations = relations(
  quoteVehicleOptions,
  ({ one }) => ({
    quote: one(quotes, {
      fields: [quoteVehicleOptions.quoteId],
      references: [quotes.id],
    }),
    vehicleType: one(vehicleTypes, {
      fields: [quoteVehicleOptions.vehicleTypeId],
      references: [vehicleTypes.id],
    }),
  }),
);

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  customer: one(users, {
    fields: [bookings.customerId],
    references: [users.id],
  }),
  quote: one(quotes, {
    fields: [bookings.quoteId],
    references: [quotes.id],
  }),
  vehicleType: one(vehicleTypes, {
    fields: [bookings.vehicleTypeId],
    references: [vehicleTypes.id],
  }),
  stops: many(bookingStops),
  payments: many(payments),
  assignments: many(bookingAssignments),
  statusHistory: many(bookingStatusHistory),
  rides: many(rides),
}));

export const bookingStopsRelations = relations(bookingStops, ({ one }) => ({
  booking: one(bookings, {
    fields: [bookingStops.bookingId],
    references: [bookings.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, {
    fields: [payments.bookingId],
    references: [bookings.id],
  }),
}));

export const bookingAssignmentsRelations = relations(
  bookingAssignments,
  ({ one }) => ({
    booking: one(bookings, {
      fields: [bookingAssignments.bookingId],
      references: [bookings.id],
    }),
    driver: one(drivers, {
      fields: [bookingAssignments.driverId],
      references: [drivers.id],
    }),
    vehicle: one(vehicles, {
      fields: [bookingAssignments.vehicleId],
      references: [vehicles.id],
    }),
    assignedByUser: one(users, {
      fields: [bookingAssignments.assignedBy],
      references: [users.id],
    }),
  }),
);

export const bookingStatusHistoryRelations = relations(
  bookingStatusHistory,
  ({ one }) => ({
    booking: one(bookings, {
      fields: [bookingStatusHistory.bookingId],
      references: [bookings.id],
    }),
    changedByUser: one(users, {
      fields: [bookingStatusHistory.changedByUserId],
      references: [users.id],
    }),
  }),
);

export const ridesRelations = relations(rides, ({ one }) => ({
  booking: one(bookings, {
    fields: [rides.bookingId],
    references: [bookings.id],
  }),
  driver: one(drivers, {
    fields: [rides.driverId],
    references: [drivers.id],
  }),
  vehicle: one(vehicles, {
    fields: [rides.vehicleId],
    references: [vehicles.id],
  }),
}));

