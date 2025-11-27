import { Timestamp } from 'firebase-admin/firestore';

export interface Insect {
  id?: string; // Firestore document ID
  name: string;
  scientificName: string;
  description?: string;
  imageUrl?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  detectedAt: Date | Timestamp;
  confidence?: number;
  userId?: string;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface InsectIdentificationRequest {
  image: Express.Multer.File;
  userId?: string;
}

export interface GeminiIdentificationResponse {
  name: string;
  scientificName: string;
  description: string;
  confidence?: number;
  additionalInfo?: {
    habitat?: string;
    behavior?: string;
    diet?: string;
    [key: string]: any;
  };
}

export interface InsectIdentificationResponse {
  id: string;
  name: string;
  scientificName: string;
  description: string;
  imageUrl: string;
  confidence?: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  detectedAt: Date;
  createdAt: Date;
}
