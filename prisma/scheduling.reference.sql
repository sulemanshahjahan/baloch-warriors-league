-- CreateEnum
CREATE TYPE "AvailabilityPeriodStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'LOCKED', 'REOPENED');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('CONFIRMED', 'LIKELY', 'UNAVAILABLE', 'SHIFT_UNCONFIRMED', 'IF_NEEDED', 'NO_RESPONSE');

-- CreateEnum
CREATE TYPE "DutyType" AS ENUM ('DAY_SHIFT', 'NIGHT_SHIFT', 'OFF_DUTY', 'ROTATING', 'UNKNOWN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AvailabilityPrivacy" AS ENUM ('PRIVATE', 'TEAM_CAPTAIN', 'TEAM', 'ENGINE_ONLY');

-- CreateEnum
CREATE TYPE "AvailabilitySource" AS ENUM ('MANUAL', 'TEMPLATE', 'COPIED', 'ADMIN');

-- CreateEnum
CREATE TYPE "SchedulingAvailabilityMode" AS ENUM ('MONTHLY', 'WEEKLY', 'TOURNAMENT_WIDE', 'ROUND_SPECIFIC', 'ADMIN_MANAGED', 'HYBRID');

-- CreateEnum
CREATE TYPE "SchedulingMode" AS ENUM ('AUTOMATIC', 'ADMIN_ASSISTED', 'PLAYER_CHOICE', 'MANUAL', 'WINDOW', 'OFFICIAL');

-- CreateEnum
CREATE TYPE "MinRequirementMode" AS ENUM ('HARD', 'SOFT', 'DISABLED');

-- CreateEnum
CREATE TYPE "MatchSchedulingStatus" AS ENUM ('FIXTURE_CREATED', 'AWAITING_AVAILABILITY', 'AVAILABILITY_INCOMPLETE', 'CALCULATING_OVERLAP', 'NO_COMMON_TIME', 'PROPOSED', 'AWAITING_SELECTION', 'AWAITING_CONFIRMATION', 'PARTIALLY_CONFIRMED', 'FULLY_CONFIRMED', 'SCHEDULED', 'RESCHEDULE_REQUESTED', 'RESCHEDULE_REVIEW', 'RESCHEDULED', 'SUBSTITUTE_REQUESTED', 'SUBSTITUTE_PENDING', 'SUBSTITUTE_APPROVED', 'CHECK_IN_OPEN', 'PLAYER_LATE', 'NO_SHOW_REVIEW', 'WALKOVER_PROPOSED', 'ADMIN_DECISION', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SlotEligibility" AS ENUM ('ELIGIBLE', 'PARTIAL', 'REQUIRES_SUBSTITUTE', 'INELIGIBLE');

-- CreateEnum
CREATE TYPE "ConfirmationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'TENTATIVE', 'NO_RESPONSE', 'SUBSTITUTE');

-- CreateEnum
CREATE TYPE "RescheduleReason" AS ENUM ('DUTY_SHIFT_CHANGED', 'WORK_EMERGENCY', 'MEDICAL_FAMILY', 'TECHNICAL', 'TRAVEL', 'OPPONENT_REQUEST', 'OTHER');

-- CreateEnum
CREATE TYPE "RescheduleStatus" AS ENUM ('PENDING', 'OPPONENT_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'COUNTERED');

-- CreateEnum
CREATE TYPE "SubstituteRegStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REMOVED');

-- CreateEnum
CREATE TYPE "SubstituteActivationStatus" AS ENUM ('REQUESTED', 'PENDING', 'ACCEPTED', 'DECLINED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CheckInStatus" AS ENUM ('NOT_CHECKED_IN', 'CHECKED_IN', 'LATE', 'EXCUSED', 'NO_SHOW', 'SUBSTITUTE_CHECKED_IN');

-- CreateEnum
CREATE TYPE "CheckInSource" AS ENUM ('PLAYER', 'CAPTAIN', 'ADMIN', 'AUTO');

-- CreateEnum
CREATE TYPE "SchedulingActorType" AS ENUM ('ADMIN', 'PLAYER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "StageType" AS ENUM ('GROUP', 'LEAGUE_ROUND', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL', 'THIRD_PLACE', 'CUSTOM');

-- CreateTable
CREATE TABLE "player_availability_periods" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "status" "AvailabilityPeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_availability_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_blocks" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startDateTime" TIMESTAMP(3),
    "endDateTime" TIMESTAMP(3),
    "status" "AvailabilityStatus" NOT NULL DEFAULT 'CONFIRMED',
    "dutyType" "DutyType",
    "confidence" INTEGER,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "isOvernight" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "privacy" "AvailabilityPrivacy" NOT NULL DEFAULT 'PRIVATE',
    "source" "AvailabilitySource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_templates" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_scheduling_settings" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "availabilityMode" "SchedulingAvailabilityMode" NOT NULL DEFAULT 'HYBRID',
    "schedulingMode" "SchedulingMode" NOT NULL DEFAULT 'ADMIN_ASSISTED',
    "matchDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "preMatchBufferMinutes" INTEGER NOT NULL DEFAULT 10,
    "postMatchBufferMinutes" INTEGER NOT NULL DEFAULT 10,
    "confirmationWindowHours" INTEGER NOT NULL DEFAULT 24,
    "rescheduleCutoffHours" INTEGER NOT NULL DEFAULT 6,
    "maxReschedules" INTEGER NOT NULL DEFAULT 1,
    "gracePeriodMinutes" INTEGER NOT NULL DEFAULT 10,
    "minRequirementMode" "MinRequirementMode" NOT NULL DEFAULT 'SOFT',
    "minimumAvailableSlots" INTEGER,
    "minimumAvailableDays" INTEGER,
    "minimumSlotDuration" INTEGER,
    "substitutesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "captainConfirmationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "earlyPlayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoWalkoverEnabled" BOOLEAN NOT NULL DEFAULT false,
    "opponentAvailabilityVisible" BOOLEAN NOT NULL DEFAULT true,
    "availabilityOpensAt" TIMESTAMP(3),
    "availabilityDeadline" TIMESTAMP(3),
    "weights" JSONB,
    "visibilitySettings" JSONB,
    "notificationSettings" JSONB,
    "reminderSettings" JSONB,
    "noShowRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_scheduling_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_scheduling_overrides" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "stageType" "StageType" NOT NULL,
    "roundNumber" INTEGER,
    "settingsOverride" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stage_scheduling_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_schedules" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "schedulingStatus" "MatchSchedulingStatus" NOT NULL DEFAULT 'FIXTURE_CREATED',
    "schedulingMode" "SchedulingMode" NOT NULL DEFAULT 'ADMIN_ASSISTED',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "windowStart" TIMESTAMP(3),
    "windowEnd" TIMESTAMP(3),
    "confirmationDeadline" TIMESTAMP(3),
    "rescheduleDeadline" TIMESTAMP(3),
    "primaryStart" TIMESTAMP(3),
    "primaryEnd" TIMESTAMP(3),
    "backupStart" TIMESTAMP(3),
    "backupEnd" TIMESTAMP(3),
    "checkInOpensAt" TIMESTAMP(3),
    "kickoffAt" TIMESTAMP(3),
    "gracePeriodEnd" TIMESTAMP(3),
    "resultDeadline" TIMESTAMP(3),
    "selectedSlotId" TEXT,
    "autoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "adminOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "schedulingConfidence" DOUBLE PRECISION,
    "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposed_match_slots" (
    "id" TEXT NOT NULL,
    "matchScheduleId" TEXT NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "eligibility" "SlotEligibility" NOT NULL DEFAULT 'ELIGIBLE',
    "requiresSubstitute" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isBackup" BOOLEAN NOT NULL DEFAULT false,
    "scoringExplanation" TEXT,
    "conflictDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposed_match_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_participant_confirmations" (
    "id" TEXT NOT NULL,
    "matchScheduleId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT,
    "proposedSlotId" TEXT,
    "status" "ConfirmationStatus" NOT NULL DEFAULT 'PENDING',
    "responseReason" TEXT,
    "responseNote" TEXT,
    "respondedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_participant_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reschedule_requests" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestingTeamId" TEXT,
    "reasonCategory" "RescheduleReason" NOT NULL,
    "reasonText" TEXT NOT NULL,
    "requestedStart" TIMESTAMP(3),
    "requestedEnd" TIMESTAMP(3),
    "status" "RescheduleStatus" NOT NULL DEFAULT 'PENDING',
    "opponentResponse" TEXT,
    "adminDecision" TEXT,
    "adminNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reschedule_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "substitute_registrations" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" "SubstituteRegStatus" NOT NULL DEFAULT 'PENDING',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "eligibilityData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "substitute_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "substitute_activations" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "originalPlayerId" TEXT NOT NULL,
    "substitutePlayerId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "SubstituteActivationStatus" NOT NULL DEFAULT 'REQUESTED',
    "approvedById" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "substitute_activations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_check_ins" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" "CheckInStatus" NOT NULL DEFAULT 'NOT_CHECKED_IN',
    "checkedInAt" TIMESTAMP(3),
    "source" "CheckInSource" NOT NULL DEFAULT 'PLAYER',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_audit_events" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT,
    "matchId" TEXT,
    "playerId" TEXT,
    "actorType" "SchedulingActorType" NOT NULL DEFAULT 'SYSTEM',
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "previousData" JSONB,
    "newData" JSONB,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduling_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_availability_periods_playerId_idx" ON "player_availability_periods"("playerId");

-- CreateIndex
CREATE INDEX "player_availability_periods_year_month_idx" ON "player_availability_periods"("year", "month");

-- CreateIndex
CREATE INDEX "player_availability_periods_status_idx" ON "player_availability_periods"("status");

-- CreateIndex
CREATE UNIQUE INDEX "player_availability_periods_playerId_month_year_key" ON "player_availability_periods"("playerId", "month", "year");

-- CreateIndex
CREATE INDEX "availability_blocks_playerId_date_idx" ON "availability_blocks"("playerId", "date");

-- CreateIndex
CREATE INDEX "availability_blocks_periodId_idx" ON "availability_blocks"("periodId");

-- CreateIndex
CREATE INDEX "availability_blocks_date_idx" ON "availability_blocks"("date");

-- CreateIndex
CREATE INDEX "availability_templates_playerId_idx" ON "availability_templates"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_scheduling_settings_tournamentId_key" ON "tournament_scheduling_settings"("tournamentId");

-- CreateIndex
CREATE INDEX "stage_scheduling_overrides_tournamentId_idx" ON "stage_scheduling_overrides"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "stage_scheduling_overrides_tournamentId_stageType_roundNumb_key" ON "stage_scheduling_overrides"("tournamentId", "stageType", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "match_schedules_matchId_key" ON "match_schedules"("matchId");

-- CreateIndex
CREATE INDEX "match_schedules_schedulingStatus_idx" ON "match_schedules"("schedulingStatus");

-- CreateIndex
CREATE INDEX "match_schedules_confirmationDeadline_idx" ON "match_schedules"("confirmationDeadline");

-- CreateIndex
CREATE INDEX "match_schedules_windowEnd_idx" ON "match_schedules"("windowEnd");

-- CreateIndex
CREATE INDEX "proposed_match_slots_matchScheduleId_idx" ON "proposed_match_slots"("matchScheduleId");

-- CreateIndex
CREATE INDEX "proposed_match_slots_matchScheduleId_rank_idx" ON "proposed_match_slots"("matchScheduleId", "rank");

-- CreateIndex
CREATE INDEX "match_participant_confirmations_matchScheduleId_idx" ON "match_participant_confirmations"("matchScheduleId");

-- CreateIndex
CREATE INDEX "match_participant_confirmations_playerId_idx" ON "match_participant_confirmations"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "match_participant_confirmations_matchScheduleId_playerId_key" ON "match_participant_confirmations"("matchScheduleId", "playerId");

-- CreateIndex
CREATE INDEX "reschedule_requests_matchId_idx" ON "reschedule_requests"("matchId");

-- CreateIndex
CREATE INDEX "reschedule_requests_status_idx" ON "reschedule_requests"("status");

-- CreateIndex
CREATE INDEX "substitute_registrations_tournamentId_idx" ON "substitute_registrations"("tournamentId");

-- CreateIndex
CREATE INDEX "substitute_registrations_teamId_idx" ON "substitute_registrations"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "substitute_registrations_tournamentId_teamId_playerId_key" ON "substitute_registrations"("tournamentId", "teamId", "playerId");

-- CreateIndex
CREATE INDEX "substitute_activations_matchId_idx" ON "substitute_activations"("matchId");

-- CreateIndex
CREATE INDEX "substitute_activations_teamId_idx" ON "substitute_activations"("teamId");

-- CreateIndex
CREATE INDEX "match_check_ins_matchId_idx" ON "match_check_ins"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "match_check_ins_matchId_playerId_key" ON "match_check_ins"("matchId", "playerId");

-- CreateIndex
CREATE INDEX "scheduling_audit_events_tournamentId_idx" ON "scheduling_audit_events"("tournamentId");

-- CreateIndex
CREATE INDEX "scheduling_audit_events_matchId_idx" ON "scheduling_audit_events"("matchId");

-- CreateIndex
CREATE INDEX "scheduling_audit_events_playerId_idx" ON "scheduling_audit_events"("playerId");

-- CreateIndex
CREATE INDEX "scheduling_audit_events_eventType_idx" ON "scheduling_audit_events"("eventType");

-- CreateIndex
CREATE INDEX "scheduling_audit_events_createdAt_idx" ON "scheduling_audit_events"("createdAt");

-- AddForeignKey
ALTER TABLE "player_availability_periods" ADD CONSTRAINT "player_availability_periods_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "player_availability_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_templates" ADD CONSTRAINT "availability_templates_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_scheduling_settings" ADD CONSTRAINT "tournament_scheduling_settings_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_scheduling_overrides" ADD CONSTRAINT "stage_scheduling_overrides_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_schedules" ADD CONSTRAINT "match_schedules_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposed_match_slots" ADD CONSTRAINT "proposed_match_slots_matchScheduleId_fkey" FOREIGN KEY ("matchScheduleId") REFERENCES "match_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participant_confirmations" ADD CONSTRAINT "match_participant_confirmations_matchScheduleId_fkey" FOREIGN KEY ("matchScheduleId") REFERENCES "match_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participant_confirmations" ADD CONSTRAINT "match_participant_confirmations_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participant_confirmations" ADD CONSTRAINT "match_participant_confirmations_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reschedule_requests" ADD CONSTRAINT "reschedule_requests_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substitute_registrations" ADD CONSTRAINT "substitute_registrations_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substitute_registrations" ADD CONSTRAINT "substitute_registrations_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substitute_registrations" ADD CONSTRAINT "substitute_registrations_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substitute_activations" ADD CONSTRAINT "substitute_activations_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_check_ins" ADD CONSTRAINT "match_check_ins_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_check_ins" ADD CONSTRAINT "match_check_ins_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

