import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RouteCalculationResult {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline?: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  pickupFormattedAddress: string;
  dropoffFormattedAddress: string;
}

@Injectable()
export class RouteService {
  private readonly logger = new Logger(RouteService.name);
  private readonly googleMapsApiKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.googleMapsApiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY');
  }

  /**
   * Calculate distance, duration, and route polyline
   */
  async calculateRoute(params: {
    pickupAddress: string;
    pickupLat?: number;
    pickupLng?: number;
    dropoffAddress?: string;
    dropoffLat?: number;
    dropoffLng?: number;
    bookingType?: string;
    hours?: number;
  }): Promise<RouteCalculationResult> {
    const {
      pickupAddress,
      dropoffAddress,
      bookingType = 'ONE_WAY',
      hours = 2,
    } = params;

    let { pickupLat, pickupLng, dropoffLat, dropoffLng } = params;

    // Handle HOURLY bookings where dropoff is optional
    if (bookingType === 'HOURLY') {
      const durationSeconds = Math.max(2, hours || 2) * 3600;
      // Estimate 25 km per hour of hire
      const distanceMeters = Math.max(2, hours || 2) * 25000;
      return {
        distanceMeters,
        durationSeconds,
        pickupLat: pickupLat || 40.7128,
        pickupLng: pickupLng || -74.006,
        dropoffLat: dropoffLat || pickupLat || 40.7128,
        dropoffLng: dropoffLng || pickupLng || -74.006,
        pickupFormattedAddress: pickupAddress,
        dropoffFormattedAddress: dropoffAddress || 'As Directed (Hourly Chauffeur Service)',
      };
    }

    // Try Google Maps Directions API if API key is provided
    if (this.googleMapsApiKey) {
      try {
        const originParam = pickupLat && pickupLng
          ? `${pickupLat},${pickupLng}`
          : encodeURIComponent(pickupAddress);
        const destParam = dropoffLat && dropoffLng
          ? `${dropoffLat},${dropoffLng}`
          : encodeURIComponent(dropoffAddress || pickupAddress);

        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originParam}&destination=${destParam}&mode=driving&key=${this.googleMapsApiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.routes?.length > 0) {
          const route = data.routes[0];
          const leg = route.legs[0];

          return {
            distanceMeters: leg.distance?.value || 25000,
            durationSeconds: leg.duration?.value || 2400,
            encodedPolyline: route.overview_polyline?.points,
            pickupLat: leg.start_location?.lat || pickupLat,
            pickupLng: leg.start_location?.lng || pickupLng,
            dropoffLat: leg.end_location?.lat || dropoffLat,
            dropoffLng: leg.end_location?.lng || dropoffLng,
            pickupFormattedAddress: leg.start_address || pickupAddress,
            dropoffFormattedAddress: leg.end_address || (dropoffAddress || pickupAddress),
          };
        } else {
          this.logger.warn(`Google Maps Directions API returned status: ${data.status}`);
        }
      } catch (err: any) {
        this.logger.error(`Error querying Google Maps API: ${err.message}`);
      }
    }

    // Fallback: Geodesic route estimation with known Landmark dictionary and road factor
    const pickupCoords = this.resolveCoordinates(pickupAddress, pickupLat, pickupLng);
    const dropoffCoords = this.resolveCoordinates(
      dropoffAddress || 'New York, NY',
      dropoffLat,
      dropoffLng,
      true,
    );

    const distanceKm = this.calculateHaversineDistanceKm(
      pickupCoords.lat,
      pickupCoords.lng,
      dropoffCoords.lat,
      dropoffCoords.lng,
    );

    // Apply road tortuosity factor (1.35x straight line)
    const roadDistanceKm = Math.max(4.5, distanceKm * 1.35);
    const distanceMeters = Math.round(roadDistanceKm * 1000);

    // Speed calculation: 30 km/h in city, 55 km/h for longer trips
    const speedKmh = roadDistanceKm > 25 ? 52 : 32;
    const durationHours = roadDistanceKm / speedKmh;
    const durationSeconds = Math.max(900, Math.round(durationHours * 3600));

    return {
      distanceMeters,
      durationSeconds,
      pickupLat: pickupCoords.lat,
      pickupLng: pickupCoords.lng,
      dropoffLat: dropoffCoords.lat,
      dropoffLng: dropoffCoords.lng,
      pickupFormattedAddress: pickupAddress,
      dropoffFormattedAddress: dropoffAddress || 'Destination',
    };
  }

  private resolveCoordinates(
    address: string,
    lat?: number,
    lng?: number,
    isDropoff = false,
  ): { lat: number; lng: number } {
    if (lat !== undefined && lng !== undefined && lat !== 0 && lng !== 0) {
      return { lat, lng };
    }

    const lower = address.toLowerCase();

    // Landmark Dictionary for High Precision Fallbacks
    if (lower.includes('jfk') || lower.includes('kennedy')) {
      return { lat: 40.6413, lng: -73.7781 };
    }
    if (lower.includes('lga') || lower.includes('laguardia')) {
      return { lat: 40.7769, lng: -73.8740 };
    }
    if (lower.includes('ewr') || lower.includes('newark')) {
      return { lat: 40.6895, lng: -74.1745 };
    }
    if (lower.includes('manhattan') || lower.includes('midtown') || lower.includes('plaza')) {
      return { lat: 40.7589, lng: -73.9851 };
    }
    if (lower.includes('wall street') || lower.includes('financial district')) {
      return { lat: 40.7060, lng: -74.0088 };
    }
    if (lower.includes('brooklyn') || lower.includes('dumbo')) {
      return { lat: 40.6782, lng: -73.9442 };
    }
    if (lower.includes('queens')) {
      return { lat: 40.7282, lng: -73.7949 };
    }
    if (lower.includes('bronx')) {
      return { lat: 40.8448, lng: -73.8648 };
    }
    if (lower.includes('staten island')) {
      return { lat: 40.5795, lng: -74.1502 };
    }
    if (lower.includes('hamptons') || lower.includes('southampton')) {
      return { lat: 40.8843, lng: -72.3898 };
    }
    if (lower.includes('philadelphia')) {
      return { lat: 39.9526, lng: -75.1652 };
    }
    if (lower.includes('boston')) {
      return { lat: 42.3601, lng: -71.0589 };
    }

    // Default coordinates (NYC Metro Area with slight offset if dropoff)
    return isDropoff
      ? { lat: 40.7580, lng: -73.9855 }
      : { lat: 40.7128, lng: -74.0060 };
  }

  private calculateHaversineDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
