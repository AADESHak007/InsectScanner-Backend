import { z } from 'zod';

// Device info schema
const deviceInfoSchema = z.object({
  os: z.enum(['ios', 'android'], {
    message: 'OS must be either "ios" or "android"',
  }),
  os_version: z.string().optional(),
  device_model: z.string().optional(),
  app_version: z.string().optional(),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  displayName: z.string().optional(),
  device_info: deviceInfoSchema.optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  device_info: deviceInfoSchema.optional(),
});

export const socialLoginSchema = z.object({
  provider: z.enum(['google', 'apple']),
  idToken: z.string().optional(),
  firebaseIdToken: z.string().optional(),
  device_info: deviceInfoSchema.optional(),
}).refine(
  (data) => data.idToken || data.firebaseIdToken,
  { message: 'Either idToken or firebaseIdToken must be provided' }
);