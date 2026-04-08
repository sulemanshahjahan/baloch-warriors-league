# BWL Platform Backlog

> **Assessment Date:** 2026-04-08  
> **Current Score:** 8.2 / 10  
> **Last Updated:** Auto-generated from assessment report

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

## ✨ Feature Backlog

### Features - High Value

#### FEAT-H1: Player Comparison Page
**Priority:** P1 | **Effort:** 8h | **Assignee:** Unassigned | **Value:** High

Side-by-side stat comparison for any two players (not just H2H match history).

**Acceptance Criteria:**
- [ ] Route: `/players/compare?p1=id&p2=id`
- [ ] Visual stat bars comparing key metrics
- [ ] Works across all game categories
- [ ] Shareable comparison URLs
- [ ] Mobile-responsive layout

**Mock Data:**
```
Stats to compare:
- Goals / Kills / Frame wins
- Assists / Deaths / Frame losses  
- Matches played
- Win rate
- MOTM / MVP count
- Recent form (last 5 matches)
```

---

#### FEAT-H2: Tournament Bracket Visualization
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

#### FEAT-H3: Push Notifications
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

#### FEAT-H4: Match Highlights / Rich Notes
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

### Features - Medium Value

#### FEAT-M1: ELO Ranking System
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

#### FEAT-M2: Bulk Match Result Entry
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

#### FEAT-M3: Player of the Season
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

#### FEAT-M4: Global Search
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

### Features - Nice to Have

#### FEAT-N1: Dark/Light Theme Toggle
**Priority:** P3 | **Effort:** 4h | **Assignee:** Unassigned | **Value:** Low

Currently dark only. Add light theme option.

**Acceptance Criteria:**
- [ ] Theme toggle in navbar/footer
- [ ] CSS variables for all colors
- [ ] System preference detection
- [ ] Persistence in localStorage
- [ ] No flash on load

---

#### FEAT-N2: Match Predictions
**Priority:** P3 | **Effort:** 12h | **Assignee:** Unassigned | **Value:** Low

Let logged-in users predict scores before matches.

**Acceptance Criteria:**
- [ ] Prediction input before match starts
- [ ] Leaderboard of top predictors
- [ ] Points system for accuracy
- [ ] Prediction history on user profile
- [ ] Anonymous vs registered predictions

---

#### FEAT-N3: Social Sharing Cards
**Priority:** P3 | **Effort:** 8h | **Assignee:** Unassigned | **Value:** Low

OG images auto-generated with match scores for WhatsApp/Twitter sharing.

**Acceptance Criteria:**
- [ ] Dynamic OG image generation (Canvas/Satori)
- [ ] Match-specific share cards
- [ ] Tournament bracket share images
- [ ] Player stat cards

---

#### FEAT-N4: Tournament Brackets PDF Export
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

### Sprint 2 - Performance & Polish
- [ ] HIGH-3: Image cache LRU
- [ ] DEBT-1: TypeScript casts (batch 1 - 20 casts)
- [ ] FEAT-H4: Match highlights

### Sprint 3 - Features - High Value
- [ ] FEAT-H1: Player comparison
- [ ] FEAT-H2: Bracket visualization
- [ ] DEBT-1: TypeScript casts (batch 2 - remaining)

### Sprint 4 - Notifications & Polish
- [ ] FEAT-H3: Push notifications
- [ ] FEAT-M4: Global search
- [ ] FEAT-M2: Bulk result entry

---

## 📝 Notes

### Adding New Items

When adding to this backlog:

1. **Priority:** P0 (Critical), P1 (High), P2 (Medium), P3 (Low)
2. **Effort:** Hours estimated (use 4h, 8h, 16h, 24h buckets)
3. **ID Pattern:** CRIT-#, HIGH-#, DEBT-#, FEAT-H/M/N#

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

*This backlog is auto-generated from assessment and should be updated as work progresses.*
