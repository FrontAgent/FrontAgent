export interface Address {
  province: string;
  city: string;
  district: string;
  detail: string;
  zipCode?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  phone?: string;
  address?: Address;
}

export interface LoginCredentials {
  email: string;
  password: string;
}