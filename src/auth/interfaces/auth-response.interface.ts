import { UserWithoutPassword } from './jwt-payload.interface';
import { drivers } from '../../database';

export type DriverProfile = typeof drivers.$inferSelect;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string | number;
}

export interface AuthResponse {
  user: UserWithoutPassword;
  driver?: DriverProfile | null;
  tokens: AuthTokens;
  message?: string;
}

export interface UserProfileResponse {
  user: UserWithoutPassword;
  driver?: DriverProfile | null;
}
