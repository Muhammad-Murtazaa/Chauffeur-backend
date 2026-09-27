import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, gt } from 'drizzle-orm';
import { DRIZZLE } from '../../database';
import type { DrizzleDb } from '../../database';
import {
  quotes,
  quoteVehicleOptions,
  vehicleTypes,
} from '../../database/schema';
import { RouteService } from '../route/route.service';
import { PricingService } from '../pricing/pricing.service';
import { CreateQuoteDto } from '../dto';

@Injectable()
export class QuoteService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly routeService: RouteService,
    private readonly pricingService: PricingService,
  ) {}

  /**
   * Create a 15-minute expiring quote with route calculation and vehicle options
   */
  async createQuote(dto: CreateQuoteDto, customerId?: number) {
    const pickupDate = new Date(dto.pickupAt);
    if (isNaN(pickupDate.getTime())) {
      throw new BadRequestException('Invalid pickup date provided.');
    }

    if (pickupDate.getTime() < Date.now() - 5 * 60 * 1000) {
      throw new BadRequestException('Pickup time cannot be in the past.');
    }

    // 1. Calculate route distance and duration
    const route = await this.routeService.calculateRoute({
      pickupAddress: dto.pickupAddress,
      pickupLat: dto.pickupLat,
      pickupLng: dto.pickupLng,
      dropoffAddress: dto.dropoffAddress,
      dropoffLat: dto.dropoffLat,
      dropoffLng: dto.dropoffLng,
      bookingType: dto.bookingType,
      hours: dto.hours,
    });

    // 2. Fetch all active vehicle types
    const activeVehicleTypes = await this.db
      .select()
      .from(vehicleTypes)
      .where(eq(vehicleTypes.isActive, true));

    if (!activeVehicleTypes.length) {
      throw new BadRequestException('No vehicle categories available for quoting.');
    }

    // Quote expires in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // 3. Insert Quote record
    const [insertedQuote] = await this.db
      .insert(quotes)
      .values({
        customerId: customerId || null,
        bookingType: dto.bookingType || 'ONE_WAY',
        pickupAddress: route.pickupFormattedAddress,
        pickupPlaceId: dto.pickupPlaceId || null,
        pickupLat: route.pickupLat ? String(route.pickupLat) : null,
        pickupLng: route.pickupLng ? String(route.pickupLng) : null,
        dropoffAddress: route.dropoffFormattedAddress,
        dropoffPlaceId: dto.dropoffPlaceId || null,
        dropoffLat: route.dropoffLat ? String(route.dropoffLat) : null,
        dropoffLng: route.dropoffLng ? String(route.dropoffLng) : null,
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        pickupAt: pickupDate,
        passengerCount: dto.passengerCount || 1,
        luggageCount: dto.luggageCount || 0,
        hours: dto.hours || 0,
        currency: dto.currency || 'USD',
        expiresAt,
      })
      .returning();

    // 4. Calculate options for each vehicle type and save
    const optionsToInsert = activeVehicleTypes.map((vt) => {
      const pricing = this.pricingService.calculatePrice({
        vehicleType: {
          id: vt.id,
          category: vt.category,
          name: vt.name,
          baseFare: Number(vt.baseFare),
          pricePerDistance: Number(vt.pricePerDistance),
          pricePerMinute: Number(vt.pricePerMinute),
          minimumFare: Number(vt.minimumFare),
          hourlyRate: Number(vt.hourlyRate),
        },
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        bookingType: dto.bookingType,
        hours: dto.hours,
        pickupAt: pickupDate,
        pickupAddress: dto.pickupAddress,
        flightNumber: dto.flightNumber,
      });

      return {
        quoteId: insertedQuote.id,
        vehicleTypeId: vt.id,
        category: vt.category,
        name: vt.name,
        basePrice: String(pricing.basePrice),
        distancePrice: String(pricing.distancePrice),
        durationPrice: String(pricing.durationPrice),
        surcharges: String(pricing.surcharges),
        extras: String(pricing.extras),
        discount: String(pricing.discount),
        tax: String(pricing.tax),
        totalPrice: String(pricing.totalPrice),
      };
    });

    const insertedOptions = await this.db
      .insert(quoteVehicleOptions)
      .values(optionsToInsert)
      .returning();

    // Merge vehicle metadata (capacity, image, etc.) into options
    const optionsWithDetails = insertedOptions.map((opt) => {
      const vt = activeVehicleTypes.find((v) => v.id === opt.vehicleTypeId);
      return {
        ...opt,
        passengerCapacity: vt?.passengerCapacity || 3,
        luggageCapacity: vt?.luggageCapacity || 2,
        description: vt?.description,
        imageUrl: vt?.imageUrl,
      };
    });

    return {
      quote: insertedQuote,
      route: {
        distanceMeters: route.distanceMeters,
        distanceKm: Math.round((route.distanceMeters / 1000) * 10) / 10,
        distanceMiles: Math.round((route.distanceMeters / 1609.34) * 10) / 10,
        durationSeconds: route.durationSeconds,
        durationMinutes: Math.round(route.durationSeconds / 60),
        encodedPolyline: route.encodedPolyline,
      },
      expiresAt: insertedQuote.expiresAt,
      expiresInSeconds: Math.round(
        (new Date(insertedQuote.expiresAt).getTime() - Date.now()) / 1000,
      ),
      vehicleOptions: optionsWithDetails,
    };
  }

  /**
   * Retrieve quote by ID and check expiration
   */
  async getQuote(quoteId: number) {
    const [quote] = await this.db
      .select()
      .from(quotes)
      .where(eq(quotes.id, quoteId));

    if (!quote) {
      throw new NotFoundException(`Quote with ID ${quoteId} not found.`);
    }

    const options = await this.db
      .select({
        id: quoteVehicleOptions.id,
        quoteId: quoteVehicleOptions.quoteId,
        vehicleTypeId: quoteVehicleOptions.vehicleTypeId,
        category: quoteVehicleOptions.category,
        name: quoteVehicleOptions.name,
        basePrice: quoteVehicleOptions.basePrice,
        distancePrice: quoteVehicleOptions.distancePrice,
        durationPrice: quoteVehicleOptions.durationPrice,
        surcharges: quoteVehicleOptions.surcharges,
        extras: quoteVehicleOptions.extras,
        discount: quoteVehicleOptions.discount,
        tax: quoteVehicleOptions.tax,
        totalPrice: quoteVehicleOptions.totalPrice,
        passengerCapacity: vehicleTypes.passengerCapacity,
        luggageCapacity: vehicleTypes.luggageCapacity,
        description: vehicleTypes.description,
        imageUrl: vehicleTypes.imageUrl,
      })
      .from(quoteVehicleOptions)
      .leftJoin(
        vehicleTypes,
        eq(quoteVehicleOptions.vehicleTypeId, vehicleTypes.id),
      )
      .where(eq(quoteVehicleOptions.quoteId, quoteId));

    const isExpired = new Date(quote.expiresAt).getTime() < Date.now();
    const expiresInSeconds = isExpired
      ? 0
      : Math.round(
          (new Date(quote.expiresAt).getTime() - Date.now()) / 1000,
        );

    return {
      quote,
      isExpired,
      expiresInSeconds,
      vehicleOptions: options,
    };
  }

  /**
   * Get all active vehicle categories and rate cards
   */
  async getVehicleTypes() {
    return this.db
      .select()
      .from(vehicleTypes)
      .where(eq(vehicleTypes.isActive, true));
  }
}
