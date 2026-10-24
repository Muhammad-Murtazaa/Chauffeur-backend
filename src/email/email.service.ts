import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface BookingEmailData {
  id: number;
  referenceNumber: string;
  bookingType: string;
  pickupAt: string | Date;
  passengerName: string;
  passengerEmail: string;
  passengerPhone: string;
  passengerCount: number;
  luggageCount: number;
  flightNumber?: string | null;
  specialInstructions?: string | null;
  totalPrice: string | number;
  currency: string;
  bookingStatus: string;
  paymentStatus: string;
  vehicleTypeName?: string;
  vehicleCategory?: string;
  stops?: Array<{
    type: string;
    address: string;
    sequence: number;
    estimatedArrival?: string | Date;
  }>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private readonly fromEmail: string;
  private readonly adminEmail: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey && !apiKey.includes('placeholder')) {
      this.resend = new Resend(apiKey);
      this.logger.log('Resend client initialized successfully.');
    } else {
      this.logger.warn(
        'RESEND_API_KEY is not configured or using placeholder. Emails will be logged to console.',
      );
    }

    this.fromEmail =
      this.configService.get<string>('RESEND_FROM_EMAIL') ||
      'NYC Premier Chauffeur <onboarding@resend.dev>';
    this.adminEmail =
      this.configService.get<string>('ADMIN_NOTIFICATION_EMAIL') ||
      'info@nycpremierlimo.com';
  }

  /**
   * Send booking confirmation email to customer
   */
  async sendBookingConfirmation(booking: BookingEmailData): Promise<boolean> {
    const pickupStop = booking.stops?.find((s) => s.type === 'PICKUP');
    const dropoffStop = booking.stops?.find((s) => s.type === 'DROPOFF');
    const pickupAddress = pickupStop?.address || 'Pickup location specified';
    const dropoffAddress = dropoffStop?.address || 'As Directed';

    const formattedDate = new Date(booking.pickupAt).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Booking Confirmation - ${booking.referenceNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1219; color: #f4f4f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background-color: #111a24; border-radius: 16px; overflow: hidden; border: 1px border #243243; }
    .header { background: linear-gradient(180deg, #060b10 0%, #111a24 100%); padding: 32px 24px; text-align: center; border-bottom: 2px solid #e09900; }
    .brand-eyebrow { color: #e09900; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px; }
    .brand-title { color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; }
    .content { padding: 32px 24px; }
    .ref-badge { display: inline-block; background-color: rgba(224, 153, 0, 0.15); border: 1px solid rgba(224, 153, 0, 0.35); color: #e09900; font-size: 13px; font-weight: 700; padding: 6px 14px; border-radius: 20px; margin-bottom: 20px; }
    .card { background-color: #182433; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .card-title { font-size: 13px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; margin-top: 0; margin-bottom: 12px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
    .info-label { color: #94a3b8; }
    .info-value { color: #ffffff; font-weight: 600; text-align: right; }
    .address-box { margin-bottom: 12px; }
    .dot-green { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #22c55e; margin-right: 6px; }
    .dot-gold { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #e09900; margin-right: 6px; }
    .total-box { background: rgba(224, 153, 0, 0.1); border: 1px solid rgba(224, 153, 0, 0.3); border-radius: 12px; padding: 18px; text-align: center; margin-top: 24px; }
    .total-amount { font-size: 28px; font-weight: 800; color: #e09900; margin: 4px 0 0 0; }
    .footer { text-align: center; padding: 24px; font-size: 12px; color: #64748b; background-color: #060b10; border-top: 1px solid #1e293b; }
    .footer a { color: #e09900; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand-eyebrow">NYC Premier Chauffeur</div>
      <h1 class="brand-title">Reservation Confirmed</h1>
    </div>

    <div class="content">
      <div style="text-align: center;">
        <span class="ref-badge">Booking Ref: ${booking.referenceNumber}</span>
      </div>

      <p style="font-size: 15px; line-height: 1.6; color: #e2e8f0; margin-top: 0;">
        Dear <strong>${booking.passengerName}</strong>,<br>
        Thank you for reserving with NYC Premier Chauffeur. Your luxury travel booking has been received and our dispatch team has reserved your vehicle.
      </p>

      <!-- Trip Itinerary Card -->
      <div class="card">
        <h3 class="card-title">Itinerary Details</h3>
        <div style="margin-bottom: 12px;">
          <div style="font-size: 12px; color: #94a3b8; margin-bottom: 4px;"><span class="dot-green"></span>PICKUP LOCATION</div>
          <div style="font-size: 14px; font-weight: 600; color: #ffffff;">${pickupAddress}</div>
        </div>
        <div style="margin-bottom: 12px;">
          <div style="font-size: 12px; color: #94a3b8; margin-bottom: 4px;"><span class="dot-gold"></span>DROP-OFF LOCATION</div>
          <div style="font-size: 14px; font-weight: 600; color: #ffffff;">${dropoffAddress}</div>
        </div>
        <div class="info-row" style="margin-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 12px;">
          <span class="info-label">Date & Time:</span>
          <span class="info-value">${formattedDate} (EST)</span>
        </div>
        ${
          booking.flightNumber
            ? `
        <div class="info-row">
          <span class="info-label">Flight Number:</span>
          <span class="info-value">${booking.flightNumber}</span>
        </div>`
            : ''
        }
      </div>

      <!-- Vehicle & Passenger Details Card -->
      <div class="card">
        <h3 class="card-title">Vehicle & Passenger</h3>
        <div class="info-row">
          <span class="info-label">Vehicle Category:</span>
          <span class="info-value">${booking.vehicleTypeName || booking.vehicleCategory || 'Executive Luxury'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Passengers:</span>
          <span class="info-value">${booking.passengerCount} Guests</span>
        </div>
        <div class="info-row">
          <span class="info-label">Luggage:</span>
          <span class="info-value">${booking.luggageCount} Bags</span>
        </div>
        <div class="info-row">
          <span class="info-label">Contact Phone:</span>
          <span class="info-value">${booking.passengerPhone}</span>
        </div>
        ${
          booking.specialInstructions
            ? `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08);">
          <div class="info-label" style="font-size: 12px; margin-bottom: 4px;">Special Instructions:</div>
          <div style="font-size: 13px; color: #cbd5e1; font-style: italic;">"${booking.specialInstructions}"</div>
        </div>`
            : ''
        }
      </div>

      <!-- Fare Summary -->
      <div class="total-box">
        <div style="font-size: 12px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 1px;">
          All-Inclusive Confirmed Fare
        </div>
        <div class="total-amount">$${Number(booking.totalPrice).toFixed(2)} ${booking.currency || 'USD'}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Tolls, airport fees & chauffeur gratuity included</div>
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0 0 8px 0;">Need to adjust your itinerary or flight details?</p>
      <p style="margin: 0 0 12px 0;">
        Call 24/7 Dispatch: <a href="tel:+13478889797">(347) 888-9797</a> &nbsp;|&nbsp; 
        <a href="https://wa.me/13478889797" target="_blank">Chat on WhatsApp</a>
      </p>
      <p style="font-size: 11px; color: #475569; margin: 0;">
        &copy; ${new Date().getFullYear()} NYC Premier Chauffeur. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendMail({
      to: booking.passengerEmail,
      subject: `Reservation Confirmed: ${booking.referenceNumber} | NYC Premier Chauffeur`,
      html: htmlContent,
    });
  }

  /**
   * Send notification to dispatch / admin team
   */
  async sendAdminBookingAlert(booking: BookingEmailData): Promise<boolean> {
    const pickupStop = booking.stops?.find((s) => s.type === 'PICKUP');
    const dropoffStop = booking.stops?.find((s) => s.type === 'DROPOFF');

    const formattedDate = new Date(booking.pickupAt).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const htmlContent = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; background: #f8fafc; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 24px;">
    <h2 style="color: #0f172a; margin-top: 0;">🚨 New Reservation Received</h2>
    <p>A new reservation has been booked via the platform portal:</p>
    <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
      <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;"><strong>Reference:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${booking.referenceNumber}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;"><strong>Passenger:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${booking.passengerName} (${booking.passengerPhone}, ${booking.passengerEmail})</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;"><strong>Date & Time:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${formattedDate} (EST)</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;"><strong>Pickup:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${pickupStop?.address || 'N/A'}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;"><strong>Dropoff:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${dropoffStop?.address || 'As Directed'}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;"><strong>Vehicle:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${booking.vehicleTypeName || booking.vehicleCategory || 'N/A'}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;"><strong>Total Fare:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #16a34a; font-weight: bold;">$${Number(booking.totalPrice).toFixed(2)} ${booking.currency || 'USD'}</td></tr>
      ${booking.flightNumber ? `<tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;"><strong>Flight:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${booking.flightNumber}</td></tr>` : ''}
      ${booking.specialInstructions ? `<tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;"><strong>Notes:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${booking.specialInstructions}</td></tr>` : ''}
    </table>
  </div>
</body>
</html>
    `;

    return this.sendMail({
      to: this.adminEmail,
      subject: `[NEW RESERVATION] ${booking.referenceNumber} - ${booking.passengerName} ($${Number(booking.totalPrice).toFixed(2)})`,
      html: htmlContent,
    });
  }

  /**
   * Send driver earnings notification email upon ride completion
   */
  async sendDriverPayoutNotification(data: {
    driverEmail: string;
    driverName: string;
    bookingReference: string;
    totalFare: number;
    driverEarnings: number;
    platformFee: number;
    currency: string;
    status: string;
  }): Promise<boolean> {
    const htmlContent = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b1219; color: #f4f4f5; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: #111a24; border-radius: 16px; border: 1px solid #243243; overflow: hidden;">
    <div style="background: #060b10; padding: 24px; text-align: center; border-bottom: 2px solid #e09900;">
      <div style="color: #e09900; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">Chauffeur Payout</div>
      <h2 style="color: #ffffff; margin: 6px 0 0 0;">Trip Earnings Processed</h2>
    </div>
    <div style="padding: 24px;">
      <p style="margin-top: 0; font-size: 15px; color: #cbd5e1;">Hello <strong>${data.driverName}</strong>,</p>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.5;">
        You have successfully completed ride <strong>${data.bookingReference}</strong>. Your earnings have been credited to your payout balance.
      </p>
      <div style="background: rgba(224, 153, 0, 0.1); border: 1px solid rgba(224, 153, 0, 0.3); border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
        <div style="font-size: 12px; text-transform: uppercase; color: #94a3b8; font-weight: bold;">Your Net Earnings (80%)</div>
        <div style="font-size: 32px; font-weight: 800; color: #e09900; margin-top: 4px;">$${data.driverEarnings.toFixed(2)} ${data.currency}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Total Trip Fare: $${data.totalFare.toFixed(2)} | Platform Fee: $${data.platformFee.toFixed(2)}</div>
      </div>
      <div style="font-size: 13px; color: #94a3b8; background: #182433; padding: 14px; border-radius: 8px;">
        Payout Status: <strong style="color: ${data.status === 'PAID' ? '#22c55e' : '#f59e0b'};">${data.status}</strong>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendMail({
      to: data.driverEmail,
      subject: `Earnings Confirmed: +$${data.driverEarnings.toFixed(2)} for Ride ${data.bookingReference}`,
      html: htmlContent,
    });
  }

  /**
   * Internal sender helper
   */
  private async sendMail(options: {
    to: string;
    subject: string;
    html: string;
  }): Promise<boolean> {
    if (!this.resend) {
      this.logger.log(
        `[Resend Mock Email Dispatch] To: ${options.to} | Subject: "${options.subject}" (configure RESEND_API_KEY in .env to send live emails)`,
      );
      return true;
    }

    try {
      const response = await this.resend.emails.send({
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      if (response.error) {
        this.logger.error(`Resend email error: ${response.error.message}`);
        return false;
      }

      this.logger.log(
        `Email successfully delivered via Resend. ID: ${response.data?.id} (To: ${options.to})`,
      );
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to send email via Resend: ${err?.message || err}`);
      return false;
    }
  }
}
