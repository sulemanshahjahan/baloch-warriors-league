# Baloch Warriors League (BWL) - Agent Skill

> **Efficiency-First Guide**: This skill helps Kimi agents work effectively on the BWL project while minimizing context usage.

## Quick Context

**BWL** is a multi-game tournament management platform for the Baloch Warriors League, supporting:
- **Games**: Football, eFootball, PUBG, Snooker, Checkers
- **Formats**: League, Knockout, Group+Knockout
- **Participant Types**: Team-based and Individual

---

## Project Structure (Memorize This)

```
prisma/
├── schema.prisma      # Single source of truth for all models
├── seed.ts            # Seeds admin, teams, players, sample tournament
└── migrations/

src/
├── app/
│   ├── (public)/      # Public-facing routes (no auth)
│   │   ├── page.tsx   # Homepage
│   │   ├── tournaments/, teams/, players/, matches/, news/
│   │   └── layout.tsx # Public layout with Navbar + Footer
│   ├── (admin)/       # Admin dashboard routes
│   │   └── admin/     # All admin pages under /admin/*
│   ├── (auth)/        # Login page
│   └── api/           # API routes (auth, matches, photos, etc.)
├── components/
│   ├── ui/            # shadcn/ui components (Button, Card, Dialog, etc.)
│   ├── admin/         # Admin-specific components
│   └── public/        # Public site components
└── lib/
    ├── actions/       # Server Actions (CRUD operations)
    ├── validations/   # Zod schemas for form validation
    ├── auth.ts        # NextAuth config + role helpers
    ├── db.ts          # Prisma singleton
    └── utils.ts       # cn(), formatters, game/status helpers
```

---

## Key Conventions

### 1. Server Actions Pattern

All data mutations use Server Actions in `src/lib/actions/*.ts`:

```typescript
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/lib/utils";

// Always check auth for admin actions
async function requireAdmin() {
  const session = await auth();
  if (!session) return null;
  const role = (session.user as { role?: string })?.role ?? "EDITOR";
  if (role === "EDITOR") return null; // or check hierarchy
  return { session };
}

export async function createX(formData: FormData): Promise<ActionResult<T>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Unauthorized" };
  
  // ... validation, creation ...
  
  revalidatePath("/admin/x");
  return { success: true, data: result };
}
```

### 2. Role Hierarchy

```typescript
// SUPER_ADMIN > ADMIN > EDITOR
const ROLE_LEVELS = { SUPER_ADMIN: 3, ADMIN: 2, EDITOR: 1 };

// Use requireRole() from auth.ts for protected actions
import { requireRole } from "@/lib/auth";
await requireRole("ADMIN"); // throws if insufficient
```

### 3. Form Validation (Zod)

```typescript
// src/lib/validations/tournament.ts
import { z } from "zod";

export const tournamentSchema = z.object({
  name: z.string().min(2),
  gameCategory: z.enum(["FOOTBALL", "EFOOTBALL", "PUBG", "SNOOKER", "CHECKERS"]),
  format: z.enum(["LEAGUE", "KNOCKOUT", "GROUP_KNOCKOUT"]),
  // ...
});

// Usage in actions:
const parsed = tournamentSchema.safeParse(Object.fromEntries(formData));
if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };
```

### 4. Database Queries

```typescript
import { prisma } from "@/lib/db";

// Always use include for relations
const tournament = await prisma.tournament.findUnique({
  where: { id },
  include: {
    teams: { include: { team: { select: { id, name, logoUrl } } } },
    matches: { orderBy: { scheduledAt: "asc" } },
    standings: { orderBy: [{ points: "desc" }, { goalDiff: "desc" }] },
  },
});
```

### 5. UI Components

Use existing shadcn/ui components from `src/components/ui/`:

| Component | Usage |
|-----------|-------|
| `Button` | All buttons - use `variant` prop |
| `Card` | Content containers |
| `Dialog` | Modals |
| `Select`, `Input`, `Textarea` | Form elements |
| `Table` | Data tables |
| `Tabs` | Tabbed interfaces |
| `Badge` | Status labels |
| `Avatar` | Profile images |

**Styling**: Use Tailwind with design tokens:
```tsx
<div className="bg-card text-card-foreground border-border">
  <span className="text-primary">Primary red</span>
  <span className="text-accent">Gold accent</span>
  <span className="text-muted-foreground">Muted text</span>
</div>
```

### 6. Utility Helpers

```typescript
import { 
  cn,                    // Merge tailwind classes
  slugify,               // Create URL slugs
  gameLabel,             // "FOOTBALL" → "Football"
  gameColor,             // "FOOTBALL" → "bg-green-500/10 text-green-500"
  statusLabel,           // "ACTIVE" → "Active"
  statusColor,           // Status badge colors
  formatDate,            // Format dates
  formatDateTime,        // Format with time
  getInitials,           // "John Doe" → "JD"
  getRoundDisplayName,   // Knockout round naming
  type ActionResult      // Action return type
} from "@/lib/utils";
```

---

## Database Models (Quick Reference)

### Core Entities

| Model | Purpose |
|-------|---------|
| `AdminUser` | Admin accounts with roles |
| `Season` | Tournament seasons |
| `Tournament` | Main tournament container |
| `TournamentGroup` | Groups for GROUP_KNOCKOUT |
| `Team` | Teams in the league |
| `Player` | Individual players |
| `TeamPlayer` | Many-to-many with roster history |
| `TournamentTeam` | Team enrollment in tournament |
| `TournamentPlayer` | Individual enrollment |
| `Match` | Individual matches |
| `MatchParticipant` | Multi-team matches (PUBG) |
| `MatchEvent` | Goals, cards, assists, etc. |
| `Standing` | League tables (recomputed) |
| `Award` | Tournament awards |
| `Venue` | Match venues |
| `NewsPost` | News articles |
| `ActivityLog` | Admin audit log |

### Key Enums

```typescript
GameCategory: FOOTBALL | EFOOTBALL | PUBG | SNOOKER | CHECKERS
TournamentFormat: LEAGUE | KNOCKOUT | GROUP_KNOCKOUT
ParticipantType: TEAM | INDIVIDUAL
TournamentStatus: DRAFT | UPCOMING | ACTIVE | COMPLETED | CANCELLED
MatchStatus: SCHEDULED | LIVE | COMPLETED | CANCELLED | POSTPONED
MatchEventType: GOAL | ASSIST | YELLOW_CARD | RED_CARD | ...
```

---

## Common Tasks

### Add a New Admin Page

1. Create file: `src/app/(admin)/admin/feature/page.tsx`
2. Add sidebar link in `src/components/admin/sidebar.tsx`
3. Create action in `src/lib/actions/feature.ts`
4. Add validation schema in `src/lib/validations/feature.ts` (if needed)

### Add a New Server Action

1. Create/edit file in `src/lib/actions/*.ts`
2. Include `"use server"`
3. Use `requireAdmin()` or `requireRole()`
4. Return `ActionResult<T>` type
5. Call `revalidatePath()` for affected routes

### Add a New UI Component

1. Check if shadcn has it: use existing in `src/components/ui/`
2. For custom components:
   - Admin: `src/components/admin/component.tsx`
   - Public: `src/components/public/component.tsx`
3. Use TypeScript interfaces, forwardRef pattern

### Database Migration

```bash
# After modifying schema.prisma:
npm run db:migrate
# Or push directly:
npm run db:push
```

### Seed Database

```bash
npm run db:seed
# Default admin: admin@bwl.com / bwl-admin-2025
```

---

## Build & Deploy

```bash
# Development
npm run dev

# Production build
npm run build

# Database commands
npm run db:generate   # Generate Prisma client
npm run db:migrate    # Run migrations
npm run db:push       # Push schema changes
npm run db:seed       # Seed database
npm run db:studio     # Open Prisma Studio
```

---

## Mobile App (Capacitor)

```bash
# Build for mobile
.\build-mobile.ps1

# Config in capacitor.config.ts
# Android project in /android
```

---

## Critical Patterns

### 1. Match Results Flow

```
Match result submitted
    ↓
MatchEvent records created (atomic stats)
    ↓
Match marked COMPLETED with scores
    ↓
Standings recomputed (triggered manually or auto)
    ↓
Activity logged
    ↓
Paths revalidated
```

### 2. Tournament Enrollment

- **Team**: Create `TournamentTeam` record
- **Individual**: Create `TournamentPlayer` record
- **Groups**: Link enrollment to `TournamentGroup`

### 3. Image Uploads

Base64 images stored directly in DB (no external storage):
```typescript
// src/lib/actions/upload.ts
export async function uploadPlayerImage(formData: FormData) {
  const file = formData.get("file") as File;
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;
  return { success: true, url: base64 };
}
```

### 4. Activity Logging

All admin actions are logged automatically:
```typescript
import { logActivity } from "./activity-log";

await logActivity({
  action: "CREATE|UPDATE|DELETE|ENROLL|...",
  entityType: "TOURNAMENT|TEAM|PLAYER|...",
  entityId: "id",
  details: { /* any JSON */ },
});
```

---

## File Reference

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | NextAuth config, `requireRole()` helper |
| `src/lib/db.ts` | Prisma singleton instance |
| `src/lib/utils.ts` | All utility functions |
| `prisma/schema.prisma` | Complete database schema |
| `src/app/globals.css` | CSS variables, theme tokens |
| `capacitor.config.ts` | Mobile app configuration |
| `next.config.ts` | Next.js config, image domains |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Unauthorized" errors | Check session, verify role hierarchy |
| Changes not reflecting | Add `revalidatePath()` to action |
| Prisma errors | Run `npm run db:generate` |
| Form validation fails | Check Zod schema matches form fields |
| Type errors on build | Check `ActionResult<T>` usage |

---

## Efficiency Tips

1. **Don't read entire files** - Use grep/search for specific functions
2. **Reuse existing patterns** - Copy from similar actions/components
3. **Check schema first** - Understand data model before writing queries
4. **Use utilities** - `cn()`, formatters, and color helpers are your friends
5. **Follow existing naming** - Actions, components, and files follow clear patterns
