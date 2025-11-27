import admin from 'firebase-admin';
import * as Buffer from 'buffer';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    const SERVICE_ACCOUNT_BASE64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    
    if (!SERVICE_ACCOUNT_BASE64) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is not set');
    }

    // Decode base64 to get service account JSON
    const serviceAccountJson = Buffer.Buffer.from(SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(serviceAccountJson);

    // Fix the private key (replace \n with actual newlines)
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    // Get storage bucket name from env or use default (project-id.appspot.com)
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`;

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      storageBucket: storageBucket,
    });

    // Enable ignoreUndefinedProperties for Firestore (safeguard against undefined values)
    const firestore = admin.firestore();
    firestore.settings({ ignoreUndefinedProperties: true });

    console.log('Firebase Admin SDK initialized successfully');
    console.log(`Project ID: ${serviceAccount.project_id}`);
    console.log(`Storage Bucket: ${storageBucket}`);
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    throw error;
  }
}

export default admin;