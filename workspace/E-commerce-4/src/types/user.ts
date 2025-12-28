export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  phone?: string;
  nickname?: string;
}

export interface Address {
  id: string;
  userId: string;
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  isDefault: boolean;
}