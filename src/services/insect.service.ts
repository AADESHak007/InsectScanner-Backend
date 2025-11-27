import admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Insect, InsectIdentificationRequest, GeminiIdentificationResponse, InsectIdentificationResponse } from '../types/insect';
import { convertTimestamps } from '../utils/insect.helpers';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export class InsectService {
  private db = admin.firestore();
  private storage = admin.storage();
  
  private getBucket() {
    // Get bucket name from env or use default bucket from initialized app
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    if (bucketName) {
      return this.storage.bucket(bucketName);
    }
    // Use default bucket (should be set in Firebase config)
    return this.storage.bucket();
  }

  /**
   * Convert image file to base64 for Gemini
   */
  private async convertImageToBase64(file: Express.Multer.File): Promise<string> {
    return file.buffer.toString('base64');
  }

  /**
   * Identify insect using Gemini API
   */
  private async identifyWithGemini(imageBase64: string, mimeType: string): Promise<GeminiIdentificationResponse> {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' }); // Using Gemini 2.5 Flash Lite - optimized for cost efficiency and low latency

      const prompt = `Analyze this insect image and provide identification details in the following JSON format:
{
  "name": "Common name of the insect",
  "scientificName": "Scientific name (genus species)",
  "description": "Detailed description of the insect including physical characteristics, size, color, etc.",
  "confidence": 0.95,
  "additionalInfo": {
    "habitat": "Where it's commonly found",
    "behavior": "Behavioral characteristics",
    "diet": "What it eats"
  }
}

Be accurate and detailed. If you're not confident, set confidence lower. Return ONLY valid JSON, no markdown formatting.`;

      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType,
        },
      };

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();

      // Parse JSON response (remove markdown code blocks if present)
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?/g, '');
      }

      const identification: GeminiIdentificationResponse = JSON.parse(jsonText);

      // Validate required fields
      if (!identification.name || !identification.scientificName) {
        throw new Error('Invalid response from Gemini API: missing required fields');
      }

      return identification;
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      throw new Error(`Failed to identify insect: ${error.message}`);
    }
  }

  /**
   * Upload image to Firebase Storage
   */
  private async uploadImageToStorage(
    file: Express.Multer.File,
    userId: string,
    insectId: string
  ): Promise<string> {
    try {
      const bucket = this.getBucket();
      const fileName = `insects/${userId}/${insectId}/${Date.now()}_${file.originalname}`;
      const fileRef = bucket.file(fileName);

      await fileRef.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
        },
        public: true,
      });

      // Make file publicly accessible
      await fileRef.makePublic();

      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      return publicUrl;
    } catch (error: any) {
      console.error('Storage upload error:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  /**
   * Save identification to Firestore
   */
  private async saveIdentificationToFirestore(
    identification: GeminiIdentificationResponse,
    imageUrl: string,
    userId: string | undefined
  ): Promise<string> {
    try {
      const insectData: Omit<Insect, 'id'> = {
        name: identification.name,
        scientificName: identification.scientificName,
        description: identification.description,
        imageUrl: imageUrl,
        confidence: identification.confidence,
        detectedAt: admin.firestore.FieldValue.serverTimestamp() as any,
        userId: userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as any,
      };

      // Remove undefined values
      const cleanData = Object.fromEntries(
        Object.entries(insectData).filter(([_, value]) => value !== undefined)
      );

      const docRef = await this.db.collection('insects').add(cleanData);
      return docRef.id;
    } catch (error: any) {
      console.error('Firestore save error:', error);
      throw new Error(`Failed to save identification: ${error.message}`);
    }
  }

  /**
   * Main method to identify insect
   */
  async identifyInsect(data: InsectIdentificationRequest): Promise<InsectIdentificationResponse> {
    try {
      const { image, userId } = data;

      // Step 1: Convert image to base64
      const imageBase64 = await this.convertImageToBase64(image);
      const mimeType = image.mimetype || 'image/jpeg';

      // Step 2: Identify with Gemini
      const identification = await this.identifyWithGemini(imageBase64, mimeType);

      // Step 3: Generate temporary ID for storage path
      const tempId = this.db.collection('_temp').doc().id;

      // Step 4: Upload image to Firebase Storage
      const imageUrl = await this.uploadImageToStorage(image, userId || 'anonymous', tempId);

      // Step 5: Save identification to Firestore
      const insectId = await this.saveIdentificationToFirestore(
        identification,
        imageUrl,
        userId
      );

      // Step 6: Fetch the created document to get timestamps
      const doc = await this.db.collection('insects').doc(insectId).get();
      const insectData = doc.data() as Insect;

      // Convert timestamps
      const convertedData = convertTimestamps({ ...insectData, id: insectId });

      return {
        id: insectId,
        name: convertedData.name,
        scientificName: convertedData.scientificName,
        description: convertedData.description || '',
        imageUrl: convertedData.imageUrl || '',
        confidence: convertedData.confidence,
        location: convertedData.location,
        detectedAt: convertedData.detectedAt as Date,
        createdAt: convertedData.createdAt as Date,
      };
    } catch (error: any) {
      console.error('Insect identification error:', error);
      throw new Error(error.message || 'Failed to identify insect');
    }
  }

  /**
   * Get user's insect identification history
   */
  async getUserHistory(userId: string): Promise<InsectIdentificationResponse[]> {
    try {
      const insectsRef = this.db.collection('insects');
      const snapshot = await insectsRef
        .where('userId', '==', userId)
        .orderBy('detectedAt', 'desc')
        .get();

      if (snapshot.empty) {
        return [];
      }

      const history: InsectIdentificationResponse[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data() as Insect;
        const convertedData = convertTimestamps({ ...data, id: doc.id });

        history.push({
          id: doc.id,
          name: convertedData.name,
          scientificName: convertedData.scientificName,
          description: convertedData.description || '',
          imageUrl: convertedData.imageUrl || '',
          confidence: convertedData.confidence,
          location: convertedData.location,
          detectedAt: convertedData.detectedAt as Date,
          createdAt: convertedData.createdAt as Date,
        });
      });

      return history;
    } catch (error: any) {
      console.error('Get history error:', error);
      throw new Error(`Failed to retrieve history: ${error.message}`);
    }
  }
}

