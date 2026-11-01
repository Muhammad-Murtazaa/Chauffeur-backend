import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database';
import type { DrizzleDb } from '../../database';
import { routePricing, vehicleTypes } from '../../database/schema';

export interface VehicleTypeRateCard {
  id: number;
  category: string;
  name: string;
  baseFare: number;
  pricePerDistance: number; // per km
  pricePerMinute: number;
  minimumFare: number;
  hourlyRate: number;
  minimumHours: number;
}

export interface PricingCalculationResult {
  basePrice: number;
  distancePrice: number;
  durationPrice: number;
  surcharges: number;
  extras: number;
  discount: number;
  tax: number;
  totalPrice: number;
  /** Name of the matched flat-rate route, if any */
  matchedRoute: string | null;
}

interface RoutePricingRow {
  id: number;
  routeName: string;
  originKeywords: string;
  destinationKeywords: string;
  vehicleTypeId: number;
  flatPrice: string;
  isBidirectional: boolean;
  isActive: boolean;
}

@Injectable()
export class PricingService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  /**
   * Load all active route pricing rules from the database
   */
  private async getActiveRoutePricing(): Promise<RoutePricingRow[]> {
    return this.db
      .select()
      .from(routePricing)
      .where(eq(routePricing.isActive, true)) as any;
  }

  /**
   * Check if an address matches any of the comma-separated keywords
   */
  private matchesKeywords(address: string, keywordsStr: string): boolean {
    if (!address || !keywordsStr) return false;
    const lower = address.toLowerCase();
    const keywords = keywordsStr.split(',').map((k) => k.trim()).filter(Boolean);
    return keywords.some((keyword) => lower.includes(keyword));
  }

  /**
   * Find a flat-rate price for a given route + vehicle type.
   * Checks both forward and reverse (bidirectional) matches.
   */
  private findRouteMatch(
    routes: RoutePricingRow[],
    pickupAddress: string,
    dropoffAddress: string,
    vehicleTypeId: number,
  ): { flatPrice: number; routeName: string } | null {
    for (const route of routes) {
      if (route.vehicleTypeId !== vehicleTypeId) continue;

      // Forward match: pickup matches origin, dropoff matches destination
      const forwardMatch =
        this.matchesKeywords(pickupAddress, route.originKeywords) &&
        this.matchesKeywords(dropoffAddress, route.destinationKeywords);

      if (forwardMatch) {
        return { flatPrice: Number(route.flatPrice), routeName: route.routeName };
      }

      // Bidirectional reverse match: pickup matches destination, dropoff matches origin
      if (route.isBidirectional) {
        const reverseMatch =
          this.matchesKeywords(pickupAddress, route.destinationKeywords) &&
          this.matchesKeywords(dropoffAddress, route.originKeywords);

        if (reverseMatch) {
          return { flatPrice: Number(route.flatPrice), routeName: route.routeName };
        }
      }
    }

    return null;
  }

  /**
   * Calculate price snapshot for a specific vehicle type.
   *
   * Priority:
   *  1. HOURLY bookings → use vehicleType.hourlyRate × hours
   *  2. Flat-rate route match → use route_pricing.flat_price
   *  3. Fallback → distance-based calculation (baseFare + mileage + time)
   */
  async calculatePrice(params: {
    vehicleType: VehicleTypeRateCard;
    distanceMeters: number;
    durationSeconds: number;
    bookingType?: string;
    hours?: number;
    pickupAt: Date;
    pickupAddress?: string;
    dropoffAddress?: string;
    flightNumber?: string;
  }): Promise<PricingCalculationResult> {
    const {
      vehicleType,
      distanceMeters,
      durationSeconds,
      bookingType = 'ONE_WAY',
      hours = 2,
      pickupAt,
      pickupAddress = '',
      dropoffAddress = '',
      flightNumber,
    } = params;

    const hourlyRate = Number(vehicleType.hourlyRate || 100);
    const minimumHours = Number(vehicleType.minimumHours || 2);

    let basePrice = 0;
    let distancePrice = 0;
    let durationPrice = 0;
    let discount = 0;
    let surcharges = 0;
    const extras = 0;
    let matchedRoute: string | null = null;

    if (bookingType === 'HOURLY') {
      // ─── HOURLY BOOKING ───────────────────────────────
      const billableHours = Math.max(minimumHours, hours || minimumHours);
      basePrice = Math.round(billableHours * hourlyRate * 100) / 100;
    } else {
      // ─── POINT-TO-POINT / AIRPORT ─────────────────────
      // Try to find a flat-rate route match first
      const activeRoutes = await this.getActiveRoutePricing();
      const routeMatch = this.findRouteMatch(
        activeRoutes,
        pickupAddress,
        dropoffAddress,
        vehicleType.id,
      );

      if (routeMatch) {
        // Flat-rate route matched
        basePrice = routeMatch.flatPrice;
        matchedRoute = routeMatch.routeName;
        distancePrice = 0;
        durationPrice = 0;
      } else {
        // Fallback: distance-based calculation
        const baseFare = Number(vehicleType.baseFare);
        const ratePerKm = Number(vehicleType.pricePerDistance);
        const ratePerMin = Number(vehicleType.pricePerMinute);
        const minFare = Number(vehicleType.minimumFare);

        const distanceKm = distanceMeters / 1000;
        const durationMinutes = durationSeconds / 60;

        basePrice = baseFare;
        distancePrice = Math.round(distanceKm * ratePerKm * 100) / 100;
        durationPrice = Math.round(durationMinutes * ratePerMin * 100) / 100;

        const subtotalRaw = baseFare + distancePrice + durationPrice;

        if (subtotalRaw < minFare) {
          basePrice = minFare;
          distancePrice = 0;
          durationPrice = 0;
        }
      }

      // RETURN trip modifier (applies to both flat-rate and distance-based)
      if (bookingType === 'RETURN') {
        const subtotal = basePrice + distancePrice + durationPrice;
        const returnTotal = subtotal * 1.9; // 10% roundtrip discount
        discount = Math.round(subtotal * 0.1 * 100) / 100;
        basePrice = Math.round(returnTotal * 100) / 100;
        distancePrice = 0;
        durationPrice = 0;
      }
    }

    // ─── SURCHARGES ──────────────────────────────────────
    // Airport surcharge (only for non-flat-rate routes; flat rates already include airport fees)
    if (!matchedRoute) {
      const isAirport =
        pickupAddress.toLowerCase().includes('airport') ||
        pickupAddress.toLowerCase().includes('jfk') ||
        pickupAddress.toLowerCase().includes('lga') ||
        pickupAddress.toLowerCase().includes('ewr') ||
        Boolean(flightNumber);

      if (isAirport) {
        surcharges += 25.0; // Standard premium airport gate & luggage surcharge
      }
    }

    // Night surcharge (10 PM to 6 AM)
    const pickupHour = new Date(pickupAt).getUTCHours();
    if (pickupHour >= 22 || pickupHour < 6) {
      const nightFee = Math.round((basePrice + distancePrice) * 0.15 * 100) / 100;
      surcharges += nightFee;
    }

    const calculatedSubtotal =
      basePrice + distancePrice + durationPrice + surcharges + extras - discount;

    // Tax calculation (8.875% NY sales tax standard)
    const tax = Math.round(calculatedSubtotal * 0.08875 * 100) / 100;
    const totalPrice = Math.round((calculatedSubtotal + tax) * 100) / 100;

    return {
      basePrice: Math.round(basePrice * 100) / 100,
      distancePrice: Math.round(distancePrice * 100) / 100,
      durationPrice: Math.round(durationPrice * 100) / 100,
      surcharges: Math.round(surcharges * 100) / 100,
      extras: Math.round(extras * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      totalPrice,
      matchedRoute,
    };
  }
}
