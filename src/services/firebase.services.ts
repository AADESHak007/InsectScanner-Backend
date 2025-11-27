import admin from 'firebase-admin';
import { Insect } from '../types/insect';

export class FirebaseService {
  private db = admin.firestore();
  
  async createInsect(data: Insect): Promise<string> {
    const docRef = await this.db.collection('insects').add({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
  }
  
  async getInsect(id: string): Promise<Insect | null> {
    const doc = await this.db.collection('insects').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as Insect : null;
  }
}