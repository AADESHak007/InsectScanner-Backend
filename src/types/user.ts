import { Timestamp } from 'firebase-admin/firestore';

export interface DeviceInfo {
  os: 'ios' | 'android'; // Required
  os_version?: string; // Optional
  device_model?: string; // Optional
  app_version?: string; // Optional
}

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  provider?: 'email' | 'google' | 'apple';
  searchCount?: number; // Number of successful insect identification searches
  deletedAt?: Date | Timestamp;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
  device_info?: DeviceInfo;
}

export interface LoginRequest {
  email: string;
  password: string;
  device_info?: DeviceInfo;
}

export interface SocialLoginRequest {
  provider: 'google' | 'apple';
  idToken?: string; // Provider token (Google/Apple)
  firebaseIdToken?: string; // Already exchanged Firebase token
  device_info?: DeviceInfo;
}

export interface GetOrCreateUserOptions {
  email?: string;
  displayName?: string;
  photoURL?: string;
  provider?: 'email' | 'google' | 'apple';
  platform?: string;
  deviceInfo?: DeviceInfo;
  ip?: string;
}