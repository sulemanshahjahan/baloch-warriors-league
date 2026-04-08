# BWL Development Cheatsheet

## Quick Commands

```bash
# Development
npm run dev              # Start dev server on :3000
npm run build            # Production build

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations (dev)
npm run db:push          # Push schema (prototype)
npm run db:seed          # Seed with sample data
npm run db:studio        # Open Prisma Studio

# Mobile
.\build-mobile.ps1       # Build Android app
```

---

## Common Imports

```typescript
// Database
import { prisma } from "@/lib/db";

// Auth
import { auth, requireRole } from "@/lib/auth";

// Utils
import { 
  cn, slugify, formatDate, formatDateTime,
  gameLabel, gameColor, statusLabel, statusColor,
  getInitials, getRoundDisplayName,
  type ActionResult 
} from "@/lib/utils";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectItem } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Actions
import { createTournament, updateTournament } from "@/lib/actions/tournament";
import { createMatch, updateMatchResult } from "@/lib/actions/match";
import { createTeam } from "@/lib/actions/team";
import { createPlayer } from "@/lib/actions/player";
```

---

## Quick Patterns

### Create Server Action

```typescript
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/lib/utils";
import { logActivity } from "./activity-log";

async function requireAdmin() {
  const session = await auth();
  if (!session) return null;
  return { session };
}

export async function myAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Unauthorized" };
  
  try {
    const result = await prisma.entity.create({
      data: { ... }
    });
    
    await logActivity({
      action: "CREATE",
      entityType: "ENTITY",
      entityId: result.id,
    });
    
    revalidatePath("/admin/entities");
    return { success: true, data: { id: result.id } };
  } catch (e) {
    return { success: false, error: "Failed to create" };
  }
}
```

### Create Form Component

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { myAction } from "@/lib/actions/my-feature";

export function MyForm() {
  const [error, setError] = useState<string | null>(null);
  
  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await myAction(formData);
    if (!result.success) {
      setError(result.error);
    } else {
      // Success - redirect or reset
    }
  }
  
  return (
    <form action={handleSubmit}>
      <Input name="name" required />
      {error && <p className="text-destructive">{error}</p>}
      <Button type="submit">Save</Button>
    </form>
  );
}
```

### Create Page (Server Component)

```tsx
// Public page with ISR
export const revalidate = 120;

import { prisma } from "@/lib/db";

async function getData() {
  return prisma.entity.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export default async function Page() {
  const data = await getData();
  return <MyComponent data={data} />;
}
```

### Create Admin Page

```tsx
// src/app/(admin)/admin/feature/page.tsx
export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/header";

export default async function AdminFeaturePage() {
  await requireRole("EDITOR"); // or "ADMIN", "SUPER_ADMIN"
  
  return (
    <div className="flex flex-col flex-1">
      <AdminHeader title="Feature" description="Manage feature" />
      <main className="flex-1 p-6">
        {/* Content */}
      </main>
    </div>
  );
}
```

---

## Database Snippets

### Common Queries

```typescript
// Tournament with all relations
const tournament = await prisma.tournament.findUnique({
  where: { slug },
  include: {
    teams: { include: { team: true } },
    players: { include: { player: true } },
    matches: { 
      orderBy: [{ roundNumber: "desc" }, { matchNumber: "asc" }],
      include: { homeTeam: true, awayTeam: true }
    },
    standings: { 
      orderBy: [{ points: "desc" }, { goalDiff: "desc" }],
      include: { team: true }
    },
    groups: {
      include: {
        teams: { include: { team: true } },
        players: { include: { player: true } },
      },
    },
  },
});

// Player stats aggregation
const stats = await prisma.matchEvent.groupBy({
  by: ["type"],
  where: { playerId, type: { in: ["GOAL", "ASSIST", "YELLOW_CARD"] } },
  _count: { _all: true },
});

// Recent matches
const matches = await prisma.match.findMany({
  where: { status: "COMPLETED" },
  orderBy: { completedAt: "desc" },
  take: 10,
  include: {
    tournament: true,
    homeTeam: true,
    awayTeam: true,
  },
});

// Count with filters
const count = await prisma.tournament.count({
  where: { status: "ACTIVE", gameCategory: "FOOTBALL" },
});

// Transaction (multiple ops)
const [updated1, updated2] = await prisma.$transaction([
  prisma.match.update({ where: { id: id1 }, data: { ... } }),
  prisma.match.update({ where: { id: id2 }, data: { ... } }),
]);
```

### Common Mutations

```typescript
// Create with relations
const tournament = await prisma.tournament.create({
  data: {
    name: "League 2025",
    slug: "league-2025",
    gameCategory: "FOOTBALL",
    format: "LEAGUE",
    season: { connect: { id: seasonId } },
  },
});

// Update
await prisma.tournament.update({
  where: { id },
  data: { status: "ACTIVE", startDate: new Date() },
});

// Upsert (create or update)
await prisma.standing.upsert({
  where: { id: standingId },
  update: { played: { increment: 1 }, points: { increment: 3 } },
  create: { tournamentId, teamId, played: 1, won: 1, points: 3 },
});

// Delete with cascade
await prisma.tournament.delete({ where: { id } });
// Related matches, standings, awards auto-deleted via onDelete: Cascade

// Many-to-many create
await prisma.tournamentTeam.create({
  data: { tournamentId, teamId },
});
```

---

## Styling Reference

### Design Tokens

```css
/* Colors */
bg-background        /* #09090b - Main background */
bg-card              /* #111116 - Card surfaces */
bg-popover           /* #18181b - Popovers/dropdowns */
bg-primary           /* #dc2626 - BWL Crimson */
bg-secondary         /* #27272a - Secondary gray */
bg-muted             /* #1c1c1f - Muted surfaces */
bg-accent            /* #f59e0b - Gold/Amber */
bg-destructive       /* #ef4444 - Red for errors */
text-foreground      /* #fafafa - Primary text */
text-muted-foreground /* #a1a1aa - Secondary text */
border-border        /* #27272a - Borders */

/* Border radius */
rounded-sm           /* calc(var(--radius) - 2px) */
rounded-md           /* var(--radius) = 0.5rem */
rounded-lg           /* calc(var(--radius) + 2px) */
rounded-xl           /* calc(var(--radius) + 4px) */
```

### Common Tailwind Patterns

```tsx
// Card with hover
<Card className="hover:border-border/80 transition-all hover:-translate-y-0.5">

// Flex center
<div className="flex items-center justify-center">

// Text truncation
<p className="truncate">

// Line clamp
<p className="line-clamp-2">

// Glass effect
<div className="glass-card">

// Gradient text
<span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">

// Status badges
<span className={`text-xs px-2 py-0.5 rounded-full font-medium ${gameColor(game)}`}>
<span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(status)}`}>
```

---

## Match Events Reference

```typescript
MatchEventType:
// Football & eFootball
GOAL, ASSIST, YELLOW_CARD, RED_CARD, OWN_GOAL, 
PENALTY_GOAL, PENALTY_MISS, CLEAN_SHEET, MOTM

// PUBG
KILL

// Snooker / Checkers / Generic
FRAME_WIN, MVP, CUSTOM
```

---

## Tournament Formats

| Format | Description |
|--------|-------------|
| `LEAGUE` | Round-robin, everyone plays everyone |
| `KNOCKOUT` | Single elimination bracket |
| `GROUP_KNOCKOUT` | Group stage → Knockout stage |

---

## Game Categories

| Category | Type | Notes |
|----------|------|-------|
| `FOOTBALL` | Team | 11-a-side football |
| `EFOOTBALL` | Team/Individual | Video game football |
| `PUBG` | Team/Individual | Battle royale |
| `SNOOKER` | Individual | Frame-based |
| `CHECKERS` | Individual | Board game |

---

## File Locations Quick Reference

| What | Where |
|------|-------|
| Add admin page | `src/app/(admin)/admin/feature/page.tsx` |
| Add public page | `src/app/(public)/feature/page.tsx` |
| Add API route | `src/app/api/feature/route.ts` |
| Add server action | `src/lib/actions/feature.ts` |
| Add validation | `src/lib/validations/feature.ts` |
| Add admin component | `src/components/admin/component.tsx` |
| Add public component | `src/components/public/component.tsx` |
| Add UI component | `src/components/ui/component.tsx` |
| Update sidebar | `src/components/admin/sidebar.tsx` |
| Update schema | `prisma/schema.prisma` |
| Update styles | `src/app/globals.css` |

---

## Debugging Tips

```typescript
// Log Prisma queries
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Check auth session
const session = await auth();
console.log("Session:", JSON.stringify(session, null, 2));

// FormData inspection
console.log("Form entries:", Array.from(formData.entries()));

// Action result logging
const result = await myAction(formData);
console.log("Action result:", result);
```
