import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const mockUser = {
    id: 1,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    role: 'CUSTOMER' as const,
    emailVerified: false,
    phoneVerified: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTokens = {
    accessToken: 'access.token.jwt',
    refreshToken: 'refresh.token.jwt',
    expiresIn: '1d',
  };

  const mockAuthService = {
    registerCustomer: jest.fn().mockResolvedValue({
      user: mockUser,
      tokens: mockTokens,
      message: 'Customer registered successfully',
    }),
    registerDriver: jest.fn().mockResolvedValue({
      user: { ...mockUser, id: 2, role: 'DRIVER' },
      driver: { id: 1, userId: 2, status: 'PENDING' },
      tokens: mockTokens,
      message: 'Driver registered successfully',
    }),
    login: jest.fn().mockResolvedValue({
      user: mockUser,
      tokens: mockTokens,
      message: 'Login successful',
    }),
    getProfile: jest.fn().mockResolvedValue({
      user: mockUser,
      driver: null,
    }),
    updateProfile: jest.fn().mockResolvedValue({ ...mockUser, firstName: 'Johnny' }),
    changePassword: jest.fn().mockResolvedValue({
      message: 'Password has been changed successfully',
    }),
    refreshToken: jest.fn().mockResolvedValue(mockTokens),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('customer/register', () => {
    it('should register customer via /auth/customer/register', async () => {
      const dto = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        password: 'Password123!',
      };

      const response = await controller.registerCustomer(dto);
      expect(response.user.email).toBe(dto.email);
      expect(response.tokens.accessToken).toBe('access.token.jwt');
      expect(mockAuthService.registerCustomer).toHaveBeenCalledWith(dto);
    });
  });

  describe('driver/register', () => {
    it('should register driver via /auth/driver/register', async () => {
      const dto = {
        firstName: 'Michael',
        lastName: 'Schumacher',
        email: 'michael@driver.com',
        phone: '+1987654321',
        password: 'DriverPassword123!',
        confirmPassword: 'DriverPassword123!',
        yearsOfExperience: 5,
      };

      const response = await controller.registerDriver(dto);
      expect(response.user.role).toBe('DRIVER');
      expect(mockAuthService.registerDriver).toHaveBeenCalledWith(dto);
    });
  });

  describe('login', () => {
    it('should login via /auth/login', async () => {
      const dto = { email: 'john.doe@example.com', password: 'Password123!' };
      const response = await controller.login(dto);
      expect(response.user.id).toBe(1);
      expect(response.tokens).toBeDefined();
      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
    });
  });

  describe('me', () => {
    it('should get authenticated profile via /auth/me', async () => {
      const response = await controller.getMe(1);
      expect(response.user.id).toBe(1);
      expect(response.user.email).toBe('john.doe@example.com');
      expect(mockAuthService.getProfile).toHaveBeenCalledWith(1);
    });
  });

  describe('updateProfile', () => {
    it('should update profile via /auth/profile', async () => {
      const response = await controller.updateProfile(1, { firstName: 'Johnny' });
      expect(response.firstName).toBe('Johnny');
      expect(mockAuthService.updateProfile).toHaveBeenCalledWith(1, {
        firstName: 'Johnny',
      });
    });
  });

  describe('changePassword', () => {
    it('should call authService changePassword via /auth/change-password', async () => {
      const response = await controller.changePassword(1, {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      });
      expect(response.message).toBe('Password has been changed successfully');
    });
  });

  describe('refreshToken', () => {
    it('should return fresh tokens via /auth/refresh', async () => {
      const response = await controller.refreshToken({
        refreshToken: 'valid.token',
      });
      expect(response.accessToken).toBe('access.token.jwt');
    });
  });
});
