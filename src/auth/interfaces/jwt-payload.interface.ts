export interface JwtPayload {
  sub: number;
  email: string;
  role: 'CUSTOMER' | 'DRIVER' | 'ADMIN';
  iat?: number;
  exp?: number;
}

export interface UserWithoutPassword {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'CUSTOMER' | 'DRIVER' | 'ADMIN';
  emailVerified: boolean;
  phoneVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
