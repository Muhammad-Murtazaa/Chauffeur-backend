import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { DRIZZLE, users, drivers } from '../database';
import type { DrizzleDb } from '../database';
import {
  RegisterCustomerDto,
  RegisterDriverDto,
  LoginDto,
  UpdateProfileDto,
  ChangePasswordDto,
} from './dto';
import { JwtPayload, UserWithoutPassword } from './interfaces/jwt-payload.interface';
import {
  AuthResponse,
  AuthTokens,
  UserProfileResponse,
  DriverProfile,
} from './interfaces/auth-response.interface';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtRefreshExpiresIn: string;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret =
      this.configService.get<string>('JWT_SECRET') ||
      'default-chauffeur-jwt-secret-key-change-in-env';
    this.jwtExpiresIn =
      this.configService.get<string>('JWT_EXPIRES_IN') || '1d';
    this.jwtRefreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'default-chauffeur-jwt-refresh-secret-key-change-in-env';
    this.jwtRefreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
  }

  /**
   * Register a new Customer
   */
  async registerCustomer(dto: RegisterCustomerDto): Promise<AuthResponse> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedPhone = dto.phone.trim();

    // Check if email already exists
    const existingEmail = await this.db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });

    if (existingEmail) {
      throw new ConflictException('An account with this email already exists');
    }

    // Check if phone already exists
    const existingPhone = await this.db.query.users.findFirst({
      where: eq(users.phone, normalizedPhone),
    });

    if (existingPhone) {
      throw new ConflictException(
        'An account with this phone number already exists',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const [newUser] = await this.db
      .insert(users)
      .values({
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        passwordHash,
        role: 'CUSTOMER',
        emailVerified: false,
        phoneVerified: false,
        isActive: true,
      })
      .returning();

    const sanitizedUser = this.sanitizeUser(newUser);
    const tokens = await this.generateTokens(newUser);

    return {
      user: sanitizedUser,
      tokens,
      message: 'Customer registered successfully',
    };
  }

  /**
   * Register a new Driver/Chauffeur
   */
  async registerDriver(dto: RegisterDriverDto): Promise<AuthResponse> {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Password and Confirm Password do not match');
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedPhone = dto.phone.trim();

    // Check if email already exists
    const existingEmail = await this.db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });

    if (existingEmail) {
      throw new ConflictException('An account with this email already exists');
    }

    // Check if phone already exists
    const existingPhone = await this.db.query.users.findFirst({
      where: eq(users.phone, normalizedPhone),
    });

    if (existingPhone) {
      throw new ConflictException(
        'An account with this phone number already exists',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create user record with DRIVER role and driver record
    const [newUser] = await this.db
      .insert(users)
      .values({
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        passwordHash,
        role: 'DRIVER',
        emailVerified: false,
        phoneVerified: false,
        isActive: true,
      })
      .returning();

    const [newDriver] = await this.db
      .insert(drivers)
      .values({
        userId: newUser.id,
        status: 'PENDING',
        verificationStatus: 'PENDING',
        availabilityStatus: 'OFFLINE',
        dateOfBirth: dto.dateOfBirth || null,
        address: dto.address || null,
        city: dto.city || null,
        yearsOfExperience: dto.yearsOfExperience ?? 0,
      })
      .returning();

    const sanitizedUser = this.sanitizeUser(newUser);
    const tokens = await this.generateTokens(newUser);

    return {
      user: sanitizedUser,
      driver: newDriver,
      tokens,
      message:
        'Driver registered successfully. Please complete your verification and vehicle submission.',
    };
  }

  /**
   * Unified Login for Customers, Drivers, and Admins
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await this.db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException(
        'Your account has been deactivated. Please contact support.',
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    let driverProfile: DriverProfile | null = null;
    if (user.role === 'DRIVER') {
      driverProfile =
        (await this.db.query.drivers.findFirst({
          where: eq(drivers.userId, user.id),
        })) || null;
    }

    const sanitizedUser = this.sanitizeUser(user);
    const tokens = await this.generateTokens(user);

    return {
      user: sanitizedUser,
      driver: driverProfile,
      tokens,
      message: 'Login successful',
    };
  }

  /**
   * Get current authenticated user profile
   */
  async getProfile(userId: number): Promise<UserProfileResponse> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let driverProfile: DriverProfile | null = null;
    if (user.role === 'DRIVER') {
      driverProfile =
        (await this.db.query.drivers.findFirst({
          where: eq(drivers.userId, user.id),
        })) || null;
    }

    return {
      user: this.sanitizeUser(user),
      driver: driverProfile,
    };
  }

  /**
   * Update authenticated user basic profile
   */
  async updateProfile(
    userId: number,
    dto: UpdateProfileDto,
  ): Promise<UserWithoutPassword> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: Partial<typeof users.$inferInsert> = {};

    if (dto.firstName !== undefined) {
      updateData.firstName = dto.firstName.trim();
    }

    if (dto.lastName !== undefined) {
      updateData.lastName = dto.lastName.trim();
    }

    if (dto.phone !== undefined) {
      const normalizedPhone = dto.phone.trim();
      if (normalizedPhone !== user.phone) {
        const existingPhone = await this.db.query.users.findFirst({
          where: eq(users.phone, normalizedPhone),
        });

        if (existingPhone && existingPhone.id !== userId) {
          throw new ConflictException(
            'This phone number is already registered to another account',
          );
        }

        updateData.phone = normalizedPhone;
        updateData.phoneVerified = false;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return this.sanitizeUser(user);
    }

    updateData.updatedAt = new Date();

    const [updatedUser] = await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    return this.sanitizeUser(updatedUser);
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isCurrentValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentValid) {
      throw new BadRequestException('Current password does not match');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);

    await this.db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return { message: 'Password has been changed successfully' };
  }

  /**
   * Refresh access and refresh tokens
   */
  async refreshToken(refreshTokenStr: string): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshTokenStr, {
        secret: this.jwtRefreshSecret,
      });

      const user = await this.db.query.users.findFirst({
        where: eq(users.id, payload.sub),
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User account is invalid or deactivated');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Generate Access and Refresh JWT tokens
   */
  async generateTokens(user: {
    id: number;
    email: string;
    role: 'CUSTOMER' | 'DRIVER' | 'ADMIN';
  }): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.jwtSecret,
        expiresIn: this.jwtExpiresIn as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.jwtRefreshSecret,
        expiresIn: this.jwtRefreshExpiresIn as any,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.jwtExpiresIn,
    };
  }

  /**
   * Helper: Strips passwordHash and returns sanitized user
   */
  sanitizeUser(user: typeof users.$inferSelect): UserWithoutPassword {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
