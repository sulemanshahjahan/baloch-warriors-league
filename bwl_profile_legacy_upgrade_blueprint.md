# BWL User Profile Legacy Upgrade Blueprint

## Project Goal

Upgrade the current BWL player profile from a stats/card page into a full **BWL Legacy Career Profile**.

The profile should make every player feel that their matches, achievements, respect, rivalries, and season activity are building a permanent BWL identity.

Core emotional hook:

> **Play. Prove. Build your BWL legacy.**

This system must reward engagement, history, and status only. It must never give competitive advantage in matches, ELO, cardRank, matchmaking, or tournament results.

---

## Current Profile Assessment

The current profile already has a strong base:

- Player name and nickname
- Profile image
- Card rank
- ELO
- Coins
- Country/location
- FIFA-style player card
- Share card button
- Awards
- Card rank history
- Titles held
- Form and streaks
- Badges
- Career statistics
- Recent matches
- Head-to-head
- Team history

The missing pieces are:

1. Clear long-term progression
2. Visible next reward/unlock
3. Season-based activity loop
4. Match-based challenges/contracts
5. Respect/reputation layer
6. More emotional career storytelling
7. Better trophy/moment presentation
8. Stronger profile layout hierarchy

---

## Main Upgrade Concept

The upgraded profile should become the player's **BWL Legacy Career page**.

Instead of showing only what the player has done, the page should also show:

- What level they are
- What they are close to unlocking
- What season progress they have made
- What contracts they can complete next
- What legacy moments define their career
- How respected/trusted they are
- Which rivalries are active
- What records they are chasing

---

# 1. Profile Layout Blueprint

## 1.1 New Page Structure

Recommended profile layout:

```text
Player Hero
├── Player identity
├── Card rank / ELO / Coins
├── Legacy Level
├── Respect Score
├── Quick actions

Main Content Area
├── Player Card
├── Legacy Road Progress
├── Season Progress
├── BWL Moments
├── Trophy Room
├── Active Contracts
├── Titles Held
├── Badges
├── Career Statistics
├── Recent Matches
├── Rivalries / Head-to-Head
├── Team Legacy
└── Hall of Fame Records

Right Sidebar
├── Next Legacy Unlock
├── Active Season Widget
├── Active Contracts Summary
├── Respect Score Card
├── Awards Summary
└── Card Rank History
```

---

## 1.2 Player Hero Upgrade

Current hero should be upgraded to show legacy identity.

### Current Hero Data

- Name
- Nickname
- Card rank
- ELO
- Coins
- Location

### New Hero Data

Add:

- Legacy Level
- Legacy Tier
- Legacy XP progress
- Respect Score
- Current selected title
- Current selected profile frame/banner
- Challenge button
- Share profile button

### Example UI Copy

```text
Noman "RebelX"
99 Card Rank · 335 ELO · Legacy Level 42 · Elite · Respect 92

[Share Profile] [Share Card] [Challenge Player]
```

### Design Notes

- Keep the dark premium BWL theme.
- Legacy level should be visible near the name, not buried lower down.
- Respect score should be visible but not louder than card rank.
- Add a progress bar under the hero or near the card.

---

# 2. Legacy XP Progress System

## 2.1 Purpose

Legacy XP is the core long-term progression system.

It should reward:

- Playing matches
- Winning matches
- Completing contracts
- Joining tournaments
- Completing tournaments
- Maintaining streaks
- Fair play behavior
- Accurate predictions
- Weekly/seasonal activity

Legacy XP should be permanent or mostly permanent. It represents lifetime BWL activity.

Important rule:

> Legacy XP must not affect ELO, cardRank, match ability, or tournament seeding unless explicitly intended as a non-competitive display stat.

---

## 2.2 Legacy Tiers

Suggested tiers:

| Tier | Level Range | Meaning |
|---|---:|---|
| Rookie | 1-9 | New player |
| Regular | 10-19 | Active member |
| Contender | 20-34 | Competitive player |
| Star | 35-49 | Known performer |
| Elite | 50-69 | Top BWL identity |
| Legend | 70-89 | Historic player |
| Hall of Fame | 90-100 | Permanent legacy status |

Alternative: use fewer levels at launch and expand later.

Recommended MVP:

- 50 levels first
- Add 51-100 later after data matures

---

## 2.3 XP Sources

### Match XP

| Action | Legacy XP | Notes |
|---|---:|---|
| Play a completed match | +50 | Both players/teams |
| Win match | +40 | Winner only |
| Draw match | +20 | If draws exist |
| Lose match but complete fairly | +15 | Prevents only winners from progressing |
| Clean sheet | +25 | Game-specific; eFootball/football only |
| Score 3+ goals | +20 | Game-specific |
| Beat higher ELO player | +50 | Upset bonus |
| Beat much higher ELO player | +100 | Example: +100 ELO difference |
| Comeback win | +75 | If system can detect comeback |
| Play tournament match | +25 | Extra tournament participation XP |
| Final win | +200 | Major moment |
| Tournament win | +500 | Major achievement |

### Activity XP

| Action | Legacy XP | Notes |
|---|---:|---|
| Join tournament | +50 | Once per tournament |
| Complete tournament participation | +150 | Must not quit/disappear |
| Submit score honestly/on time | +20 | If reporting flow supports it |
| Confirm opponent score | +15 | Helps admin workflow |
| Daily check-in/open app | +10 | Optional, capped |
| Weekly active player | +100 | Played at least X matches |

### Prediction XP

| Action | Legacy XP | Notes |
|---|---:|---|
| Correct winner prediction | +20 | Basic prediction |
| Correct scoreline | +75 | Harder |
| Correct MOTM | +30 | If MOTM exists |
| Correct clean sheet | +30 | If applicable |
| Correct upset prediction | +100 | High value |
| Prediction streak 5 | +150 | Weekly or season-based |

### Respect XP

Respect Score should be separate, but some respect actions can also give Legacy XP.

| Action | Legacy XP | Notes |
|---|---:|---|
| No disputes in tournament | +100 | Award after tournament ends |
| On-time match completion | +25 | Requires scheduling/deadline support |
| Fair play vote received | +20 | Capped to prevent abuse |
| Help admin resolve score | +25 | Manual/admin-awarded |

---

## 2.4 XP Anti-Abuse Rules

Add these from day one:

1. Award XP only when match status becomes `COMPLETED`.
2. Use an XP transaction ledger to prevent duplicate rewards.
3. Give XP only once per source/action/object.
4. Cap daily farming XP for repeat matches against same player.
5. Do not award full XP for admin-cancelled or forfeited matches.
6. Do not award prediction points after match starts.
7. Do not allow self-voting for fair play.
8. Respect Score should decrease for disputes, no-shows, fake reports, and tournament dropouts.

---

## 2.5 XP Ledger Model

Every XP event should be stored as a transaction.

### Suggested Table: `LegacyXpTransaction`

```prisma
model LegacyXpTransaction {
  id          String   @id @default(cuid())
  userId      String
  amount      Int
  source      String
  sourceId    String?
  reason      String
  metadata    Json?
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id])

  @@unique([userId, source, sourceId])
  @@index([userId])
  @@index([source, sourceId])
}
```

### Example Sources

```ts
MATCH_PLAYED
MATCH_WIN
MATCH_DRAW
MATCH_LOSS_COMPLETED
CLEAN_SHEET
THREE_GOALS
UPSET_WIN
TOURNAMENT_JOINED
TOURNAMENT_COMPLETED
TOURNAMENT_WIN
CONTRACT_COMPLETED
PREDICTION_CORRECT_WINNER
PREDICTION_CORRECT_SCORE
RESPECT_BONUS
ADMIN_AWARD
```

---

## 2.6 User Legacy Progress Model

### Suggested Table: `UserLegacyProgress`

```prisma
model UserLegacyProgress {
  id              String   @id @default(cuid())
  userId          String   @unique
  totalXp         Int      @default(0)
  level           Int      @default(1)
  tier            String   @default("Rookie")
  currentLevelXp  Int      @default(0)
  nextLevelXp     Int      @default(500)
  updatedAt       DateTime @updatedAt

  user            User     @relation(fields: [userId], references: [id])
}
```

Keep `totalXp` as the source of truth. Level and tier can be recalculated when XP changes.

---

## 2.7 Level Formula

For MVP, avoid a complex formula. Use a simple level table.

### Recommended Level Curve

```ts
const LEVEL_XP_REQUIREMENTS = [
  0,      // Level 1
  500,    // Level 2
  1100,   // Level 3
  1800,   // Level 4
  2600,   // Level 5
  3500,   // Level 6
  4500,   // Level 7
  5600,   // Level 8
  6800,   // Level 9
  8100,   // Level 10
  // continue to level 50 or 100
]
```

Better scalable formula:

```ts
function xpRequiredForLevel(level: number) {
  return Math.floor(400 * Math.pow(level, 1.35));
}
```

Recommended for launch:

- Use a fixed table for first 50 levels.
- Easier to balance.
- Easier to show exact unlocks.

---

## 2.8 Legacy Road Rewards

Each level can unlock rewards.

Reward types:

```ts
type LegacyRewardType =
  | 'COINS'
  | 'TITLE'
  | 'BADGE'
  | 'PROFILE_FRAME'
  | 'BANNER'
  | 'NAME_EFFECT'
  | 'STICKER'
  | 'TROPHY_ROOM_ITEM'
  | 'RAFFLE_TICKET'
  | 'LEGACY_TOKEN';
```

### Suggested Table: `LegacyLevelReward`

```prisma
model LegacyLevelReward {
  id          String   @id @default(cuid())
  level       Int
  tier        String
  rewardType  String
  rewardKey   String
  amount      Int?
  name        String
  description String?
  icon        String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  @@index([level])
}
```

### Suggested Table: `UserLegacyRewardClaim`

```prisma
model UserLegacyRewardClaim {
  id          String   @id @default(cuid())
  userId      String
  rewardId    String
  claimedAt   DateTime @default(now())

  @@unique([userId, rewardId])
}
```

---

## 2.9 Legacy Road UI

### Section Name

**Legacy Road**

### Example UI

```text
Legacy Level 42 — Elite
7,450 / 8,000 XP
Next unlock: Golden Profile Frame

[progress bar]

Recent XP:
+50 Played match vs Sheraz
+40 Won match
+100 Completed Weekly Contract
```

### Component Ideas

- `LegacyProgressCard`
- `LegacyRoadTimeline`
- `NextLegacyUnlockCard`
- `RecentXpActivityList`

---

# 3. Season Progress System

## 3.1 Purpose

Seasons create short-term retention.

Legacy XP is permanent. Season XP resets every season.

Recommended season length:

- 4 to 6 weeks

Good BWL examples:

- BWL Season 1: Road to Glory
- BWL Season 2: Derby Wars
- BWL Ramadan Cup Season
- BWL Eid Champions Season

---

## 3.2 Season XP Sources

Season XP should be easier to earn than Legacy XP because it resets.

| Action | Season XP |
|---|---:|
| Play match | +100 |
| Win match | +75 |
| Complete contract | +150 |
| Join tournament | +100 |
| Complete tournament | +300 |
| Correct prediction | +50 |
| Weekly quest completed | +250 |
| Respect bonus | +100 |

---

## 3.3 Season Model

### Suggested Table: `Season`

```prisma
model Season {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  theme       String?
  description String?
  startsAt    DateTime
  endsAt      DateTime
  isActive    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Suggested Table: `UserSeasonProgress`

```prisma
model UserSeasonProgress {
  id          String   @id @default(cuid())
  userId      String
  seasonId    String
  seasonXp    Int      @default(0)
  level       Int      @default(1)
  updatedAt   DateTime @updatedAt

  @@unique([userId, seasonId])
  @@index([seasonId])
  @@index([userId])
}
```

### Suggested Table: `SeasonXpTransaction`

```prisma
model SeasonXpTransaction {
  id          String   @id @default(cuid())
  userId      String
  seasonId    String
  amount      Int
  source      String
  sourceId    String?
  reason      String
  metadata    Json?
  createdAt   DateTime @default(now())

  @@unique([userId, seasonId, source, sourceId])
  @@index([userId, seasonId])
}
```

---

## 3.4 Season Rewards

### Suggested Table: `SeasonReward`

```prisma
model SeasonReward {
  id          String   @id @default(cuid())
  seasonId    String
  level       Int
  rewardType  String
  rewardKey   String
  amount      Int?
  name        String
  description String?
  icon        String?
  isActive    Boolean  @default(true)

  @@index([seasonId, level])
}
```

### Suggested Table: `UserSeasonRewardClaim`

```prisma
model UserSeasonRewardClaim {
  id          String   @id @default(cuid())
  userId      String
  seasonId    String
  rewardId    String
  claimedAt   DateTime @default(now())

  @@unique([userId, rewardId])
}
```

---

## 3.5 Season UI

### Section Name

**Season Progress**

### Example UI

```text
Season 4: Road to Glory
Level 18 / 30
12 days left
Next reward: Derby Week Banner

[progress bar]

Rewards:
Level 19: 250 Coins
Level 20: Elite Red Frame
Level 21: Raffle Ticket
```

### Component Ideas

- `SeasonProgressWidget`
- `SeasonRewardTrack`
- `SeasonCountdown`
- `ClaimSeasonRewardButton`

---

## 3.6 Season Pass Rule

For now, make it free only.

No premium paid pass in MVP.

Reason:

- BWL is a real local competitive league.
- Avoid pay-to-win perception.
- Build trust first.
- Later, if monetization is needed, only sell cosmetics or sponsor-funded rewards.

---

# 4. Match Contracts System

## 4.1 Purpose

Contracts make every match more exciting.

They are optional challenges players can complete through normal gameplay.

Examples:

- Win your next match
- Play 2 matches today
- Score 3+ goals
- Keep a clean sheet
- Beat a higher-ranked player
- Complete a tournament match
- Predict 3 matches correctly
- Take revenge against a player who beat you

---

## 4.2 Contract Types

### Daily Contracts

Small tasks refreshed daily.

Examples:

```text
Play 1 match today — 100 XP + 50 coins
Submit a prediction — 50 XP + 25 coins
Confirm a score — 50 XP
```

### Weekly Contracts

Medium tasks refreshed weekly.

Examples:

```text
Play 5 matches this week — 500 XP + 250 coins
Win 3 matches this week — 600 XP + badge progress
Get 3 correct predictions — 300 XP + 100 coins
```

### Match Contracts

Attached to next match or selected before playing.

Examples:

```text
Win your next match — 200 XP
Score 3+ goals — 150 XP
Keep clean sheet — 250 XP
Beat a higher ELO player — 300 XP
```

### Rivalry Contracts

Unlocked for repeated matchups.

Examples:

```text
Beat your rival — 300 XP
Take revenge after a loss — 400 XP + Revenge Complete badge progress
Win 3 head-to-head matches — Rivalry Dominator badge
```

### Tournament Contracts

Attached to tournaments.

Examples:

```text
Play all group matches — 500 XP
Reach semi-final — 700 XP
Win final — 1500 XP + trophy room item
No dispute tournament — Respect bonus
```

---

## 4.3 Contract Difficulty

| Difficulty | Reward Range | Use Case |
|---|---:|---|
| Easy | 50-150 XP | Daily activity |
| Medium | 150-500 XP | Match/weekly goals |
| Hard | 500-1200 XP | Tournament/rivalry goals |
| Legendary | 1200+ XP | Rare achievements |

---

## 4.4 Contract Template Model

### Suggested Table: `ContractTemplate`

```prisma
model ContractTemplate {
  id            String   @id @default(cuid())
  title         String
  description   String
  type          String   // DAILY, WEEKLY, MATCH, RIVALRY, TOURNAMENT
  difficulty    String   // EASY, MEDIUM, HARD, LEGENDARY
  conditionKey  String
  conditionJson Json
  rewardXp      Int      @default(0)
  rewardCoins   Int      @default(0)
  rewardType    String?
  rewardKey     String?
  gameType      String?  // EFOOTBALL, PUBG, FOOTBALL, SNOOKER, CHECKERS, ALL
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
}
```

---

## 4.5 User Contract Model

### Suggested Table: `UserContract`

```prisma
model UserContract {
  id              String   @id @default(cuid())
  userId          String
  templateId      String
  seasonId        String?
  tournamentId    String?
  matchId         String?
  status          String   @default("ACTIVE") // ACTIVE, COMPLETED, CLAIMED, EXPIRED, FAILED
  progress        Int      @default(0)
  target          Int      @default(1)
  assignedAt      DateTime @default(now())
  completedAt     DateTime?
  claimedAt       DateTime?
  expiresAt       DateTime?
  metadata        Json?

  @@index([userId, status])
  @@index([seasonId])
  @@index([matchId])
}
```

---

## 4.6 Contract Conditions

Example condition keys:

```ts
PLAY_MATCHES
WIN_MATCHES
SCORE_GOALS
KEEP_CLEAN_SHEETS
BEAT_HIGHER_ELO
JOIN_TOURNAMENT
COMPLETE_TOURNAMENT
REACH_ROUND
WIN_TOURNAMENT
SUBMIT_PREDICTION
CORRECT_PREDICTIONS
BEAT_RIVAL
REVENGE_WIN
NO_DISPUTES
```

Example condition JSON:

```json
{
  "target": 3,
  "timeWindow": "WEEK",
  "gameType": "EFOOTBALL"
}
```

```json
{
  "target": 1,
  "opponentEloDifferenceMin": 50
}
```

---

## 4.7 Contract Evaluation Logic

Contracts should be evaluated after these events:

- Match completed
- Score confirmed
- Prediction settled
- Tournament joined
- Tournament completed
- Tournament round completed
- Respect/fair play action recorded

### Example Flow

```ts
async function onMatchCompleted(matchId: string) {
  const match = await getMatchWithPlayers(matchId);

  await awardMatchLegacyXp(match);
  await awardMatchSeasonXp(match);
  await evaluateContractsForMatch(match);
  await evaluateBadgesForMatch(match);
  await createMomentsForMatch(match);
  await updateRespectScoreAfterMatch(match);
  await sendRewardNotifications(match);
}
```

---

## 4.8 Contract UI

### Section Name

**Active Contracts**

### Example UI

```text
Active Contracts

Win your next match
Reward: +200 XP · +100 coins
Progress: 0 / 1
Expires: Today

Score 3+ goals
Reward: +150 XP
Progress: 2 / 3

Beat a higher-ranked player
Reward: +300 XP · Giant Killer badge progress
Progress: 0 / 1
```

### Component Ideas

- `ActiveContractsCard`
- `ContractProgressBar`
- `ContractRewardBadge`
- `ClaimContractRewardButton`
- `ExpiredContractsHistory`

---

# 5. Respect Score System

## 5.1 Purpose

Respect Score rewards fair behavior in a real-life league.

It should measure:

- Showing up on time
- Completing matches
- Reporting scores honestly
- Avoiding disputes
- Confirming opponent reports
- Finishing tournaments
- Good conduct

It should not be a popularity contest.

---

## 5.2 Respect Score Range

Use 0-100.

| Score | Label |
|---:|---|
| 90-100 | Trusted Player |
| 75-89 | Respected |
| 60-74 | Good Standing |
| 40-59 | Warning Zone |
| 0-39 | Risky Player |

---

## 5.3 Respect Score Events

| Event | Score Change |
|---|---:|
| Completed match on time | +1 |
| Confirmed score honestly | +1 |
| Completed tournament | +3 |
| No dispute in tournament | +5 |
| Received fair play vote | +1 |
| No-show | -8 |
| Fake/incorrect score report | -10 |
| Tournament dropout | -10 |
| Dispute lost | -6 |
| Toxic behavior/admin penalty | -15 |

Cap positive respect gain weekly to prevent farming.

---

## 5.4 Respect Model

### Suggested Table: `UserRespectProfile`

```prisma
model UserRespectProfile {
  id          String   @id @default(cuid())
  userId      String   @unique
  score       Int      @default(80)
  label       String   @default("Good Standing")
  updatedAt   DateTime @updatedAt
}
```

### Suggested Table: `RespectTransaction`

```prisma
model RespectTransaction {
  id          String   @id @default(cuid())
  userId      String
  amount      Int
  source      String
  sourceId    String?
  reason      String
  metadata    Json?
  createdAt   DateTime @default(now())

  @@unique([userId, source, sourceId])
  @@index([userId])
}
```

---

## 5.5 Respect UI

### Section Name

**Respect Score**

### Example UI

```text
Respect Score
92 / 100 — Trusted Player

Strengths:
✓ Completes tournaments
✓ No recent disputes
✓ Trusted score reporter

Recent:
+3 Completed BWL Premier League
+1 Confirmed score vs Sheraz
```

---

# 6. BWL Moments System

## 6.1 Purpose

BWL Moments are permanent career memories.

Badges show achievements. Moments tell the player's story.

Examples:

- First win
- First tournament win
- Reached 99 cardRank
- Longest unbeaten streak
- Biggest comeback
- Giant killer win
- Derby victory
- First clean sheet
- First MOTM
- Season champion
- Fair play recognition

---

## 6.2 Moment Model

### Suggested Table: `UserMoment`

```prisma
model UserMoment {
  id          String   @id @default(cuid())
  userId      String
  type        String
  title       String
  description String
  icon        String?
  imageUrl    String?
  matchId     String?
  tournamentId String?
  seasonId    String?
  rarity      String   @default("COMMON") // COMMON, RARE, EPIC, LEGENDARY
  isPinned    Boolean  @default(false)
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([type])
}
```

---

## 6.3 Moment Rarity

| Rarity | Examples |
|---|---|
| Common | First win, 10 appearances |
| Rare | Clean sheet streak, 5 wins streak |
| Epic | Tournament final, giant killer win |
| Legendary | Tournament winner, Hall of Fame record, 99 cardRank |

---

## 6.4 Moments UI

### Section Name

**BWL Moments**

### Example UI

```text
BWL Moments

[Legendary] Reached 99 Card Rank
Noman reached the highest card rank in BWL.

[Epic] Tournament Winner
Won BWL Premier League.

[Rare] Longest Unbeaten: 24 Matches
Built one of the strongest unbeaten runs.
```

### Component Ideas

- `MomentsGrid`
- `MomentCard`
- `PinnedMomentCard`
- `MomentTimeline`

---

# 7. Trophy Room Upgrade

## 7.1 Purpose

The current awards card is too small for major achievements.

Trophy Room should become a premium section for real achievements.

---

## 7.2 Trophy Categories

- Tournament trophies
- Season awards
- Weekly awards
- Rivalry trophies
- Fair play awards
- Prediction awards
- Event trophies
- Team trophies

---

## 7.3 Trophy Model

If current awards already exist, extend them instead of creating a duplicate system.

Add fields if missing:

```prisma
model UserTrophy {
  id            String   @id @default(cuid())
  userId        String
  title         String
  description   String?
  category      String
  rarity        String   @default("COMMON")
  icon          String?
  imageUrl      String?
  tournamentId  String?
  seasonId      String?
  matchId       String?
  awardedAt     DateTime @default(now())
  isFeatured    Boolean  @default(false)

  @@index([userId])
  @@index([category])
}
```

---

## 7.4 Trophy Room UI

### Section Name

**Trophy Room**

### Example UI

```text
Trophy Room

🏆 Tournament Winner
BWL Premier League
Legendary

🥇 Player of the Week
Week 3, Season 4
Epic

🤝 Fair Play Award
Completed tournament with no disputes
Rare
```

---

# 8. Rivalry System Upgrade

## 8.1 Purpose

The current Head-to-Head section should become a richer rivalry system.

A rivalry starts when two players have played each other multiple times.

Suggested rule:

- Rivalry candidate: 3+ matches
- Active rivalry: 5+ matches or recent repeated matches
- Legendary rivalry: 10+ matches plus close record

---

## 8.2 Rivalry UI

### Section Name

**Rivalries**

### Example UI

```text
Noman vs Sheraz
Head-to-head: 3-2
Last match: Noman won 2-1
Current streak: Noman won last 1
Available badge: Rivalry Dominator
Next contract: Beat Sheraz again for +300 XP
```

---

## 8.3 Rivalry Badges

Examples:

- Derby Winner
- Revenge Complete
- Dominator
- Giant Killer
- Rivalry Legend
- Clean Sheet Derby
- Comeback Rival

---

# 9. BWL Store Integration

## 9.1 Purpose

Coins should be spent on fixed non-random profile rewards.

No crates for MVP.

---

## 9.2 Store Categories

- Profile frames
- Card backgrounds
- Banners
- Titles
- Name colors
- Name effects
- Celebration stickers
- Trophy room decorations
- Streak freezes
- Raffle tickets

---

## 9.3 Store Rules

1. No competitive advantage.
2. No ELO boost.
3. No cardRank boost.
4. No match power boost.
5. No tournament seeding boost.
6. Some items require level/tier before purchase.
7. Some items are season/event limited.
8. Some items require Respect Score threshold.

Example:

```text
Elite Flame Frame
Cost: 2,000 coins
Requirement: Legacy Level 40
Type: Profile Frame
```

---

# 10. Profile Cosmetics System

## 10.1 Cosmetic Types

```ts
type CosmeticType =
  | 'PROFILE_FRAME'
  | 'CARD_BACKGROUND'
  | 'PROFILE_BANNER'
  | 'TITLE'
  | 'NAME_COLOR'
  | 'NAME_EFFECT'
  | 'STICKER'
  | 'TROPHY_ROOM_ITEM';
```

---

## 10.2 User Inventory Model

```prisma
model UserInventoryItem {
  id          String   @id @default(cuid())
  userId      String
  itemType    String
  itemKey     String
  name        String
  source      String   // STORE, LEGACY_LEVEL, SEASON, CONTRACT, ADMIN, EVENT
  sourceId    String?
  acquiredAt  DateTime @default(now())

  @@unique([userId, itemType, itemKey])
  @@index([userId])
}
```

---

## 10.3 Equipped Cosmetics Model

```prisma
model UserEquippedCosmetics {
  id              String   @id @default(cuid())
  userId          String   @unique
  profileFrameKey String?
  cardBgKey       String?
  bannerKey       String?
  titleKey        String?
  nameColorKey    String?
  nameEffectKey   String?
  stickerKey      String?
  updatedAt       DateTime @updatedAt
}
```

---

# 11. Backend Reward Engine

## 11.1 Central Reward Function

Create one central service for awarding XP, coins, contracts, moments, and rewards.

Suggested file:

```text
src/lib/rewards/reward-engine.ts
```

---

## 11.2 Core Functions

```ts
awardLegacyXp({ userId, amount, source, sourceId, reason, metadata })
awardSeasonXp({ userId, seasonId, amount, source, sourceId, reason, metadata })
awardCoins({ userId, amount, source, sourceId, reason })
updateLegacyLevel(userId)
updateSeasonLevel(userId, seasonId)
evaluateUserContracts(userId, event)
createUserMomentIfEligible(userId, event)
updateRespectScore(userId, event)
claimLegacyReward(userId, rewardId)
claimSeasonReward(userId, rewardId)
```

---

## 11.3 Match Completion Reward Flow

```ts
async function processMatchRewards(matchId: string) {
  const match = await getMatchWithParticipants(matchId);

  if (match.status !== 'COMPLETED') return;

  for (const participant of match.participants) {
    await awardLegacyXp({
      userId: participant.userId,
      amount: 50,
      source: 'MATCH_PLAYED',
      sourceId: match.id,
      reason: 'Played a completed match',
    });

    await awardSeasonXpForActiveSeason(participant.userId, 100, 'MATCH_PLAYED', match.id);
  }

  if (match.winnerUserId) {
    await awardLegacyXp({
      userId: match.winnerUserId,
      amount: 40,
      source: 'MATCH_WIN',
      sourceId: match.id,
      reason: 'Won a match',
    });

    await awardSeasonXpForActiveSeason(match.winnerUserId, 75, 'MATCH_WIN', match.id);
  }

  await evaluateContractsForMatch(match);
  await createMomentsForMatch(match);
  await updateRespectAfterCompletedMatch(match);
}
```

---

## 11.4 Idempotency Requirement

Every reward action must be safe to run multiple times without duplicate rewards.

Use unique keys like:

```text
userId + source + sourceId
userId + seasonId + source + sourceId
```

This is critical because match updates may be retried.

---

# 12. Frontend Components

## 12.1 New Components

Suggested component structure:

```text
src/components/profile/legacy/
├── LegacyHero.tsx
├── LegacyProgressCard.tsx
├── NextUnlockCard.tsx
├── SeasonProgressCard.tsx
├── SeasonRewardTrack.tsx
├── ActiveContractsCard.tsx
├── ContractCard.tsx
├── RespectScoreCard.tsx
├── MomentsGrid.tsx
├── MomentCard.tsx
├── TrophyRoom.tsx
├── TrophyCard.tsx
├── RivalriesCard.tsx
├── RivalryCard.tsx
├── RecentXpActivity.tsx
└── ProfileCosmeticsPreview.tsx
```

---

## 12.2 Recommended Page Order

For the current profile page, use this order:

```text
1. Hero
2. Player Card
3. Legacy Progress
4. Season Progress
5. Active Contracts
6. BWL Moments
7. Trophy Room
8. Titles Held
9. Form & Streaks
10. Badges
11. Career Statistics
12. Recent Matches
13. Rivalries / Head-to-Head
14. Team Legacy
15. Hall of Fame Records
```

For desktop, split into:

```text
Left/main column:
- Player Card
- Legacy Progress
- BWL Moments
- Trophy Room
- Titles/Badges
- Career Statistics
- Recent Matches
- Rivalries

Right sidebar:
- Next Unlock
- Season Progress
- Active Contracts
- Respect Score
- Awards Summary
- Rank History
```

For mobile:

- Stack all cards vertically.
- Put Legacy Progress and Season Progress above the player card or immediately after it.
- Keep contracts high enough to drive action.

---

# 13. API / Server Actions

## 13.1 Profile Data Query

Create one profile query that returns all legacy data needed by the page.

Suggested function:

```ts
getPlayerLegacyProfile(playerSlugOrId)
```

Return shape:

```ts
type PlayerLegacyProfile = {
  player: PlayerBasicInfo;
  card: PlayerCardInfo;
  legacy: {
    totalXp: number;
    level: number;
    tier: string;
    currentLevelXp: number;
    nextLevelXp: number;
    progressPercent: number;
    nextUnlock?: RewardPreview;
    recentXp: XpTransactionPreview[];
  };
  season?: {
    id: string;
    name: string;
    level: number;
    seasonXp: number;
    progressPercent: number;
    endsAt: string;
    nextReward?: RewardPreview;
    claimableRewards: RewardPreview[];
  };
  contracts: UserContractPreview[];
  respect: {
    score: number;
    label: string;
    recentEvents: RespectEventPreview[];
  };
  moments: UserMomentPreview[];
  trophies: UserTrophyPreview[];
  titles: TitlePreview[];
  badges: BadgePreview[];
  stats: CareerStats;
  recentMatches: MatchPreview[];
  rivalries: RivalryPreview[];
  rankHistory: RankHistoryPreview[];
};
```

---

## 13.2 Required Actions

```ts
claimLegacyReward(rewardId)
claimSeasonReward(rewardId)
claimContractReward(contractId)
equipProfileCosmetic(itemId)
pinMoment(momentId)
unpinMoment(momentId)
selectActiveTitle(titleKey)
```

---

# 14. Admin Panel Requirements

## 14.1 Admin Legacy Management

Admin should be able to:

- Create/edit Legacy Level rewards
- Create/edit Season
- Create/edit Season rewards
- Create/edit Contract templates
- Manually award XP
- Manually remove incorrect XP transaction
- Manually award trophy/moment
- Adjust respect score with reason
- View reward logs

---

## 14.2 Admin Safety

Every manual admin action must store:

- Admin user ID
- Target user ID
- Reason
- Timestamp
- Before/after values

Suggested table:

```prisma
model AdminRewardAuditLog {
  id            String   @id @default(cuid())
  adminUserId   String
  targetUserId  String
  action        String
  beforeJson    Json?
  afterJson     Json?
  reason        String
  createdAt     DateTime @default(now())

  @@index([adminUserId])
  @@index([targetUserId])
}
```

---

# 15. Notification Triggers

Send push/WhatsApp/app notifications for major reward moments.

## 15.1 Notification Events

- Level up
- New tier reached
- Season level up
- Season reward available
- Contract completed
- Trophy earned
- Moment created
- Respect status upgraded
- Rivalry badge unlocked
- Player enters Hall of Fame

## 15.2 Example Notification Copy

```text
🔥 Legacy Level Up!
Noman reached Level 42 — Elite.
Next unlock: Golden Profile Frame.
```

```text
✅ Contract Completed
You completed: Win your next match.
Reward: +200 XP and +100 coins.
```

```text
🏆 New Trophy Earned
Tournament Winner added to your Trophy Room.
```

---

# 16. Leaderboards

## 16.1 New Leaderboards

Add these leaderboards gradually:

- Legacy XP leaderboard
- Season XP leaderboard
- Respect Score leaderboard
- Contract completions leaderboard
- Prediction leaderboard
- Trophy count leaderboard
- Rivalry wins leaderboard
- Weekly active players leaderboard

---

## 16.2 Leaderboard Rules

- Legacy XP leaderboard is lifetime.
- Season XP leaderboard resets each season.
- Respect leaderboard should hide players below minimum match count.
- Prediction leaderboard should require minimum predictions.
- Do not let coin spending affect competitive leaderboards.

---

# 17. Empty States

Do not show dead/empty sections like:

```text
No team history available.
```

Use motivational empty states.

Examples:

```text
No team legacy yet.
Join a duo or team tournament to start building team history.
```

```text
No BWL Moments yet.
Play matches, win tournaments, and complete contracts to create your first moment.
```

```text
No active contracts.
New contracts will appear when the next season starts or after your next match.
```

---

# 18. MVP Scope

Do not build everything at once.

## Phase 1: Profile Legacy Core

Build first:

1. Legacy XP
2. Legacy Level/Tier
3. Legacy Progress UI
4. Next Unlock UI
5. Season Progress UI
6. Active Contracts UI
7. Respect Score UI
8. XP transaction ledger
9. Basic contract templates
10. Reward notifications

This is enough to make the profile feel upgraded.

---

## Phase 2: Emotional Profile Upgrade

Build next:

1. BWL Moments
2. Trophy Room redesign
3. Pinned moments
4. Better awards display
5. Profile cosmetics inventory
6. Equip frame/banner/title/name effect
7. Recent XP activity feed

---

## Phase 3: Engagement Systems

Build after Phase 2:

1. Prediction League integration
2. Rivalry contracts
3. Rivalry pages
4. Weekly awards
5. Season reward track
6. Event limited rewards
7. Store integration

---

## Phase 4: Advanced Legacy

Build later:

1. Hall of Fame records
2. Team/Clan progression
3. Real prize raffles
4. Legacy Tokens
5. Full career timeline
6. Shareable profile highlight cards

---

# 19. MVP Database Changes Summary

Minimum required tables for Phase 1:

```text
UserLegacyProgress
LegacyXpTransaction
LegacyLevelReward
UserLegacyRewardClaim
Season
UserSeasonProgress
SeasonXpTransaction
SeasonReward
UserSeasonRewardClaim
ContractTemplate
UserContract
UserRespectProfile
RespectTransaction
```

Optional Phase 2 tables:

```text
UserMoment
UserTrophy
UserInventoryItem
UserEquippedCosmetics
AdminRewardAuditLog
```

---

# 20. MVP UI Sections To Add To Current Profile

Add these to the current profile first:

## 20.1 Legacy Progress Card

Position: under player card or near top.

Content:

```text
Legacy Level 42 — Elite
7,450 / 8,000 XP
Next unlock: Golden Profile Frame
```

## 20.2 Season Progress Card

Position: right sidebar or under Legacy Progress.

Content:

```text
Season 4: Road to Glory
Level 18 / 30
12 days left
Next reward: Derby Week Banner
```

## 20.3 Active Contracts Card

Position: right sidebar and/or main column.

Content:

```text
Win your next match — +200 XP
Score 3+ goals — +150 XP
Beat higher-ranked player — +300 XP
```

## 20.4 Respect Score Card

Position: right sidebar.

Content:

```text
Respect 92 / 100 — Trusted Player
No recent disputes · Trusted reporter
```

## 20.5 BWL Moments Grid

Position: main column above badges.

Content:

```text
Reached 99 Card Rank
Tournament Winner
Longest Unbeaten: 24
First Clean Sheet
```

---

# 21. UI Design Direction

## 21.1 Visual Style

Keep current dark theme but make profile feel more premium.

Recommended visual language:

- Dark charcoal background
- Soft glowing cards
- Gold/blue/red accents
- Rarity-based borders
- Subtle gradients
- Compact but readable stat cards
- FIFA-style premium glow around high-level player card

## 21.2 Rarity Colors

| Rarity | Style |
|---|---|
| Common | Grey border |
| Rare | Blue border |
| Epic | Purple border |
| Legendary | Gold border/glow |
| Event | Red/gold seasonal glow |

## 21.3 Avoid

- Too many bright colors at once
- Too much text inside small cards
- Random reward visuals that feel like gambling/crates
- Empty blocks that make profile feel unfinished
- Overloading mobile view

---

# 22. Acceptance Criteria

## 22.1 Legacy XP

- XP is awarded when eligible match/tournament/prediction/contract events happen.
- XP is never duplicated for the same source.
- User level updates after XP changes.
- Next level progress displays correctly.
- Level rewards can be claimed once.

## 22.2 Season Progress

- Active season is detected correctly.
- Season XP is tracked separately from Legacy XP.
- Season level resets per season.
- Season rewards can be claimed once.
- Season countdown displays correctly.

## 22.3 Contracts

- Users can see active contracts.
- Contract progress updates after matches/predictions/tournaments.
- Completed contracts can be claimed once.
- Expired contracts stop progressing.
- Rewards are logged through XP/coin transaction system.

## 22.4 Respect Score

- Respect score displays on profile.
- Respect transactions are logged.
- Admin/manual changes require reason.
- Score label updates correctly.

## 22.5 Profile UI

- Legacy information appears near top of profile.
- Mobile layout remains clean.
- Empty states are motivational.
- Current stats, badges, awards, and recent matches continue working.

---

# 23. Implementation Checklist

## Backend

- [ ] Add database models
- [ ] Run migration
- [ ] Seed initial Legacy Level rewards
- [ ] Seed first Season
- [ ] Seed Season rewards
- [ ] Seed Contract templates
- [ ] Create reward engine service
- [ ] Add XP ledger logic
- [ ] Add season XP ledger logic
- [ ] Add contract evaluation logic
- [ ] Add respect score logic
- [ ] Connect reward processing to match completion
- [ ] Add reward claim actions
- [ ] Add admin audit log for manual rewards

## Frontend

- [ ] Add Legacy Progress card
- [ ] Add Next Unlock card
- [ ] Add Season Progress card
- [ ] Add Active Contracts card
- [ ] Add Respect Score card
- [ ] Add BWL Moments section
- [ ] Upgrade Trophy Room section
- [ ] Improve Head-to-Head into Rivalries
- [ ] Hide or improve empty sections
- [ ] Add mobile layout support

## Admin

- [ ] Manage seasons
- [ ] Manage level rewards
- [ ] Manage contract templates
- [ ] Manually award XP/coins/trophies
- [ ] Adjust respect score
- [ ] View reward transaction logs

## QA

- [ ] Match completion gives correct XP
- [ ] XP is not duplicated after repeated save
- [ ] Level-up works
- [ ] Season XP works
- [ ] Contract progress works
- [ ] Contract claim works
- [ ] Respect score changes work
- [ ] Profile loads fast
- [ ] Mobile UI works
- [ ] Empty states display properly

---

# 24. Recommended Launch Version

The best first public version should include:

1. Legacy Level and XP
2. Season Progress
3. Active Contracts
4. Respect Score
5. Next Unlock
6. Improved Trophy Room
7. BWL Moments basic grid
8. Reward notifications

Do not launch Store, Raffles, Legacy Tokens, or Hall of Fame in the first upgrade unless the core profile progression is already stable.

---

# 25. Final Product Definition

The upgraded BWL profile should answer five questions immediately:

1. **Who is this player?**
2. **How strong is this player?**
3. **What has this player achieved?**
4. **What is this player currently chasing?**
5. **What is this player's BWL legacy?**

Final positioning:

> BWL Legacy Career turns every match into progress, every achievement into history, and every player profile into a living record of status, respect, rivalry, and glory.

