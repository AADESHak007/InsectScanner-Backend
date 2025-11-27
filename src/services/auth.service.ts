import admin from 'firebase-admin';
import { RegisterRequest, LoginRequest, SocialLoginRequest, DeviceInfo } from '../types/user';
import { getOrCreateUser, createSessionCookie, checkDeletedAccountHistory, mapFirebaseError } from '../utils/auth.helpers';

const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || '';

/**
 * Derive platform from device_info.os
 */
function derivePlatform(deviceInfo?: DeviceInfo): 'PLAYSTORE' | 'APPSTORE' | 'MOBILE' | undefined {
  if (!deviceInfo?.os) {
    return undefined;
  }
  
  switch (deviceInfo.os) {
    case 'android':
      return 'PLAYSTORE';
    case 'ios':
      return 'APPSTORE';
    default:
      return 'MOBILE';
  }
}

export class AuthService {
  private auth = admin.auth();
  private db = admin.firestore();

  /**
   * Sign up with email and password
   */
  async signUp(data: RegisterRequest, ip?: string) {
    try {
      const { email, password, displayName, device_info } = data;
      
      // Derive platform from device_info.os
      const platform = derivePlatform(device_info);

      // Check if user already exists
      try {
        await this.auth.getUserByEmail(email);
        throw new Error('Email already registered');
      } catch (error: any) {
        if (error.code !== 'auth/user-not-found') {
          throw error;
        }
      }

      // Check deleted account history
      const wasDeleted = await checkDeletedAccountHistory(email);
      const isNewAccount = !wasDeleted;

      // Create user in Firebase Auth
      const userRecord = await this.auth.createUser({
        email,
        password,
        displayName,
      });

      // Create custom token
      const customToken = await this.auth.createCustomToken(userRecord.uid);

      // Exchange custom token for ID token using Identity Toolkit
      const idToken = await this.exchangeCustomTokenForIdToken(customToken);

      // Get or create user in Firestore
      const { dbUser, isNewUser } = await getOrCreateUser(userRecord.uid, {
        email,
        displayName,
        provider: 'email',
        platform,
        deviceInfo: device_info,
        ip,
      });

      // Create session cookie
      const sessionToken = await createSessionCookie(idToken);

      // Queue welcome email (implement separately if needed)
      if (isNewUser && isNewAccount) {
        // await queueWelcomeEmail(userRecord.uid);
      }

      return {
        user: dbUser,
        sessionToken,
        idToken,
        isNewUser,
      };
    } catch (error: any) {
      throw new Error(mapFirebaseError(error));
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(data: LoginRequest, ip?: string) {
    try {
      const { email, password, device_info } = data;
      
      // Derive platform from device_info.os
      const platform = derivePlatform(device_info);

      // Check if user exists (for better error messages)
      let userRecord;
      try {
        userRecord = await this.auth.getUserByEmail(email);
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          throw new Error('Email not found');
        }
        throw error;
      }

      // Verify password using Identity Toolkit REST API
      const idToken = await this.verifyPassword(email, password);

      // Verify the ID token
      const decodedToken = await this.auth.verifyIdToken(idToken);

      // Get or create user in Firestore
      const { dbUser } = await getOrCreateUser(decodedToken.uid, {
        email,
        provider: 'email',
        platform,
        deviceInfo: device_info,
        ip,
      });

      // Create session cookie
      const sessionToken = await createSessionCookie(idToken);

      return {
        user: dbUser,
        sessionToken,
        idToken,
      };
    } catch (error: any) {
      throw new Error(mapFirebaseError(error));
    }
  }

  /**
   * Social login (Google/Apple)
   */
  async socialLogin(data: SocialLoginRequest, ip?: string) {
    try {
      const { provider, idToken, firebaseIdToken, device_info } = data;
      
      // Derive platform from device_info.os
      const platform = derivePlatform(device_info);

      let decodedToken;
      let finalIdToken = firebaseIdToken;

      // Path A: Firebase ID token provided directly
      if (firebaseIdToken) {
        decodedToken = await this.auth.verifyIdToken(firebaseIdToken);
        finalIdToken = firebaseIdToken;
      }
      // Path B: Provider token - try verifying as Firebase token first
      else if (idToken) {
        try {
          decodedToken = await this.auth.verifyIdToken(idToken);
          finalIdToken = idToken;
        } catch {
          // Path C: Exchange provider token for Firebase token
          finalIdToken = await this.exchangeProviderToken(idToken, provider);
          decodedToken = await this.auth.verifyIdToken(finalIdToken);
        }
      } else {
        throw new Error('Either idToken or firebaseIdToken must be provided');
      }

      // Get user info from decoded token
      const email = decodedToken.email || '';
      const displayName = decodedToken.name || undefined;
      const photoURL = decodedToken.picture || undefined;

      // Get or create user in Firestore
      const { dbUser, isNewUser } = await getOrCreateUser(decodedToken.uid, {
        email,
        displayName,
        photoURL,
        provider: provider === 'google' ? 'google' : 'apple',
        platform,
        deviceInfo: device_info,
        ip,
      });

      // Create session cookie
      const sessionToken = await createSessionCookie(finalIdToken);

      // Queue welcome email for new users
      if (isNewUser) {
        // await queueWelcomeEmail(decodedToken.uid);
      }

      return {
        user: dbUser,
        sessionToken,
        idToken: finalIdToken,
        isNewUser,
      };
    } catch (error: any) {
      throw new Error(mapFirebaseError(error));
    }
  }

  /**
   * Exchange custom token for ID token using Identity Toolkit
   */
  private async exchangeCustomTokenForIdToken(customToken: string): Promise<string> {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: customToken,
          returnSecureToken: true,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to exchange token');
    }

    return data.idToken;
  }

  /**
   * Verify password using Identity Toolkit REST API
   */
  private async verifyPassword(email: string, password: string): Promise<string> {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorCode = data.error?.message || '';
      if (errorCode.includes('EMAIL_NOT_FOUND')) {
        throw { code: 'EMAIL_NOT_FOUND' };
      }
      if (errorCode.includes('INVALID_PASSWORD')) {
        throw { code: 'INVALID_PASSWORD' };
      }
      throw new Error(data.error?.message || 'Login failed');
    }

    return data.idToken;
  }

  /**
   * Exchange provider token (Google/Apple) for Firebase ID token
   */
  private async exchangeProviderToken(idToken: string, provider: 'google' | 'apple'): Promise<string> {
    const providerId = provider === 'google' ? 'google.com' : 'apple.com';
    const postBody = `id_token=${idToken}&providerId=${providerId}`;

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postBody,
          requestUri: process.env.REQUEST_URI || 'com.insectscanner://', // Mobile app deep link or custom URL scheme
          returnSecureToken: true,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to exchange provider token');
    }

    return data.idToken;
  }
}