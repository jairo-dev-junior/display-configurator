import { z } from 'zod';

export const settingCodeSchema = z.string().min(1);

export const monitorMatchSchema = z.object({
  vendor: z.string().optional(),
  model: z.string().optional(),
  serial: z.string().optional(),
  bus: z.string().optional(),
  matchStrategy: z.enum(['vendor-model-serial', 'vendor-model', 'bus', 'manual'])
});

export const profileSchema = z.object({
  version: z.literal(1),
  profileName: z.string().min(1).max(120),
  createdAt: z.string().datetime(),
  monitor: monitorMatchSchema,
  settings: z.record(settingCodeSchema, z.number().int().min(0).max(255)),
  meta: z.object({
    appVersion: z.string(),
    notes: z.string().max(500).optional()
  })
});

export const capabilitySchema = z.object({
  code: z.string(),
  hexCode: z.string(),
  name: z.string(),
  currentValue: z.number().int().min(0).max(255).nullable(),
  maxValue: z.number().int().min(0).max(255).nullable(),
  writable: z.boolean(),
  supported: z.boolean()
});

export const monitorSchema = z.object({
  id: z.string(),
  bus: z.string(),
  displayName: z.string(),
  manufacturer: z.string().nullable(),
  model: z.string().nullable(),
  serial: z.string().nullable(),
  capabilities: z.array(capabilitySchema),
  available: z.boolean()
});

export type MonitorProfile = z.infer<typeof profileSchema>;
export type MonitorCapability = z.infer<typeof capabilitySchema>;
export type MonitorDevice = z.infer<typeof monitorSchema>;

export const appStateSchema = z.object({
  monitors: z.array(monitorSchema),
  profiles: z.array(profileSchema),
  diagnostics: z.object({
    ddcutilInstalled: z.boolean(),
    message: z.string().nullable()
  })
});

export type AppStatePayload = z.infer<typeof appStateSchema>;
