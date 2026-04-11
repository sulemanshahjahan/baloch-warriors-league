# BWL Platform Backlog

> **Assessment Date:** 2026-04-11  
> **Current Score:** 8.2 / 10  
> **Last Updated:** Automation Audit & Feature Proposals

---

## Quick Stats

| Category | Score | Status |
|----------|-------|--------|
| Schema Design | 9/10 | ✅ Solid |
| Admin Interface | 9/10 | ✅ Solid |
| Public Pages | 8/10 | ✅ Good |
| Components | 9/10 | ✅ Solid |
| Server Actions | 7/10 | ⚠️ Needs Work |
| Security | 7/10 | ⚠️ Fix Now |
| Performance | 6/10 | ⚠️ Fix Soon |
| TypeScript | 6/10 | 📋 Gradual Refactor |

---

# 🎯 BWL Automation Audit & Feature Proposals

After a deep dive into the codebase and industry research across Challonge, Battlefy, FACEIT, Start.gg, and Toornament, here's the comprehensive assessment:

---

## Current Pain Points → Solutions

### 1. Manual Score Entry + WhatsApp Sharing (Every Match)

**Problem:** You enter score → go to match page → share to WhatsApp group. Repeated for every match.

**Solution: Auto-Share on Score Entry**

- When you submit a match result in admin, the system auto-generates a result card image (server-side via satori/@vercel/og) and sends it to the WhatsApp group via WhatsApp Business API
- One action (enter score) triggers: standings update + push notification + WhatsApp group post + result card generation
- **Already have:** `notify()` in push.ts, ShareLink component, canvas-based card generation
- **Need to add:** Server-side image generation API route, WhatsApp Cloud API integration, auto-trigger on `updateMatchResult()`

---

### 2. Sharing Fixtures Player-by-Player

**Problem:** You manually go to tournament page, generate fixture card for each player, share to each one individually.

**Solution: Bulk Fixture Distribution**

- One-click "Send All Fixtures" button on the tournament admin page
- Generates personalized fixture cards for every player in the tournament
- Sends each player their fixtures via WhatsApp Business API (template message with image)
- Uses magic links (unique per-player URL) so players can tap to see their full schedule
- **Stretch:** Auto-send fixtures when schedule is first generated

---

### 3. No Deadline System

**Problem:** Matches have no deadlines, rounds drag on indefinitely.

**Solution: Round Deadline Engine**

- Add `deadline` field to Match or a `roundDeadline` on Tournament rounds
- Admin sets deadline when generating fixtures (e.g., "Round 2 must be played by April 15")
- **Automated escalation chain:**

| Time | Action | Channel |
|------|--------|---------|
| 24h before | "Your match vs X is tomorrow" | Push + WhatsApp |
| 2h before | "Play your match soon" | Push + WhatsApp |
| 30min before | "Final warning — forfeit in 30 min" | Push + WhatsApp |
| Deadline hit | Auto-forfeit (configurable) OR flag for admin | Push + Admin alert |

- Powered by Vercel Cron running every 15 minutes, querying approaching deadlines
- Track reminder state per match to avoid duplicates

---

### 4. No Reminder System

**Problem:** You manually message everyone to play their matches.

**Solution: Smart Notification Pipeline**

- Leverage your existing `notify()` → Web Push + FCM infrastructure
- Add WhatsApp Business Cloud API as a third channel (via Twilio or direct Meta API, ~$0.005/msg)
- **Template messages pre-approved by WhatsApp:**

```
🏆 BWL Match Reminder
{{player_name}}, your {{game}} match vs {{opponent}} is scheduled.
Deadline: {{deadline}}
Tap to coordinate: {{match_url}}
```

- **Reminder triggers:** Match created, 24h before deadline, 2h before, 30min before, deadline reached
- Players who've completed their match don't get nagged

---

### 5. No Player Coordination / Room ID System

**Problem:** For eFootball 1v1s and PUBG, players need to coordinate timing and share Room IDs. Currently done manually.

**Solution: Match Lobby System** (inspired by Toornament's Match Lobby)

#### A) Match Coordination Page (per-match, player-facing)
- Unique magic link sent to both players (no player auth needed)
- Shows: opponent info, match rules, deadline countdown
- **"I'm Ready" check-in:** Both players tap "Ready" → match status changes to LIVE
- **Auto-forfeit timer:** If one player doesn't check in within 15 min of agreed time, they forfeit
- Simple status messages: "Waiting for opponent...", "Both ready — start playing!", "Match expired"

#### B) Room ID System (for eFootball & PUBG)
- Home player creates the room and enters Room ID on the match page
- Opponent gets instant push notification: "Room ID is ready — join now!"
- Room ID visible only to the two participants (magic link authenticated)
- For PUBG customs: Admin creates room, credentials auto-revealed 15 min before start

#### C) Self-Scheduling
- Admin sets a deadline window (e.g., "Play between April 10-15")
- Player A proposes a time → Player B accepts/proposes alternative
- If no agreement by deadline-24h, admin auto-assigns a time
- All via push notifications + match page UI

---

### 6. Player Score Self-Reporting

**The single highest-impact feature for reducing your workload.**

**Inspired by Start.gg's model:**

- After a match, Player A taps their magic link → enters score (e.g., "3-1") + optional proof screenshot
- Player B gets notified → taps to Confirm or Dispute
- **If confirmed:** match auto-completes, standings update, bracket advances, result card shared — zero admin involvement
- **If disputed:** Admin gets a notification with both claims + evidence screenshots → makes ruling
- If Player B doesn't respond in X hours: score auto-confirmed
- **No player accounts needed** — use unique per-match magic tokens sent via WhatsApp/push

---

## Additional Automation Ideas

### Auto-Generated Content

| Feature | Trigger | Output |
|---------|---------|--------|
| Match result card | Score entered | PNG shared to WhatsApp group |
| Round summary card | All round matches done | Standings + results image |
| Tournament recap | Tournament completed | Summary poster with stats, MVP, top scorer |
| Player of the week | Weekly cron | Auto-pick best performer, generate card |

### Smart Tournament Management
- **Auto-knockout generation** (already in your backlog as FEAT-H2) — one click to generate QF/SF/Final from group standings
- **Auto-suspend on red card** — if a RED_CARD event is logged, auto-set `player.suspendedUntil` for next match
- **Auto-award detection** — after tournament ends, auto-detect Golden Boot, Most Assists, Best Player candidates
- **Inactivity detection** — flag players who haven't played in X days

### WhatsApp Bot (Advanced)
Players reply to WhatsApp messages with scores:
- `"3-1"` → parsed and submitted
- `"status"` → bot replies with upcoming matches
- `"standings"` → bot replies with current standings

Powered by WhatsApp Business API webhooks

---

## Implementation Priority Matrix

| Priority | Feature | Effort | Impact | Dependencies |
|----------|---------|--------|--------|--------------|
| **P0** | Match deadlines + auto reminders | Medium | 🔴 Critical | Vercel Cron, deadline field |
| **P0** | Auto-share result to WhatsApp on score entry | Medium | 🔴 Critical | WhatsApp API or enhanced share flow |
| **P1** | Player score self-reporting (magic links) | High | 🔴 Critical | Token auth, new match page |
| **P1** | Match lobby + "I'm Ready" check-in | Medium | 🟠 High | Magic links, match page |
| **P1** | Room ID sharing system | Low | 🟠 High | Field on Match model, push trigger |
| **P1** | Bulk fixture distribution | Medium | 🟠 High | Server-side image gen, WhatsApp API |
| **P2** | Self-scheduling within deadline windows | High | 🟡 Medium | Player coordination page |
| **P2** | Score dispute workflow | Medium | 🟡 Medium | Self-reporting system |
| **P2** | Auto-forfeit on deadline expiry | Low | 🟡 Medium | Deadline system |
| **P3** | WhatsApp bot (score via reply) | High | 🟢 Nice-to-have | WhatsApp webhook |
| **P3** | Auto-awards detection | Low | 🟢 Nice-to-have | Tournament completion |

---

## Tech Stack for New Features

| Need | Solution | Why |
|------|----------|-----|
| WhatsApp messaging | Meta Cloud API (direct) or Twilio | Template messages, image sending, webhooks |
| Scheduled jobs | Vercel Cron | Already on Vercel, free tier has 2 crons |
| Server image generation | @vercel/og (satori) | Write cards in JSX, free on Vercel |
| Magic links | JWT tokens with short expiry | No player auth system needed |
| Room ID security | Match-scoped tokens | Only participants see room credentials |

---

## The End State Vision

### Before (now):
- Admin enters score → goes to match page → shares to WhatsApp → goes to next match → repeats
- Manually messages each player about fixtures
- Manually reminds everyone to play
- No deadlines, no coordination

### After:
- Admin enters score (or player self-reports) → system auto-completes standings, shares result card to WhatsApp group, notifies participants
- Fixtures auto-sent to each player on schedule generation
- Deadlines enforce themselves with escalating reminders
- Players coordinate via match lobby, share Room IDs, check in with "I'm Ready"
- **Admin only intervenes for disputes**

---

## 🚨 Critical (Fix Immediately)

### CRIT-1: Missing RBAC in Venue Actions
**Priority:** P0 | **Effort:** 1h | **Assignee:** Unassigned

**Issue:** `updateVenue()` and `deleteVenue()` in `venue.ts` missing `hasRole()` checks. Any authenticated user can modify venues.

**Acceptance Criteria:**
- [ ] Add `hasRole(AdminRole.ADMIN)` check to `updateVenue()`
- [ ] Add `hasRole(AdminRole.ADMIN)` check to `deleteVenue()`
- [ ] Audit all other action files for similar gaps
- [ ] Add unit tests for role checks

**Files:** `src/lib/actions/venue.ts`

---

### CRIT-2: Inconsistent Admin Check Pattern
**Priority:** P0 | **Effort:** 2h | **Assignee:** Unassigned

**Issue:** `tournament.ts` uses `requireAdmin()` while other files use `hasRole()` pattern. Inconsistent patterns lead to security gaps.

**Acceptance Criteria:**
- [ ] Standardize on `hasRole()` pattern across all action files
- [ ] Remove or unify `requireAdmin()` helper
- [ ] Document the chosen pattern in AGENTS.md
- [ ] Update all imports and usages

**Files:** `src/lib/actions/tournament.ts`, `src/lib/auth.ts`

---

## ⚠️ High Priority (Fix This Sprint)

### HIGH-1: N+1 Query on Tournament Detail Page
**Priority:** P1 | **Effort:** 4h | **Assignee:** Unassigned

**Issue:** Admin tournament detail page loads each team's roster individually via `Promise.all(tournament.teams.map(...getTeamById))`. Severe performance impact with many teams.

**Acceptance Criteria:**
- [ ] Use Prisma `include` to fetch teams and rosters in single query
- [ ] Add DataLoader pattern if needed for complex nested queries
- [ ] Measure before/after query count with logging
- [ ] Verify performance with 20+ teams tournament

**Files:** `src/app/(admin)/admin/tournaments/[id]/page.tsx`

---

### HIGH-2: Missing Database Indexes on isActive Fields
**Priority:** P1 | **Effort:** 2h | **Assignee:** Unassigned

**Issue:** `Team.isActive` and `Player.isActive` not indexed. Every list page filters on these fields causing full table scans.

**Acceptance Criteria:**
- [ ] Add `@index([isActive])` to `Team` model
- [ ] Add `@index([isActive])` to `Player` model
- [ ] Generate and run migration
- [ ] Verify query performance improvement with EXPLAIN ANALYZE

**Files:** `prisma/schema.prisma`

---

### HIGH-3: Image Cache Memory Leak
**Priority:** P1 | **Effort:** 3h | **Assignee:** Unassigned

**Issue:** SmartAvatar cache has no LRU eviction. If 500+ fresh entries exist simultaneously, no eviction occurs - unbounded memory growth.

**Acceptance Criteria:**
- [ ] Implement LRU (Least Recently Used) eviction with 200 entry limit
- [ ] Add cache size metrics/logging
- [ ] Add cache hit/miss ratio monitoring
- [ ] Document cache behavior

**Files:** `src/components/smart-avatar.tsx`

---

## 🤖 Automation Features Backlog (New)

### AUTO-1: Match Deadlines + Auto Reminders
**Priority:** P0 | **Effort:** 8h | **Assignee:** Unassigned | **Value:** Critical

Add deadline field to Match model and automated reminder system.

**Acceptance Criteria:**
- [ ] Add `deadline` DateTime field to Match model
- [ ] Add `reminderSentAt` JSON field to track reminder state
- [ ] Admin UI to set deadlines when generating fixtures
- [ ] Vercel Cron job running every 15 minutes
- [ ] Escalating reminder chain: 24h → 2h → 30min → deadline
- [ ] WhatsApp Business API integration for reminders
- [ ] Auto-forfeit or admin flag on deadline expiry

**Files:** `prisma/schema.prisma`, `src/lib/actions/match.ts`, `src/app/api/cron/reminders/route.ts`

---

### AUTO-2: Auto-Share Result to WhatsApp on Score Entry
**Priority:** P0 | **Effort:** 8h | **Assignee:** Unassigned | **Value:** Critical

Automatically generate result card and share to WhatsApp group when score is entered.

**Acceptance Criteria:**
- [ ] Server-side image generation API using @vercel/og
- [ ] WhatsApp Cloud API integration for group messages
- [ ] Auto-trigger on `updateMatchResult()` action
- [ ] Configurable WhatsApp group ID per tournament
- [ ] Fallback to existing share flow if API fails

**Files:** `src/app/api/og/result-card/route.tsx`, `src/lib/whatsapp.ts`, `src/lib/actions/match.ts`

---

### AUTO-3: Player Score Self-Reporting (Magic Links)
**Priority:** P1 | **Effort:** 16h | **Assignee:** Unassigned | **Value:** Critical

Allow players to submit scores via magic links without needing accounts.

**Acceptance Criteria:**
- [ ] JWT token generation for match-specific magic links
- [ ] Public match page accessible via magic link
- [ ] Score entry form with proof screenshot upload
- [ ] Opponent notification for confirmation/dispute
- [ ] Auto-complete on mutual confirmation
- [ ] Dispute escalation to admin
- [ ] Auto-confirm if no response within X hours

**Files:** `src/lib/tokens.ts`, `src/app/match/[token]/page.tsx`, `src/lib/actions/self-report.ts`

---

### AUTO-4: Match Lobby + "I'm Ready" Check-in
**Priority:** P1 | **Effort:** 12h | **Assignee:** Unassigned | **Value:** High

Match coordination page with player check-in system.

**Acceptance Criteria:**
- [ ] Match lobby page with opponent info and countdown
- [ ] "I'm Ready" button for each player
- [ ] Status transitions: SCHEDULED → READY → LIVE
- [ ] Auto-forfeit if player doesn't check in within 15min
- [ ] Real-time status updates (Server-Sent Events or polling)

**Files:** `src/app/lobby/[token]/page.tsx`, `src/lib/actions/lobby.ts`

---

### AUTO-5: Room ID Sharing System
**Priority:** P1 | **Effort:** 4h | **Assignee:** Unassigned | **Value:** High

Secure room ID sharing for eFootball and PUBG matches.

**Acceptance Criteria:**
- [ ] Add `roomId` field to Match model
- [ ] Home player can enter Room ID on match page
- [ ] Opponent receives push notification when Room ID added
- [ ] Room ID visible only to match participants (magic link auth)
- [ ] PUBG custom room credentials auto-reveal 15min before start

**Files:** `prisma/schema.prisma`, `src/lib/actions/match.ts`, `src/components/match/room-id-display.tsx`

---

### AUTO-6: Bulk Fixture Distribution
**Priority:** P1 | **Effort:** 10h | **Assignee:** Unassigned | **Value:** High

One-click fixture distribution to all players via WhatsApp.

**Acceptance Criteria:**
- [ ] "Send All Fixtures" button on tournament admin page
- [ ] Personalized fixture card generation for each player
- [ ] WhatsApp Business API bulk messaging
- [ ] Magic link generation for each player's schedule
- [ ] Delivery status tracking
- [ ] Stretch: Auto-send on schedule generation

**Files:** `src/app/(admin)/admin/tournaments/[id]/fixtures/page.tsx`, `src/lib/actions/bulk-fixtures.ts`

---

### AUTO-7: Self-Scheduling Within Deadline Windows
**Priority:** P2 | **Effort:** 16h | **Assignee:** Unassigned | **Value:** Medium

Allow players to propose and agree on match times within admin-set windows.

**Acceptance Criteria:**
- [ ] Admin sets deadline window (start → end)
- [ ] Player A proposes time slots
- [ ] Player B accepts or proposes alternatives
- [ ] Push notifications for proposals/responses
- [ ] Auto-assign time if no agreement by deadline-24h
- [ ] Match scheduled time stored in Match model

**Files:** `src/lib/actions/scheduling.ts`, `src/app/lobby/[token]/schedule/page.tsx`

---

### AUTO-8: Score Dispute Workflow
**Priority:** P2 | **Effort:** 8h | **Assignee:** Unassigned | **Value:** Medium

Handle disputed scores with admin arbitration.

**Acceptance Criteria:**
- [ ] Dispute button for opponent
- [ ] Admin notification with both score claims
- [ ] Evidence screenshot display
- [ ] Admin ruling interface
- [ ] Winner/loser assignment
- [ ] Audit trail of dispute resolution

**Files:** `src/lib/actions/dispute.ts`, `src/app/admin/disputes/page.tsx`

---

### AUTO-9: Auto-Forfeit on Deadline Expiry
**Priority:** P2 | **Effort:** 4h | **Assignee:** Unassigned | **Value:** Medium

Automatically forfeit matches when deadline passes.

**Acceptance Criteria:**
- [ ] Configurable auto-forfeit vs admin flag
- [ ] Forfeit logic in cron job
- [ ] Notification to both players
- [ ] Standings update with walkover result
- [ ] Track forfeit reason (deadline expiry)

**Files:** `src/lib/actions/forfeit.ts`, `src/app/api/cron/reminders/route.ts`

---

## 📋 Technical Debt (Gradual Improvement)

### DEBT-1: TypeScript Strictness - Remove `as any` Casts
**Priority:** P2 | **Effort:** 8h | **Assignee:** Unassigned

**Issue:** 40+ `as any` / `as never` casts across codebase, mostly in award rendering and enum displays. Hides real type issues.

**Acceptance Criteria:**
- [ ] Find all `as any` and `as never` casts
- [ ] Replace with proper type guards or fix underlying types
- [ ] Enable `no-explicit-any` ESLint rule
- [ ] Add type tests for critical paths

**Files:** Multiple - search for `as any` / `as never`

**Progress:** 0 / 40 casts removed

---

### DEBT-2: RBAC Audit Completion
**Priority:** P2 | **Effort:** 4h | **Assignee:** Unassigned

**Issue:** RBAC gaps may exist beyond venue.ts. Complete audit needed.

**Acceptance Criteria:**
- [ ] Audit all 70+ server actions for proper role checks
- [ ] Create matrix of actions vs required roles
- [ ] Document in SECURITY.md
- [ ] Add integration tests for each role level

**Files:** `src/lib/actions/*.ts`

---

## ✨ Legacy Feature Backlog

### FEAT-H1: Player Comparison Page
**Priority:** P1 | **Effort:** 8h | **Assignee:** Unassigned | **Value:** High

Side-by-side stat comparison for any two players.

**Acceptance Criteria:**
- [ ] Route: `/players/compare?p1=id&p2=id`
- [ ] Visual stat bars comparing key metrics
- [ ] Works across all game categories
- [ ] Shareable comparison URLs
- [ ] Mobile-responsive layout

---

### FEAT-H2: Tournament Bracket Visualization
**Priority:** P1 | **Effort:** 16h | **Assignee:** Unassigned | **Value:** High

Visual bracket tree for knockout stages instead of table rows.

**Acceptance Criteria:**
- [ ] SVG or canvas-based bracket renderer
- [ ] Support single/double elimination
- [ ] Clickable matches to view details
- [ ] Printable view
- [ ] Export as PNG/PDF
- [ ] Mobile-friendly (collapsible rounds)

**Dependencies:** Knockout match progression data already exists (`nextMatchId`)

---

### FEAT-H3: Push Notifications
**Priority:** P1 | **Effort:** 12h | **Assignee:** Unassigned | **Value:** High

Notify users when match goes LIVE or results are posted.

**Acceptance Criteria:**
- [ ] Web Push API integration
- [ ] Capacitor Push for mobile app
- [ ] User preference settings (which tournaments, which events)
- [ ] Admin notification controls
- [ ] Delivery tracking/analytics

**Events to notify:**
- Match starts (LIVE status change)
- Match result posted
- Tournament starts
- Knockout bracket advancement

---

### FEAT-H4: Match Highlights / Rich Notes
**Priority:** P1 | **Effort:** 6h | **Assignee:** Unassigned | **Value:** High

Rich text field for admins to write match summaries shown on public detail.

**Acceptance Criteria:**
- [ ] Rich text editor in admin (TipTap or similar)
- [ ] Support images, video embeds
- [ ] Public display on match detail page
- [ ] SEO-friendly markup
- [ ] Character limit with counter

**Files:** `Match` model (add `highlights` field), admin match form

---

### FEAT-M1: ELO Ranking System
**Priority:** P2 | **Effort:** 10h | **Assignee:** Unassigned | **Value:** Medium

Auto-calculated ratings for eFootball players, updated after each match.

**Acceptance Criteria:**
- [ ] ELO algorithm for 1v1 matches
- [ ] Historical rating chart on player profile
- [ ] Top rated players leaderboard
- [ ] Rating decay for inactivity
- [ ] Admin override capability

**Formula:** Standard ELO with K-factor 32 for established players, 40 for new

---

### FEAT-M2: Bulk Match Result Entry
**Priority:** P2 | **Effort:** 8h | **Assignee:** Unassigned | **Value:** Medium

Enter multiple match scores from one screen (useful for tournament day).

**Acceptance Criteria:**
- [ ] Grid/table view of all pending matches
- [ ] Inline score editing
- [ ] Batch save with validation
- [ ] Support for different game types
- [ ] Mobile-friendly for on-the-ground entry

**Use Case:** Tournament admin entering scores from multiple simultaneous matches

---

### FEAT-M3: Player of the Season
**Priority:** P2 | **Effort:** 6h | **Assignee:** Unassigned | **Value:** Medium

Auto-calculated from goals + assists + MOTM + avg rating across a season.

**Acceptance Criteria:**
- [ ] Algorithm weighting stats by game category
- [ ] Season standings page
- [ ] Award badge on player profile
- [ ] Historical season winners
- [ ] Admin-adjustable weights

**Formula:**
```
Score = (goals * 3) + (assists * 2) + (MOTM * 5) + (avgRating * 10)
```

---

### FEAT-M4: Global Search
**Priority:** P2 | **Effort:** 10h | **Assignee:** Unassigned | **Value:** Medium

Global search bar in navbar searching players, teams, tournaments, matches.

**Acceptance Criteria:**
- [ ] Keyboard shortcut (Cmd+K)
- [ ] Fuzzy search across all entities
- [ ] Search results categorization
- [ ] Recent searches
- [ ] Debounced input (300ms)
- [ ] Algolia or PostgreSQL full-text search

---

### FEAT-N1: Dark/Light Theme Toggle
**Priority:** P3 | **Effort:** 4h | **Assignee:** Unassigned | **Value:** Low

Currently dark only. Add light theme option.

**Acceptance Criteria:**
- [ ] Theme toggle in navbar/footer
- [ ] CSS variables for all colors
- [ ] System preference detection
- [ ] Persistence in localStorage
- [ ] No flash on load

---

### FEAT-N2: Match Predictions
**Priority:** P3 | **Effort:** 12h | **Assignee:** Unassigned | **Value:** Low

Let logged-in users predict scores before matches.

**Acceptance Criteria:**
- [ ] Prediction input before match starts
- [ ] Leaderboard of top predictors
- [ ] Points system for accuracy
- [ ] Prediction history on user profile
- [ ] Anonymous vs registered predictions

---

### FEAT-N3: Social Sharing Cards
**Priority:** P3 | **Effort:** 8h | **Assignee:** Unassigned | **Value:** Low

OG images auto-generated with match scores for WhatsApp/Twitter sharing.

**Acceptance Criteria:**
- [ ] Dynamic OG image generation (Canvas/Satori)
- [ ] Match-specific share cards
- [ ] Tournament bracket share images
- [ ] Player stat cards

---

### FEAT-N4: Tournament Brackets PDF Export
**Priority:** P3 | **Effort:** 6h | **Assignee:** Unassigned | **Value:** Low

Printable bracket sheets for offline tournament days.

**Acceptance Criteria:**
- [ ] PDF generation for brackets
- [ ] Team list roster pages
- [ ] Schedule/timetable export
- [ ] A4 and Letter size support

---

## 🔄 In Progress

*None currently*

---

## ✅ Recently Completed

| Item | Completed | By |
|------|-----------|-----|
| Schema design with 18 models | 2026-03-15 | Initial build |
| Admin interface full CRUD | 2026-03-20 | Initial build |
| Public pages with ISR | 2026-03-25 | Initial build |
| PUBG battle royale system | 2026-03-28 | Initial build |
| Export API (CSV/JSON) | 2026-04-01 | Initial build |
| Tournament cloning | 2026-04-02 | Initial build |
| Live scoring page | 2026-04-05 | Initial build |

---

## 📊 Sprint Planning

### Sprint 1 (Current) - Security & Stability
- [ ] CRIT-1: Missing RBAC in venue actions
- [ ] CRIT-2: Inconsistent admin check pattern
- [ ] HIGH-1: N+1 query fix
- [ ] HIGH-2: Missing indexes

### Sprint 2 - Automation Foundation
- [ ] AUTO-1: Match deadlines + auto reminders
- [ ] AUTO-2: Auto-share result to WhatsApp
- [ ] HIGH-3: Image cache LRU

### Sprint 3 - Player Self-Service
- [ ] AUTO-3: Player score self-reporting
- [ ] AUTO-4: Match lobby + "I'm Ready" check-in
- [ ] AUTO-5: Room ID sharing system

### Sprint 4 - Bulk Distribution
- [ ] AUTO-6: Bulk fixture distribution
- [ ] AUTO-7: Self-scheduling
- [ ] FEAT-H4: Match highlights

---

## 📝 Notes

### Adding New Items

When adding to this backlog:

1. **Priority:** P0 (Critical), P1 (High), P2 (Medium), P3 (Low)
2. **Effort:** Hours estimated (use 4h, 8h, 16h, 24h buckets)
3. **ID Pattern:** CRIT-#, HIGH-#, DEBT-#, AUTO-#, FEAT-H/M/N#

### Updating Status

Move items between sections as they progress:
1. Backlog → In Progress (when started)
2. In Progress → Recently Completed (when done)
3. Archive completed items after 1 month

### Effort Legend

| Hours | Complexity |
|-------|------------|
| 1-2h | Quick fix, single file |
| 4h | Small feature, 2-3 files |
| 8h | Medium feature, new component |
| 16h | Large feature, multi-file changes |
| 24h+ | Epic, requires planning |

---

**Recommended Starting Point:** AUTO-1 (Match deadlines + auto reminders) — it builds on your existing notification infrastructure and solves your biggest coordination headache.

---

*This backlog is auto-generated from assessment and should be updated as work progresses.*
