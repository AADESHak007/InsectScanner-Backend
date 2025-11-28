import admin from 'firebase-admin';
import { User, GetOrCreateUserOptions } from '../types/user';

export interface GetOrCreateUserResult {
  dbUser: User;
  isNewUser: boolean;
}

/**
 * Remove undefined values from object (Firestore doesn't accept undefined)
 */
function removeUndefined(obj: any): any {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  );
}

/**
 * Convert Firestore Timestamp to Date or ISO string
 */
function convertTimestamps(data: any): any {
  if (!data) return data;
  
  const converted = { ...data };
  
  // Convert Firestore Timestamp to Date
  if (converted.createdAt && converted.createdAt.toDate) {
    converted.createdAt = converted.createdAt.toDate();
  }
  
  if (converted.updatedAt && converted.updatedAt.toDate) {
    converted.updatedAt = converted.updatedAt.toDate();
  }
  
  if (converted.deletedAt && converted.deletedAt.toDate) {
    converted.deletedAt = converted.deletedAt.toDate();
  }
  
  return converted;
}

/**
 * Get or create user in Firestore
 */
export async function getOrCreateUser(
  uid: string,
  options?: GetOrCreateUserOptions
): Promise<GetOrCreateUserResult> {
  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();

  // Get Firebase Auth user
  const authUser = await admin.auth().getUser(uid);

  if (userDoc.exists) {
    // User exists - update if needed
    const existingUser = userDoc.data() as User;
    const updates: any = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Update profile image if provided and different
    if (options?.photoURL && existingUser.photoURL !== options.photoURL) {
      updates.photoURL = options.photoURL;
    }

    // Update display name if provided and different
    if (options?.displayName && existingUser.displayName !== options.displayName) {
      updates.displayName = options.displayName;
    }

    if (Object.keys(updates).length > 1) {
      await userRef.update(updates);
    }

    // Fetch the updated document to get actual timestamps
    const updatedDoc = await userRef.get();
    const updatedUser = updatedDoc.data() as User;
    
    // Convert timestamps before returning
    const convertedUser = convertTimestamps(updatedUser);

    return {
      dbUser: convertedUser as User,
      isNewUser: false,
    };
  } else {
    // New user - create document
    const newUser: any = {
      uid,
      email: options?.email || authUser.email || '',
      provider: options?.provider || 'email',
      searchCount: 0, // Initialize search count to 0
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Only add optional fields if they have values
    if (options?.displayName || authUser.displayName) {
      newUser.displayName = options?.displayName || authUser.displayName;
    }

    if (options?.photoURL || authUser.photoURL) {
      newUser.photoURL = options?.photoURL || authUser.photoURL;
    }

    // Remove undefined values before saving
    const cleanUser = removeUndefined(newUser);
    await userRef.set(cleanUser);

    // Create registration tracking (optional)
    if (options?.platform) {
      const registrationData: any = {
        uid,
        platform: options.platform,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (options.deviceInfo) {
        registrationData.deviceInfo = options.deviceInfo;
      }

      if (options.ip) {
        registrationData.ip = options.ip;
      }

      // Remove undefined values
      const cleanRegistration = removeUndefined(registrationData);
      await db.collection('registrations').add(cleanRegistration);
    }

    // Queue welcome email (you can implement this separately)
    // await queueWelcomeEmail(uid);

    // Fetch the created document to get actual timestamps
    const createdDoc = await userRef.get();
    const createdUser = createdDoc.data() as User;
    
    // Convert timestamps before returning
    const convertedUser = convertTimestamps(createdUser);

    return {
      dbUser: convertedUser as User,
      isNewUser: true,
    };
  }
}

/**
 * Get user by UID from Firestore
 */
export async function getUserByUid(uid: string): Promise<User | null> {
  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    return null;
  }

  const userData = userDoc.data() as User;
  const convertedUser = convertTimestamps(userData);
  
  // Ensure searchCount defaults to 0 if not set
  if (convertedUser.searchCount === undefined) {
    convertedUser.searchCount = 0;
  }
  
  return convertedUser as User;
}

/**
 * Increment user's search count
 */
export async function incrementUserSearchCount(uid: string): Promise<void> {
  if (!uid) {
    return; // Skip if no user ID
  }

  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    return; // User doesn't exist, skip
  }

  const userData = userDoc.data() as User;
  
  // If searchCount doesn't exist, set it to 1, otherwise increment
  if (userData.searchCount === undefined) {
    await userRef.update({
      searchCount: 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    // Use Firestore increment to atomically increment the count
    await userRef.update({
      searchCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

/**
 * Create session cookie from ID token
 */
export async function createSessionCookie(idToken: string): Promise<string> {
  // Verify the ID token
  const decodedToken = await admin.auth().verifyIdToken(idToken);

  // Create session cookie (5 days expiry)
  const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days in milliseconds
  const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });

  return sessionCookie;
}

/**
 * Check if user was previously deleted
 */
export async function checkDeletedAccountHistory(email: string): Promise<boolean> {
  const db = admin.firestore();
  const deletedUsers = await db
    .collection('deleted_users')
    .where('email', '==', email)
    .limit(1)
    .get();

  return !deletedUsers.empty;
}

/**
 * Map Firebase error codes to user-friendly messages
 */
export function mapFirebaseError(error: any): string {
  const errorCode = error?.code || error?.error?.message || '';

  const errorMap: Record<string, string> = {
    'auth/email-already-exists': 'Email already registered',
    'auth/invalid-email': 'Invalid email address',
    'auth/weak-password': 'Password is too weak',
    'EMAIL_NOT_FOUND': 'Email not found',
    'INVALID_PASSWORD': 'Invalid password',
    'INVALID_ID_TOKEN': 'Invalid authentication token',
    'auth/user-not-found': 'User not found',
    'auth/wrong-password': 'Invalid password',
  };

  return errorMap[errorCode] || error?.message || 'Authentication failed';
}