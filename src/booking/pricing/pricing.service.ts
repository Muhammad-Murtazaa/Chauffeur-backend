import { Injectable } from '@nestjs/common';

export interface VehicleTypeRateCard {
  id: number;
  category: string;
  name: string;
  baseFare: number;
  pricePerDistance: number; // per km
  pricePerMinute: number;
  minimumFare: number;
  hourlyRate: number;
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
}

@Injectable()
export class PricingService {
  /**
   * Calculate price snapshot for a specific vehicle type
   */
  calculatePrice(params: {
    vehicleType: VehicleTypeRateCard;
    distanceMeters: number;
    durationSeconds: number;
    bookingType?: string;
    hours?: number;
    pickupAt: Date;
    pickupAddress?: string;
    flightNumber?: string;
  }): PricingCalculationResult {
    const {
      vehicleType,
      distanceMeters,
      durationSeconds,
      bookingType = 'ONE_WAY',
      hours = 2,
      pickupAt,
      pickupAddress = '',
      flightNumber,
    } = params;

    const baseFare = Number(vehicleType.baseFare);
    const ratePerKm = Number(vehicleType.pricePerDistance);
    const ratePerMin = Number(vehicleType.pricePerMinute);
    const minFare = Number(vehicleType.minimumFare);
    const hourlyRate = Number(vehicleType.hourlyRate || 100);

    const distanceKm = distanceMeters / 1000;
    const durationMinutes = durationSeconds / 60;

    let basePrice = baseFare;
    let distancePrice = 0;
    let durationPrice = 0;
    let discount = 0;
    let surcharges = 0;
    const extras = 0;

    if (bookingType === 'HOURLY') {
      const billableHours = Math.max(2, hours || 2);
      basePrice = Math.round(billableHours * hourlyRate * 100) / 100;
      distancePrice = 0;
      durationPrice = 0;
    } else {
      distancePrice = Math.round(distanceKm * ratePerKm * 100) / 100;
      durationPrice = Math.round(durationMinutes * ratePerMin * 100) / 100;

      let subtotalRaw = baseFare + distancePrice + durationPrice;

      if (bookingType === 'RETURN') {
        subtotalRaw = subtotalRaw * 1.9; // 10% roundtrip discount built in
        discount = Math.round(subtotalRaw * 0.1 * 100) / 100;
      }

      if (subtotalRaw < minFare) {
        basePrice = minFare;
        distancePrice = 0;
        durationPrice = 0;
      }
    }

    // Surcharge 1: Airport Meet & Greet / Terminal fee
    const isAirport =
      pickupAddress.toLowerCase().includes('airport') ||
      pickupAddress.toLowerCase().includes('jfk') ||
      pickupAddress.toLowerCase().includes('lga') ||
      pickupAddress.toLowerCase().includes('ewr') ||
      Boolean(flightNumber);

    if (isAirport) {
      surcharges += 25.0; // Standard premium airport gate & luggage surcharge
    }

    // Surcharge 2: Night surcharge (10 PM to 6 AM)
    const pickupHour = new Date(pickupAt).getUTCHours();
    if (pickupHour >= 22 || pickupHour < 6) {
      const nightFee = Math.round((basePrice + distancePrice) * 0.15 * 100) / 100;
      surcharges += nightFee;
    }

    const calculatedSubtotal =
      basePrice + distancePrice + durationPrice + surcharges + extras - discount;

    // Tax calculation (8.875% NY sales tax standard or 0 for interstate)
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
    };
  }
}
