import z from "zod";
export const insectSchema = z.object({
    name: z.string().min(1, "Name is required"),
    scientificName: z.string().min(1, "Scientific name is required"),
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
    location: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    }).optional(),
    confidence: z.number().min(0).max(1).optional(),
  });