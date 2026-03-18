import { z } from "zod";

export const lotCreateSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be 255 characters or less"),
  address: z
    .string()
    .min(1, "Address is required")
    .max(500, "Address must be 500 characters or less"),
  totalSpaces: z
    .number()
    .int("Total spaces must be an integer")
    .min(1, "Total spaces must be at least 1")
    .max(100000, "Total spaces must be 100,000 or less"),
  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .optional()
    .nullable(),
  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .optional()
    .nullable(),
  description: z
    .string()
    .max(2000, "Description must be 2000 characters or less")
    .optional()
    .nullable(),
  isActive: z.boolean().default(true),
});

export const lotUpdateSchema = lotCreateSchema.partial().extend({
  id: z.string().uuid("Invalid lot ID"),
});

export const occupancySnapshotSchema = z.object({
  lotId: z.string().uuid("Invalid lot ID"),
  occupiedSpaces: z
    .number()
    .int("Occupied spaces must be an integer")
    .min(0, "Occupied spaces cannot be negative"),
  timestamp: z
    .string()
    .datetime("Invalid timestamp format")
    .optional()
    .transform((val) => (val ? new Date(val) : new Date())),
  source: z
    .enum(["manual", "sensor", "api", "estimated"], {
      errorMap: () => ({
        message: "Source must be one of: manual, sensor, api, estimated",
      }),
    })
    .default("manual"),
  notes: z
    .string()
    .max(1000, "Notes must be 1000 characters or less")
    .optional()
    .nullable(),
});

export const pricingRuleCreateSchema = z
  .object({
    lotId: z.string().uuid("Invalid lot ID"),
    name: z
      .string()
      .min(1, "Name is required")
      .max(255, "Name must be 255 characters or less"),
    ruleType: z.enum(["flat", "hourly", "dynamic", "tiered"], {
      errorMap: () => ({
        message: "Rule type must be one of: flat, hourly, dynamic, tiered",
      }),
    }),
    basePrice: z
      .number()
      .min(0, "Base price cannot be negative")
      .max(10000, "Base price must be 10,000 or less"),
    currency: z
      .string()
      .length(3, "Currency must be a 3-letter ISO code")
      .default("USD"),
    startTime: z
      .string()
      .regex(
        /^([01]\d|2[0-3]):([0-5]\d)$/,
        "Start time must be in HH:MM format",
      )
      .optional()
      .nullable(),
    endTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "End time must be in HH:MM format")
      .optional()
      .nullable(),
    daysOfWeek: z
      .array(
        z.number().int().min(0, "Day must be 0-6").max(6, "Day must be 0-6"),
      )
      .max(7, "Days of week cannot have more than 7 entries")
      .optional()
      .nullable(),
    occupancyThresholdMin: z
      .number()
      .min(0, "Occupancy threshold minimum cannot be negative")
      .max(100, "Occupancy threshold minimum cannot exceed 100")
      .optional()
      .nullable(),
    occupancyThresholdMax: z
      .number()
      .min(0, "Occupancy threshold maximum cannot be negative")
      .max(100, "Occupancy threshold maximum cannot exceed 100")
      .optional()
      .nullable(),
    priceMultiplier: z
      .number()
      .min(0, "Price multiplier cannot be negative")
      .max(100, "Price multiplier must be 100 or less")
      .optional()
      .nullable(),
    maxDailyPrice: z
      .number()
      .min(0, "Max daily price cannot be negative")
      .max(100000, "Max daily price must be 100,000 or less")
      .optional()
      .nullable(),
    isActive: z.boolean().default(true),
    priority: z
      .number()
      .int("Priority must be an integer")
      .min(0, "Priority cannot be negative")
      .max(1000, "Priority must be 1000 or less")
      .default(0),
  })
  .refine(
    (data) => {
      if (
        data.occupancyThresholdMin !== null &&
        data.occupancyThresholdMin !== undefined &&
        data.occupancyThresholdMax !== null &&
        data.occupancyThresholdMax !== undefined
      ) {
        return data.occupancyThresholdMin <= data.occupancyThresholdMax;
      }
      return true;
    },
    {
      message:
        "Occupancy threshold minimum must be less than or equal to maximum",
      path: ["occupancyThresholdMin"],
    },
  )
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return data.startTime <= data.endTime;
      }
      return true;
    },
    {
      message: "Start time must be before or equal to end time",
      path: ["startTime"],
    },
  );

export const pricingRuleUpdateSchema = pricingRuleCreateSchema
  .omit({ lotId: true })
  .partial()
  .extend({
    id: z.string().uuid("Invalid pricing rule ID"),
  });

export type LotCreateInput = z.infer<typeof lotCreateSchema>;
export type LotUpdateInput = z.infer<typeof lotUpdateSchema>;
export type OccupancySnapshotInput = z.infer<typeof occupancySnapshotSchema>;
export type PricingRuleCreateInput = z.infer<typeof pricingRuleCreateSchema>;
export type PricingRuleUpdateInput = z.infer<typeof pricingRuleUpdateSchema>;
