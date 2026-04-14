import { z } from "zod";

export const tournamentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  gameCategory: z.enum(["FOOTBALL", "EFOOTBALL", "PUBG", "SNOOKER", "CHECKERS"]),
  format: z.enum(["LEAGUE", "KNOCKOUT", "GROUP_KNOCKOUT"]),
  participantType: z.enum(["TEAM", "INDIVIDUAL"]),
  status: z.enum(["DRAFT", "UPCOMING", "ACTIVE", "COMPLETED", "CANCELLED"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  maxParticipants: z.coerce.number().int().positive().optional().or(z.literal("")),
  prizeInfo: z.string().optional(),
  rules: z.string().optional(),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  logoUrl: z.string().url().optional().or(z.literal("")),
  isFeatured: z.boolean().optional(),
  seasonId: z.string().optional(),
  eFootballMode: z.enum(["1v1", "2v2"]).optional(),
  eFootballType: z.enum(["AUTHENTIC", "DREAM"]).optional(),
});

export type TournamentInput = z.infer<typeof tournamentSchema>;
