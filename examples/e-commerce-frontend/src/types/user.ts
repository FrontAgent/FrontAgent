export interface IUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  isVerified: boolean;
}

export interface IAuthInfo {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  scope?: string;
}

export interface ILoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface IRegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone?: string;
  acceptTerms: boolean;
  subscribeNewsletter?: boolean;
}

export interface IPasswordReset {
  email: string;
}

export interface IPasswordResetConfirm {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface IPasswordChange {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export type TPermission = 
  | 'read:products'
  | 'write:products'
  | 'delete:products'
  | 'read:orders'
  | 'write:orders'
  | 'delete:orders'
  | 'read:users'
  | 'write:users'
  | 'delete:users'
  | 'admin:access';

export type TRole = 'customer' | 'vendor' | 'admin' | 'super_admin';

export interface IRole {
  id: string;
  name: TRole;
  displayName: string;
  description: string;
  permissions: TPermission[];
  isSystem: boolean;
}

export interface IUserSession {
  user: IUser;
  auth: IAuthInfo;
  roles: IRole[];
  permissions: TPermission[];
}

export interface IUserProfileUpdate {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  avatar?: File;
}

export interface IUserAddress {
  id: string;
  userId: string;
  type: 'shipping' | 'billing';
  isDefault: boolean;
  firstName: string;
  lastName: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface IUserPreferences {
  language: string;
  currency: string;
  timezone: string;
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
    marketing: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'private';
    showOnlineStatus: boolean;
    allowDirectMessages: boolean;
  };
}

export interface IUserActivity {
  id: string;
  userId: string;
  type: 'login' | 'logout' | 'purchase' | 'view' | 'search' | 'review';
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

export interface IUserStats {
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate?: string;
  favoriteCategories: string[];
  loyaltyPoints: number;
  membershipLevel: 'bronze' | 'silver' | 'gold' | 'platinum';
}