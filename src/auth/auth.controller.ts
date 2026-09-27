import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  RegisterCustomerDto,
  RegisterDriverDto,
  LoginDto,
  UpdateProfileDto,
  ChangePasswordDto,
  RefreshTokenDto,
} from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { UserWithoutPassword } from './interfaces/jwt-payload.interface';
import {
  AuthResponse,
  AuthTokens,
  UserProfileResponse,
} from './interfaces/auth-response.interface';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new Customer
   * POST /auth/customer/register
   */
  @Public()
  @Post('customer/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register Customer',
    description: 'Registers a new user with CUSTOMER role and returns JWT tokens.',
  })
  @ApiResponse({
    status: 201,
    description: 'Customer registered successfully. Returns user data and JWT tokens.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed (e.g. invalid email format, short password).',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Email or phone number already in use.',
  })
  async registerCustomer(@Body() dto: RegisterCustomerDto): Promise<AuthResponse> {
    return this.authService.registerCustomer(dto);
  }

  /**
   * Register a new Driver / Chauffeur
   * POST /auth/driver/register
   */
  @Public()
  @Post('driver/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register Driver / Chauffeur',
    description:
      'Registers a new user with DRIVER role, initializes driver profile in PENDING state, and returns JWT tokens.',
  })
  @ApiResponse({
    status: 201,
    description: 'Driver registered successfully. Returns user, driver profile, and JWT tokens.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or password confirmation mismatch.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Email or phone number already in use.',
  })
  async registerDriver(@Body() dto: RegisterDriverDto): Promise<AuthResponse> {
    return this.authService.registerDriver(dto);
  }

  /**
   * Login (Customer, Driver, or Admin)
   * POST /auth/login
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User Login',
    description:
      'Authenticates user (Customer, Driver, or Admin) with email and password and returns JWT access & refresh tokens.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful. Returns user profile, driver info (if driver), & JWT tokens.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid email or password.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Account inactive or deactivated.',
  })
  async login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  /**
   * Refresh JWT Tokens
   * POST /auth/refresh
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh JWT Tokens',
    description: 'Generates new access and refresh tokens using a valid refresh token.',
  })
  @ApiResponse({
    status: 200,
    description: 'New tokens issued successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token.',
  })
  async refreshToken(@Body() dto: RefreshTokenDto): Promise<AuthTokens> {
    return this.authService.refreshToken(dto.refreshToken);
  }

  /**
   * Get Current Authenticated User Profile
   * GET /auth/me
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get Current Profile',
    description: 'Returns profile details of the authenticated user (and driver details if role is DRIVER).',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile data retrieved successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token.',
  })
  async getMe(
    @CurrentUser('id') userId: number,
  ): Promise<UserProfileResponse> {
    return this.authService.getProfile(userId);
  }

  /**
   * Update Profile
   * PATCH /auth/profile
   */
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update User Profile',
    description: 'Allows authenticated users to update first name, last name, and phone number.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Updated phone number is already used by another user.',
  })
  async updateProfile(
    @CurrentUser('id') userId: number,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserWithoutPassword> {
    return this.authService.updateProfile(userId, dto);
  }

  /**
   * Change Password
   * POST /auth/change-password
   */
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Change Password',
    description: 'Changes user password by verifying the current password.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Current password incorrect or new password identical.',
  })
  async changePassword(
    @CurrentUser('id') userId: number,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.changePassword(userId, dto);
  }
}
