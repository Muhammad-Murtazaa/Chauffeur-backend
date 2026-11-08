import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database';
import type { DrizzleDb } from '../../database';
import { routePricing } from '../../database/schema';

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
   * Unconfigured routes do not receive an estimated price.
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
    extraCharge?: number;
  }): Promise<PricingCalculationResult | null> {
    const {
      vehicleType,
      distanceMeters,
      durationSeconds,
      bookingType = 'ONE_WAY',
      hours = 2,
      pickupAt,
      pickupAddress = '',
      dropoffAddress = '',
      extraCharge = 0,
    } = params;

    const hourlyRate = Number(vehicleType.hourlyRate);
    const minimumHours = Number(vehicleType.minimumHours || 2);

    // There is no defined return-trip fare schedule, so leave it for a custom quote.
    if (bookingType === 'RETURN') return null;

    let basePrice = 0;
    let distancePrice = 0;
    let durationPrice = 0;
    let discount = 0;
    let surcharges = 0;
    const extras = Number(extraCharge) || 0;
    let matchedRoute: string | null = null;

    if (bookingType === 'HOURLY') {
      // ─── HOURLY BOOKING ───────────────────────────────
      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) return null;
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
        // Every point-to-point fare must come from an explicit flat-rate rule.
        // No distance/time fallback is permitted for customer quotes.
        return null;
      }

    }

    // ─── SURCHARGES ──────────────────────────────────────
    // Flat fares and hourly rates receive no automatic time, distance,
    // airport, or night adjustments.

    const calculatedSubtotal =
      basePrice + distancePrice + durationPrice + surcharges + extras - discount;

    // Display the configured fare without a calculated tax or surcharge.
    const tax = 0;
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
