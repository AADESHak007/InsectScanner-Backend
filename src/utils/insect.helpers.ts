/**
 * Convert Firestore Timestamp to Date
 */
export function convertTimestamps(data: any): any {
  if (!data) return data;
  
  const converted = { ...data };
  
  // Convert Firestore Timestamp to Date
  if (converted.createdAt && converted.createdAt.toDate) {
    converted.createdAt = converted.createdAt.toDate();
  }
  
  if (converted.updatedAt && converted.updatedAt.toDate) {
    converted.updatedAt = converted.updatedAt.toDate();
  }
  
  if (converted.detectedAt && converted.detectedAt.toDate) {
    converted.detectedAt = converted.detectedAt.toDate();
  }
  
  return converted;
}

