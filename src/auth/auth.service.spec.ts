import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { DRIZZLE } from '../database';

describe('AuthService', () => {
  let service: AuthService;

  const mockUser = {
    id: 1,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    passwordHash: '$2a$12$eX4mP1eH4sH.vAl1d.pAssw0rdH4shF0rT3st1ngOnly...',
    role: 'CUSTOMER' as const,
    emailVerified: false,
    phoneVerified: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDriverUser = {
    id: 2,
    firstName: 'Michael',
    lastName: 'Schumacher',
    email: 'michael@driver.com',
    phone: '+1987654321',
    passwordHash: '$2a$12$eX4mP1eH4sH.vAl1d.pAssw0rdH4shF0rT3st1ngOnly...',
    role: 'DRIVER' as const,
    emailVerified: false,
    phoneVerified: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDriver = {
    id: 1,
    userId: 2,
    profileImageUrl: null,
    dateOfBirth: null,
    address: null,
    city: null,
    yearsOfExperience: 5,
    emergencyContactName: null,
    emergencyContactPhone: null,
    verificationStatus: 'PENDING' as const,
    status: 'PENDING' as const,
    availabilityStatus: 'OFFLINE' as const,
    verifiedBy: null,
    verifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDb = {
    query: {
      users: {
        findFirst: jest.fn(),
      },
      drivers: {
        findFirst: jest.fn(),
      },
    },
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn(),
      }),
    }),
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn(),
        }),
      }),
    }),
  };

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('mocked.jwt.token'),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        JWT_SECRET: 'test-jwt-secret',
        JWT_EXPIRES_IN: '1d',
        JWT_REFRESH_SECRET: 'test-jwt-refresh-secret',
        JWT_REFRESH_EXPIRES_IN: '7d',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerCustomer', () => {
    const registerDto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      password: 'StrongPassword123!',
    };

    it('should successfully register a customer and return user with tokens', async () => {
      mockDb.query.users.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      mockDb.insert().values().returning.mockResolvedValueOnce([mockUser]);

      const result = await service.registerCustomer(registerDto);

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(registerDto.email.toLowerCase());
      expect(result.user.role).toBe('CUSTOMER');
      expect((result.user as any).passwordHash).toBeUndefined();
      expect(result.tokens.accessToken).toBe('mocked.jwt.token');
      expect(result.tokens.refreshToken).toBe('mocked.jwt.token');
      expect(result.message).toBe('Customer registered successfully');
    });

    it('should throw ConflictException if email is already registered', async () => {
      mockDb.query.users.findFirst.mockResolvedValueOnce(mockUser);

      await expect(service.registerCustomer(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if phone is already registered', async () => {
      mockDb.query.users.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUser);

      await expect(service.registerCustomer(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('registerDriver', () => {
    const registerDriverDto = {
      firstName: 'Michael',
      lastName: 'Schumacher',
      email: 'michael@driver.com',
      phone: '+1987654321',
      password: 'DriverPassword123!',
      confirmPassword: 'DriverPassword123!',
      yearsOfExperience: 5,
    };

    it('should successfully register driver and create driver record in PENDING state', async () => {
      mockDb.query.users.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      mockDb
        .insert()
        .values()
        .returning.mockResolvedValueOnce([mockDriverUser])
        .mockResolvedValueOnce([mockDriver]);

      const result = await service.registerDriver(registerDriverDto);

      expect(result.user.role).toBe('DRIVER');
      expect(result.driver).toBeDefined();
      expect(result.driver?.verificationStatus).toBe('PENDING');
      expect(result.driver?.status).toBe('PENDING');
      expect(result.driver?.availabilityStatus).toBe('OFFLINE');
      expect(result.tokens.accessToken).toBe('mocked.jwt.token');
    });

    it('should throw BadRequestException if passwords do not match', async () => {
      await expect(
        service.registerDriver({
          ...registerDriverDto,
          confirmPassword: 'MismatchPassword!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if driver email already exists', async () => {
      mockDb.query.users.findFirst.mockResolvedValueOnce(mockDriverUser);

      await expect(
        service.registerDriver(registerDriverDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'michael@driver.com',
      password: 'CorrectPassword123!',
    };

    it('should successfully authenticate driver and return driver record', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword123!', 10);
      const userWithHash = { ...mockDriverUser, passwordHash: hashedPassword };

      mockDb.query.users.findFirst.mockResolvedValueOnce(userWithHash);
      mockDb.query.drivers.findFirst.mockResolvedValueOnce(mockDriver);

      const result = await service.login(loginDto);

      expect(result.user.email).toBe(loginDto.email);
      expect(result.user.role).toBe('DRIVER');
      expect(result.driver).toBeDefined();
      expect(result.tokens.accessToken).toBe('mocked.jwt.token');
    });

    it('should throw UnauthorizedException for unknown email', async () => {
      mockDb.query.users.findFirst.mockResolvedValueOnce(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hashedPassword = await bcrypt.hash('DifferentPassword!', 10);
      mockDb.query.users.findFirst.mockResolvedValueOnce({
        ...mockDriverUser,
        passwordHash: hashedPassword,
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw ForbiddenException if account is inactive', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword123!', 10);
      mockDb.query.users.findFirst.mockResolvedValueOnce({
        ...mockDriverUser,
        passwordHash: hashedPassword,
        isActive: false,
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile and driver record if role is DRIVER', async () => {
      mockDb.query.users.findFirst.mockResolvedValueOnce(mockDriverUser);
      mockDb.query.drivers.findFirst.mockResolvedValueOnce(mockDriver);

      const result = await service.getProfile(2);

      expect(result.user.id).toBe(2);
      expect(result.user.email).toBe(mockDriverUser.email);
      expect(result.driver).toBeDefined();
      expect(result.driver?.status).toBe('PENDING');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockDb.query.users.findFirst.mockResolvedValueOnce(null);

      await expect(service.getProfile(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should update profile fields successfully', async () => {
      mockDb.query.users.findFirst
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);

      const updated = { ...mockUser, firstName: 'Johnny', phone: '+1987654321' };
      mockDb.update().set().where().returning.mockResolvedValueOnce([updated]);

      const result = await service.updateProfile(1, {
        firstName: 'Johnny',
        phone: '+1987654321',
      });

      expect(result.firstName).toBe('Johnny');
    });

    it('should throw ConflictException if updated phone belongs to another user', async () => {
      mockDb.query.users.findFirst
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({ ...mockUser, id: 2, phone: '+1987654321' });

      await expect(
        service.updateProfile(1, { phone: '+1987654321' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const hashedPassword = await bcrypt.hash('CurrentPassword123!', 10);
      mockDb.query.users.findFirst.mockResolvedValueOnce({
        ...mockUser,
        passwordHash: hashedPassword,
      });
      mockDb.update().set().where.mockResolvedValueOnce([]);

      const result = await service.changePassword(1, {
        currentPassword: 'CurrentPassword123!',
        newPassword: 'BrandNewPassword123!',
      });

      expect(result.message).toBe('Password has been changed successfully');
    });

    it('should throw BadRequestException if current password is wrong', async () => {
      const hashedPassword = await bcrypt.hash('RealPassword123!', 10);
      mockDb.query.users.findFirst.mockResolvedValueOnce({
        ...mockUser,
        passwordHash: hashedPassword,
      });

      await expect(
        service.changePassword(1, {
          currentPassword: 'WrongPassword!',
          newPassword: 'BrandNewPassword123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens when valid refreshToken is provided', async () => {
      mockJwtService.verify.mockReturnValueOnce({
        sub: 1,
        email: 'john.doe@example.com',
        role: 'CUSTOMER',
      });
      mockDb.query.users.findFirst.mockResolvedValueOnce(mockUser);

      const result = await service.refreshToken('valid.refresh.token');

      expect(result.accessToken).toBe('mocked.jwt.token');
      expect(result.refreshToken).toBe('mocked.jwt.token');
    });

    it('should throw UnauthorizedException if refresh token is invalid', async () => {
      mockJwtService.verify.mockImplementationOnce(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refreshToken('invalid.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
