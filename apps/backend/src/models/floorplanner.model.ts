import { z } from 'zod';

export const floorplannerProvisionSchema = z.object({
  user: z.object({
    email: z.string().email().optional(),
    name: z.string().min(1).max(255).optional(),
    externalIdentifier: z.string().min(1).max(255).optional(),
  }).optional(),
  project: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional(),
    externalIdentifier: z.string().min(1).max(255).optional(),
  }).optional(),
}).optional();

export const floorplannerGenerateDrawingSchema = z.object({
  bedroomCount: z.number().int().min(1).max(10),
  area: z.number().min(20).max(1000),
  kitchenType: z.enum(['open', 'closed']),
  extras: z.array(z.enum([
    'balcony',
    'homeOffice',
    'laundryRoom',
    'storage',
    'walkInCloset',
    'terrace',
  ])).default([]),
  bathroomCount: z.number().int().min(1).max(8).optional(),
  propertyType: z.enum(['apartment', 'villa', 'office']).optional(),
  floorCount: z.number().int().min(1).max(50).optional(),
});

export type FloorplannerProvisionRequest = z.infer<typeof floorplannerProvisionSchema>;
export type FloorplannerGenerateDrawingRequest = z.infer<typeof floorplannerGenerateDrawingSchema>;
