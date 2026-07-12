import { z } from "zod";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export const availabilityStatusEnum = z.enum([
  "CONFIRMED",
  "LIKELY",
  "UNAVAILABLE",
  "SHIFT_UNCONFIRMED",
  "IF_NEEDED",
  "NO_RESPONSE",
]);

export const dutyTypeEnum = z.enum([
  "DAY_SHIFT",
  "NIGHT_SHIFT",
  "OFF_DUTY",
  "ROTATING",
  "UNKNOWN",
  "CUSTOM",
]);

export const privacyEnum = z.enum(["PRIVATE", "TEAM_CAPTAIN", "TEAM", "ENGINE_ONLY"]);

const timeOpt = z.string().regex(HHMM).optional().or(z.literal(""));

/** Statuses that legitimately have no time window (whole-day markers). */
const WHOLE_DAY_STATUSES = ["UNAVAILABLE", "SHIFT_UNCONFIRMED", "NO_RESPONSE"];

export const blockInputSchema = z
  .object({
    id: z.string().optional(),
    date: z.string().regex(YMD, "Invalid date"),
    status: availabilityStatusEnum,
    isAllDay: z.coerce.boolean().default(false),
    startTime: timeOpt,
    endTime: timeOpt,
    isOvernight: z.coerce.boolean().default(false),
    dutyType: dutyTypeEnum.optional(),
    confidence: z.coerce.number().int().min(0).max(100).optional(),
    note: z.string().max(500).optional(),
    privacy: privacyEnum.default("PRIVATE"),
  })
  .refine(
    (b) => b.isAllDay || WHOLE_DAY_STATUSES.includes(b.status) || (!!b.startTime && !!b.endTime),
    { message: "Set a start and end time, or mark the block all-day.", path: ["startTime"] }
  )
  .refine(
    (b) => {
      if (b.isAllDay || !b.startTime || !b.endTime) return true;
      if (b.isOvernight) return true; // overnight windows legitimately end "before" they start
      return b.endTime > b.startTime;
    },
    { message: "End time must be after start time. Turn on ‘crosses midnight’ for overnight windows.", path: ["endTime"] }
  );

export type BlockInput = z.infer<typeof blockInputSchema>;

export const monthYearSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2024).max(2100),
});

export const bulkApplySchema = z
  .object({
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2024).max(2100),
    mode: z.enum(["WEEKDAYS", "RANGE", "CLEAR", "COPY_PREVIOUS_MONTH", "MARK_RANGE_UNAVAILABLE"]),
    weekdays: z.array(z.coerce.number().int().min(0).max(6)).optional(),
    fromDate: z.string().regex(YMD).optional(),
    toDate: z.string().regex(YMD).optional(),
    // The block to stamp on each targeted day (WEEKDAYS / RANGE):
    status: availabilityStatusEnum.optional(),
    isAllDay: z.coerce.boolean().optional(),
    startTime: timeOpt,
    endTime: timeOpt,
    isOvernight: z.coerce.boolean().optional(),
    dutyType: dutyTypeEnum.optional(),
    note: z.string().max(500).optional(),
  })
  .refine((b) => b.mode !== "WEEKDAYS" || (b.weekdays && b.weekdays.length > 0), {
    message: "Choose at least one weekday.",
    path: ["weekdays"],
  })
  .refine((b) => !["RANGE", "MARK_RANGE_UNAVAILABLE"].includes(b.mode) || (b.fromDate && b.toDate), {
    message: "Choose a start and end date for the range.",
    path: ["fromDate"],
  });

export type BulkApplyInput = z.infer<typeof bulkApplySchema>;

export const templateRuleSchema = z.object({
  status: availabilityStatusEnum,
  isAllDay: z.coerce.boolean().default(false),
  startTime: timeOpt,
  endTime: timeOpt,
  isOvernight: z.coerce.boolean().default(false),
  dutyType: dutyTypeEnum.optional(),
  note: z.string().max(300).optional(),
});

export const templateInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Give the template a name").max(60),
  description: z.string().max(200).optional(),
  // weekday index ("0".."6") → blocks to apply that weekday
  rules: z.record(z.string(), z.array(templateRuleSchema)),
  isDefault: z.coerce.boolean().optional(),
});

export type TemplateInput = z.infer<typeof templateInputSchema>;

export const applyTemplateSchema = z.object({
  templateId: z.string(),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2024).max(2100),
  scope: z.enum(["MONTH", "WEEKDAYS", "RANGE"]).default("MONTH"),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).optional(),
  fromDate: z.string().regex(YMD).optional(),
  toDate: z.string().regex(YMD).optional(),
});

export type ApplyTemplateInput = z.infer<typeof applyTemplateSchema>;

export const submitPeriodSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2024).max(2100),
  acknowledge: z.literal(true, { message: "Please acknowledge before submitting." }),
});
