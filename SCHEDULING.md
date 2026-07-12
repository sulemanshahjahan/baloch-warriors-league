# BWL Tournament Availability & Match Scheduling System

A monthly-availability + per-match-confirmation scheduler for the Baloch Warriors
League. It solves the hardest logistics problem in the platform: getting 1v1 and
especially 2v2 players — many of whom work rotating security/army duty shifts — to
agree on a match time everyone can actually make.

All source lives under `src/lib/scheduling/` (pure engine + services),
`src/lib/actions/*.ts` (server actions), `src/app/api/cron/scheduling/route.ts`
(cron), and the player/admin pages listed throughout. The data model is defined in
`prisma/scheduling.reference.sql` (mirrored in `prisma/schema.prisma`).

---

## 1. Overview

Players in the league can't easily align free time — duty rosters rotate, and a
2v2 match needs **four** people simultaneously free. The system tackles this with a
two-layer model:

1. **Monthly availability** — each player fills a calendar of time blocks (per
   month, PKT) with a confidence status. See `src/lib/scheduling/blocks.ts`.
2. **Per-match confirmation** — for each fixture, a pure engine
   (`src/lib/scheduling/engine.ts`) finds windows where the whole required lineup
   overlaps, scores/ranks a handful of proposed slots, and asks participants to
   confirm. Only when everyone confirms the same slot does the match get a locked
   time.

This is the `HYBRID` availability mode and is the **default** (see `BASE` in
`src/lib/scheduling/defaults.ts`): players plan monthly, but each match is still
individually confirmed.

**Time zone.** Everything is displayed in **PKT (Asia/Karachi, fixed +05:00, no
DST)** and stored in the database as **UTC**. The engine and its helpers use a
fixed +300-minute offset (`PKT_OFFSET_MIN` in `src/lib/scheduling/time.ts`); the
rest of the app formats via `@/lib/utils` (`toKarachiInputValue` /
`fromKarachiInputValue`).

---

## 2. Data model

The feature adds **13 tables**, all **additive and backward-compatible** — no
existing table or column is changed. They are applied with **`prisma db push`**
(not `prisma migrate dev`) against `prisma/schema.prisma`;
`prisma/scheduling.reference.sql` is the canonical DDL reference.

| Table (`snake_case` db name) | Purpose |
|---|---|
| `player_availability_periods` (**PlayerAvailabilityPeriod**) | One row per player per month; holds status (`DRAFT`/`SUBMITTED`/`LOCKED`/`REOPENED`), submit/lock timestamps, timezone. |
| `availability_blocks` (**AvailabilityBlock**) | Individual time blocks within a period: date, start/end, availability status, duty type, all-day/overnight flags, privacy, source. |
| `availability_templates` (**AvailabilityTemplate**) | Reusable weekly patterns (JSON `rules` keyed by weekday) a player can apply to a month; one can be marked default. |
| `tournament_scheduling_settings` (**TournamentSchedulingSettings**) | Per-tournament config: enabled flag, scheduling/availability mode, durations/buffers, confirmation & reschedule windows, min-requirement mode, deadlines, feature toggles. One row per tournament. |
| `stage_scheduling_overrides` (**StageSchedulingOverride**) | Optional per-stage/round JSON overrides (e.g. stricter rules for the final). |
| `match_schedules` (**MatchSchedule**) | The scheduling record for one match: status machine, windows, primary/backup times, `selectedSlotId`, `kickoffAt`, confidence, admin-override flags, reschedule count. One row per match. |
| `proposed_match_slots` (**ProposedMatchSlot**) | Engine-generated candidate slots: start/end, score, rank, eligibility, `requiresSubstitute`, primary/backup flags, plain-English `scoringExplanation`. |
| `match_participant_confirmations` (**MatchParticipantConfirmation**) | Per-player confirmation state (`PENDING`/`CONFIRMED`/`REJECTED`/`TENTATIVE`/`NO_RESPONSE`/`SUBSTITUTE`), which slot they confirmed, reason/note. |
| `reschedule_requests` (**RescheduleRequest**) | A player's request to move a scheduled match: reason category/text, requested new time, status, admin decision, emergency flag. |
| `substitute_registrations` (**SubstituteRegistration**) | A player registered as an eligible substitute for a team in a tournament; needs admin approval. |
| `substitute_activations` (**SubstituteActivation**) | A per-match request to swap a starter for a registered sub; tracks the accept/approve lifecycle. |
| `match_check_ins` (**MatchCheckIn**) | Per-player check-in around kickoff (`CHECKED_IN`/`LATE`/`EXCUSED`/`NO_SHOW`/…), with source (player/admin). |
| `scheduling_audit_events` (**SchedulingAuditEvent**) | Append-only audit log of every scheduling action (actor type/id, event type, before/after JSON). Writes are always best-effort and never block the primary action. |

---

## 3. How admins enable scheduling

Flow: **`/admin/scheduling`** (`src/app/(admin)/admin/scheduling/page.tsx`) lists
active tournaments and whether scheduling is on → click **Manage** →
**`/admin/scheduling/[tournamentId]`** → toggle **Enable scheduling** → adjust
settings → **Generate proposed slots**.

- **Enable** — `enableTournamentScheduling()` in
  `src/lib/actions/scheduling-admin.ts` upserts a `TournamentSchedulingSettings`
  row pre-filled from the format defaults (`getTournamentTypeDefaults`).
- **Configure** — the settings form
  (`src/app/(admin)/admin/scheduling/[tournamentId]/scheduling-controls.tsx`) calls
  `updateSchedulingSettings()`, which clamps every numeric field to a safe range.
- **Generate** — `generateSchedulesForTournament()` runs the engine over every
  assignable, non-completed fixture; `generateScheduleForMatch()` does one match.

Settings and what they do (defaults from `src/lib/scheduling/defaults.ts`):

| Setting | Effect |
|---|---|
| `schedulingMode` | How times are decided: `AUTOMATIC` (engine picks), `ADMIN_ASSISTED` (engine suggests), `PLAYER_CHOICE` (players pick & confirm), `MANUAL` (admin sets), `WINDOW` (play anytime in a round window), `OFFICIAL` (fixed admin time). |
| `matchDurationMinutes` | Match length the engine must fit (default 60). |
| `preMatchBufferMinutes` / `postMatchBufferMinutes` | Padding before/after (default 10/10); counted in the "occupied" window and busy-time. |
| `confirmationWindowHours` | Time players get to confirm before escalation (default 24). |
| `rescheduleCutoffHours` | How close to kickoff a reschedule may still be requested (default 6). |
| `maxReschedules` | Approved reschedules allowed per match (default 1). |
| `gracePeriodMinutes` | Late window after kickoff before a no-show (default 10). |
| `minRequirementMode` + `minimumAvailableSlots` / `minimumAvailableDays` / `minimumSlotDuration` | Minimum monthly availability players must submit; enforced `HARD`/`SOFT`/`DISABLED`. |
| `substitutesEnabled` | Allow registered substitutes (defaults on for 2v2 formats). |
| `captainConfirmationEnabled` | Let a team captain confirm for the whole side. |
| `earlyPlayEnabled` | Allow playing before the proposed time within the window. |
| `opponentAvailabilityVisible` | Whether opponents can see the overlap. |
| `availabilityDeadline` | PKT datetime after which the *next* month's availability auto-locks (enforced by cron). |

---

## 4. How monthly availability works

Players manage their calendar at **`/player/availability`**
(`src/app/(public)/player/availability/page.tsx`) and see a summary /
action-required banner at **`/player/schedule`**
(`src/app/(public)/player/schedule/page.tsx`). Statuses, blocks, and validation
are pure functions in `src/lib/scheduling/blocks.ts`; status labels live in
`src/app/(public)/player/availability/shared.ts`.

**Six availability statuses** (`AvailabilityStatus`):

| Status | Label | Eligible for a slot? |
|---|---|---|
| `CONFIRMED` | Confirmed available | Yes (highest weight) |
| `IF_NEEDED` | Available if needed | Yes |
| `LIKELY` | Likely available | Yes |
| `SHIFT_UNCONFIRMED` | Shift not confirmed | Only if the tournament opts in |
| `UNAVAILABLE` | Unavailable | Never |
| `NO_RESPONSE` | No response | Never |

- **Blocks** — each day can hold timed windows or an all-day marker. A whole-day
  marker replaces every other block that day; overlapping timed blocks on the same
  day are rejected. See `upsertAvailabilityBlock` / `quickSetDay` in
  `src/lib/actions/player-availability.ts`.
- **Overnight** — a block ending at/after its start time (e.g. 23:00→02:00) rolls
  into the next day; `pktRange(..., overnight)` in `src/lib/scheduling/time.ts`
  handles the +1-day math; the UI shows a "(+1)" suffix.
- **Duty types** — `DAY_SHIFT`, `NIGHT_SHIFT`, `OFF_DUTY`, `ROTATING`, `UNKNOWN`,
  `CUSTOM` (labels in `shared.ts`), reflecting the rotating-duty player base.
- **Templates** — `saveAvailabilityTemplate` / `applyAvailabilityTemplate` store a
  weekly pattern and stamp it onto a month (whole month, weekdays, or a date range).
- **Bulk tools** — `bulkApplyAvailability` supports `WEEKDAYS`, `RANGE`,
  `MARK_RANGE_UNAVAILABLE`, `CLEAR`, and `COPY_PREVIOUS_MONTH`.
- **Submit + minimum requirements** — `submitAvailabilityPeriod` validates the
  month via `validateMinRequirements` against the player's aggregated requirements
  (`getPlayerMonthRequirements` in `src/lib/scheduling/requirements.ts`, which takes
  the strictest rule across every scheduling-enabled tournament the player is in):
  - `HARD` — unmet minimums **block** submission.
  - `SOFT` — unmet minimums are returned as **warnings** only.
  - `DISABLED` — skip entirely (the common case until an admin enables scheduling).
  - Locked (`LOCKED`) periods can't be edited until an admin reopens them.

---

## 5. How different tournament formats behave

Recommended defaults per format live in `FORMAT_DEFAULTS` and stage overrides in
`STAGE_DEFAULTS` (`src/lib/scheduling/defaults.ts`). The format key is derived by
`formatKeyFor()` — 2v2 = eFootball duo mode **or** `TEAM` participant type; 1v1 =
`INDIVIDUAL`. These are **suggestions that prefill the form**, never enforced.

| Format | Mode | Window (days) | Notable defaults |
|---|---|---|---|
| **1v1 knockout** | `PLAYER_CHOICE` | 3 | Only two must overlap; 2–3 slots, require confirmation; min 3 slots / 2 days. |
| **2v2 knockout** | `PLAYER_CHOICE` | 4 | Hardest case (4 must overlap); primary + backup; substitutes on; min 4 slots / 3 days / 90-min slots; escalate early. |
| **1v1 league** | `WINDOW` | 5 | Publish round windows, confirm nearer the round; early play; max 2 reschedules. |
| **2v2 league** | `WINDOW` | 6 | Wider windows, substitutes on, team-availability view; max 2 reschedules. |
| **Group stage** | `PLAYER_CHOICE` | 4 | Flexible windows, early play; all group matches finish before qualification closes. |
| **Group + knockout** | `ADMIN_ASSISTED` | 4 | Uses stage overrides — loose for groups, strict for knockout. |

**Stage overrides** (matched from a match's round label via `stageTypeForMatch` in
`src/lib/scheduling/service.ts`):

| Stage | Mode | Window | Reschedules |
|---|---|---|---|
| `GROUP` | `PLAYER_CHOICE` | 4 | 1 |
| `LEAGUE_ROUND` | `WINDOW` | 5 | 2 |
| `ROUND_OF_32` / `ROUND_OF_16` | `PLAYER_CHOICE` | 3 | 1 |
| `QUARTER_FINAL` | `ADMIN_ASSISTED` | 2 | 1 |
| `SEMI_FINAL` | `OFFICIAL` | 1 | 0 |
| `FINAL` | `OFFICIAL` | 1 | 0 |
| `THIRD_PLACE` | `ADMIN_ASSISTED` | 1 | 0 |

`getEffectiveSettings()` (`src/lib/scheduling/settings.ts`) merges stored settings
over these resolved defaults so any unset field still has a sensible value.

---

## 6. How slot scoring works

The engine (`generateProposedSlots` in `src/lib/scheduling/engine.ts`) is pure,
deterministic and transparent. `generateAndPersistSlots`
(`src/lib/scheduling/service.ts`) feeds it real data and persists the result.

**Inputs per player**: eligible availability intervals (clipped to the completion
window, with already-scheduled matches subtracted as busy time), match duration +
buffers, the completion window, PKT offset, and the availability weights.

**Availability weights** (`DEFAULT_WEIGHTS` in `src/lib/scheduling/types.ts`):
`CONFIRMED` 100 > `IF_NEEDED` 50 > `LIKELY` 40; `SHIFT_UNCONFIRMED` = 0 and is
**excluded unless `allowShiftUnconfirmed` is on**; `UNAVAILABLE` / `NO_RESPONSE` =
−∞ (never used). A slot never overlaps an explicit unavailable/no-response block.
A player's status over a slot is the **worst** status covering the whole occupied
range (buffers included), or the slot is a gap.

**Visible score factors** (`SlotScoreFactors`) — a weighted sum, no hidden
penalties:

```
score = 0.6 * confirmation + 0.2 * earliness + 0.2 * timeOfDay − substitutePenalty
```

- `confirmation` — average availability weight of the lineup (0–100).
- `earliness` — earlier within the window scores higher (neutral 60 if open-ended).
- `timeOfDay` — 100 in the preferred window (default 16:00–22:00 PKT), 25 for
  unsociable hours (≥23:00 or <09:00), else 65.
- `substitutePenalty` — 20 subtracted when the slot needs a substitute.

Each slot also carries a plain-English **`explanation`** (built by
`buildExplanation`), e.g. *"all 4 participants marked this time confirmed-available;
falls in the preferred evening window."* Slots are ranked, one flagged `isPrimary`
and a different-day one `isBackup`, kept a match-duration apart for variety.

**No-overlap analysis** (`analyzeNoOverlap`) — when no full-lineup window exists, the
engine returns a `NoOverlapAnalysis`: `blockingPlayerIds` (who, if removed, unlocks a
slot), `bestPartial` (largest simultaneous overlap and its ranges),
`substituteSolutions` (which approved sub creates an eligible lineup), and
`nearestPartialSegments`. Persisted status becomes `NO_COMMON_TIME`.

---

## 7. How the confirmation lifecycle works

`MatchSchedule.schedulingStatus` is a state machine (`SchedulingStatus` in
`src/lib/scheduling/status.ts`; labels/colors in `src/lib/scheduling/labels.ts`).
Typical path: `FIXTURE_CREATED` → (generate) → `AWAITING_CONFIRMATION` /
`NO_COMMON_TIME` → `PARTIALLY_CONFIRMED` → `FULLY_CONFIRMED` → **`SCHEDULED`**.

Players act on **`/player/matches/[id]`**
(`src/app/(public)/player/matches/[id]/page.tsx`, view built by
`getMatchSchedulingView` in `src/lib/scheduling/view.ts`). Actions in
`src/lib/actions/match-scheduling.ts`:

- `confirmSelectedSlot` — confirm the currently selected slot.
- `switchSelectedSlot` — switch the agreed slot; **this resets everyone's
  confirmation to PENDING** (changing the time invalidates prior agreement).
- `rejectMatchTime` — reject with a reason category (see `REJECT_REASONS`).

The status is recomputed after each action by **`aggregateSchedulingStatus`**: a
match is only "all confirmed" when **every** non-substitute participant has
`CONFIRMED` the **same** `selectedSlotId` — mixed selections never auto-schedule.
When that condition is met, `recompute` sets status to `SCHEDULED`, writes
`MatchSchedule.kickoffAt`, and **`Match.scheduledAt`** (the app-wide field the rest
of the site reads), then broadcasts `notifyMatchScheduled`. If
`captainConfirmationEnabled` is on, a team captain confirming acts for the whole
side.

---

## 8. How substitutes work

Two stages, both in `src/lib/actions/substitutes.ts`:

1. **Register** (per tournament + team) — `registerSubstitute`. A captain or admin
   registers a player; a captain's registration is `PENDING` and needs admin
   approval (`setSubstituteRegistrationStatus` → `APPROVED`), while an admin's is
   approved immediately. Managed on the tournament page's
   `substitutes-panel.tsx` (team-based tournaments only).
2. **Activate** (per match) — `requestSubstituteActivation`. A captain or admin
   requests swapping a starter for an **approved** registered sub. A player-initiated
   request can be acknowledged by the sub (`respondSubstituteActivation`) and needs
   admin approval (`adminDecideActivation`); an admin request applies immediately.

Approval runs `applyActivation`, which marks the original player's confirmation as
`SUBSTITUTE` (so they stop counting) and adds the sub as a fresh `PENDING`
participant, then re-aggregates status.

Note: the engine **already considers approved substitutes** when generating slots —
`loadSubstitutes` (`src/lib/scheduling/service.ts`) pulls approved registrations and
their availability, and `substituteSolutions` surfaces subs that unlock an otherwise
impossible match.

---

## 9. How rescheduling works

Handled in `src/lib/actions/reschedule.ts`.

- **Request** — `createRescheduleRequest`: a participant supplies a reason category
  (`DUTY_SHIFT_CHANGED`, `WORK_EMERGENCY`, `MEDICAL_FAMILY`, `TECHNICAL`, `TRAVEL`,
  `OPPONENT_REQUEST`, `OTHER`), free text, and optionally a new time (a proposed
  slot or a typed PKT time). Guards:
  - **Cutoff** — must be at least `rescheduleCutoffHours` before kickoff, *unless*
    flagged emergency (`isEmergency` bypasses the cutoff).
  - **`maxReschedules`** — blocked once that many `APPROVED` reschedules exist.
  - Only one pending request at a time. Status → `RESCHEDULE_REQUESTED`, admins
    alerted.
- **Cancel** — `cancelRescheduleRequest` (only while `PENDING`).
- **Admin decide** — `adminDecideReschedule`:
  - `REJECT` → request rejected, schedule reverts to `SCHEDULED` /
    `AWAITING_CONFIRMATION`.
  - `APPROVE` → needs a concrete new time; updates `Match.scheduledAt` and
    `MatchSchedule.kickoffAt`, increments `rescheduleCount`, marks `adminOverride`,
    and notifies. Actioned from the conflict queue via `RescheduleDecision`.

---

## 10. How no-shows & walkovers work

Check-in and no-show handling live in `src/lib/actions/checkin.ts`.

- **Check-in window** — `playerCheckIn` opens **30 min before** kickoff and stays
  open until **kickoff + grace + 30 min**; after `gracePeriodMinutes` the status is
  recorded as `LATE` rather than `CHECKED_IN`. `adminSetCheckIn` lets an admin set
  `CHECKED_IN` / `LATE` / `EXCUSED` / `NO_SHOW`.
- **No-show review** — appears in the admin **conflict queue** (scheduled matches
  whose kickoff passed >15 min ago). `adminResolveNoShow(matchId, resolution)`
  supports:
  - `WALKOVER_HOME` / `WALKOVER_AWAY` — awards a 3–0 walkover to that side via
    `executeMatchCompletion` (from `src/lib/actions/match.ts`) and marks the
    schedule `COMPLETED`.
  - `RESCHEDULE` — reopens the match (`AWAITING_CONFIRMATION`).
  - `WARNING` — audit-only.
  - `DISMISS` — no change beyond audit.

**Walkovers are always an explicit admin decision** — the resolution is chosen in
the `NoShowResolve` control (`conflicts/conflict-actions.tsx`); nothing awards a
walkover silently or automatically. (There is an `autoWalkoverEnabled` settings
flag, but the shipped no-show flow is admin-driven.)

---

## 11. How to configure reminders / the cron

Endpoint: **`GET /api/cron/scheduling`**
(`src/app/api/cron/scheduling/route.ts`), intended to run **every 30 minutes**.
It requires an `Authorization: Bearer ${CRON_SECRET}` header (401 otherwise).

Each run:

1. **Locks availability past its deadline** — for tournaments whose
   `availabilityDeadline` has passed, locks the **next** month's periods
   (`DRAFT`/`SUBMITTED`/`REOPENED` → `LOCKED`) for all enrolled players. A deadline
   in month N locks month N+1, matching the monthly-planning model.
2. **Tiered confirmation reminders** — for active-confirmation schedules, fires one
   reminder when the confirmation deadline is within **12h**, then **3h** (one tier
   per run), via `notifyConfirmationReminder`.
3. **Escalates** — a confirmation deadline that passed without full agreement, or a
   match window that closed without a scheduled time, is moved to `ADMIN_DECISION`
   and an admin alert is broadcast.

**Notifications** (`src/lib/scheduling/notify.ts`): match-level and admin events go
through **`notify()`** as a broadcast (all push subscribers + in-app feed), deduped
by `Notification.tag` via `broadcastOnce` so the cron never repeats itself.
**Targeted WhatsApp** nudges to still-pending participants
(`whatsappConfirmationRequest`) only fire when **`WHATSAPP_SCHEDULE_TEMPLATE`** is
set — otherwise WhatsApp is skipped entirely rather than sending a mismatched
template.

---

## 12. Troubleshooting scheduling conflicts

The admin **conflict queue** — **`/admin/scheduling/conflicts`**
(`src/app/(admin)/admin/scheduling/conflicts/page.tsx`) — is the single place that
aggregates everything needing a human: **needs-a-decision**
(`NO_COMMON_TIME` / `ADMIN_DECISION`), **reschedule requests**, **substitute
activations**, and **no-show review**.

**"No common time"** (`NO_COMMON_TIME`) means the engine found no window where the
full required lineup is simultaneously free for match + buffers. Fixes:

- **Extend the completion window** (raise `completionWindowDays` via the format, or
  set a later match deadline) so more days are searched.
- **Adjust availability** — the no-overlap analysis names the `blockingPlayerIds`;
  have them add time or relax `UNAVAILABLE`/`NO_RESPONSE` days.
- **Use a substitute** — enable substitutes and register/activate one the engine's
  `substituteSolutions` flags as unlocking a slot.
- From the queue's `RegenOrTime` control, **Regenerate** (`generateScheduleForMatch`)
  after availability changes, or **Set time** manually (`adminSetManualTime`). Admins
  can also `adminForceSchedule` a specific proposed slot with a reason.

**Overlap matrix** — **`/admin/scheduling/[tournamentId]/matrix`**
(`src/app/(admin)/admin/scheduling/[tournamentId]/matrix/page.tsx`) shows each
participant's dominant availability status per day over the next 14 days, plus a
per-day **coverage** row (how many players are eligible) so you can eyeball the best
days to schedule.

**Analytics** — **`/admin/scheduling/[tournamentId]/analytics`**
(`src/app/(admin)/admin/scheduling/[tournamentId]/analytics/page.tsx`) reports
per-tournament metrics: matches scheduled vs. needing admin intervention, % auto-scheduled,
average proposed slots per match, no-common-time count, reschedules by status,
substitute activations, no-show resolutions, and the availability submission rate.

---

## 13. Environment variables

| Variable | Required? | Purpose |
|---|---|---|
| `CRON_SECRET` | Existing (required for the cron) | Bearer token that authorizes `GET /api/cron/scheduling`. Requests without a matching `Authorization: Bearer <CRON_SECRET>` header get 401. |
| `WHATSAPP_SCHEDULE_TEMPLATE` | Optional | Approved WhatsApp template name for targeted confirmation nudges. If unset, WhatsApp reminders are skipped (broadcast/in-app notifications still send). |

(`NEXT_PUBLIC_APP_URL` is also used to build match links inside WhatsApp messages,
falling back to `https://bwlleague.com`.)
