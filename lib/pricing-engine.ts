import { z } from "zod";

const PricingRuleSchema = z.object({
  id: z.string(),
  occupancy_threshold: z.number().min(0).max(100),
  time_start: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  time_end: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  rate_cents: z.number().int().nonnegative(),
  priority: z.number().int().optional().default(0),
});

export type PricingRule = z.infer<typeof PricingRuleSchema>;

function getCurrentTimeString(): string {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function isWithinTimeWindow(
  currentTime: string,
  timeStart: string | null | undefined,
  timeEnd: string | null | undefined,
): boolean {
  if (!timeStart && !timeEnd) {
    return true;
  }

  if (!timeStart || !timeEnd) {
    return true;
  }

  const currentMinutes = timeToMinutes(currentTime);
  const startMinutes = timeToMinutes(timeStart);
  const endMinutes = timeToMinutes(timeEnd);

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}

export function evaluateRules(
  occupancyPercentage: number,
  rules: PricingRule[],
): number | null {
  if (occupancyPercentage < 0 || occupancyPercentage > 100) {
    throw new Error("Occupancy percentage must be between 0 and 100");
  }

  const validatedRules = rules.map((rule) => PricingRuleSchema.parse(rule));

  const currentTime = getCurrentTimeString();

  const matchingRules = validatedRules.filter((rule) => {
    const meetsOccupancyThreshold =
      occupancyPercentage >= rule.occupancy_threshold;
    const meetsTimeWindow = isWithinTimeWindow(
      currentTime,
      rule.time_start,
      rule.time_end,
    );
    return meetsOccupancyThreshold && meetsTimeWindow;
  });

  if (matchingRules.length === 0) {
    return null;
  }

  const winningRule = matchingRules.reduce((best, current) => {
    if (current.occupancy_threshold > best.occupancy_threshold) {
      return current;
    }
    if (
      current.occupancy_threshold === best.occupancy_threshold &&
      (current.priority ?? 0) > (best.priority ?? 0)
    ) {
      return current;
    }
    return best;
  });

  return winningRule.rate_cents;
}
