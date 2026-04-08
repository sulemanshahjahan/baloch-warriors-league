# BWL Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js 16 (App Router)              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  (public)   │  │   (admin)   │  │       (api)         │ │
│  │             │  │  Dashboard  │  │  Auth, Matches,     │ │
│  │  Homepage   │  │  Management │  │  Photos, Standings  │ │
│  │  Listings   │  │  CRUD Ops   │  │                     │ │
│  │  Detail     │  │  Real-time  │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    Server Actions (lib/actions)             │
├─────────────────────────────────────────────────────────────┤
│                      Prisma ORM                             │
├─────────────────────────────────────────────────────────────┤
│              PostgreSQL (via Supabase/Vercel)               │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              ┌──────────┐        ┌──────────┐
              │ Capacitor │        │   Web    │
              │ (Android) │        │ (Vercel) │
              └──────────┘        └──────────┘
```

---

## Route Groups

### (public) - Marketing & Public Views

**Layout**: `src/app/(public)/layout.tsx`
- Navbar with navigation
- Footer
- No authentication required

**Routes**:
| Route | Purpose | Data Source |
|-------|---------|-------------|
| `/` | Homepage with stats, featured tournaments | `prisma.tournament.findMany()` |
| `/tournaments` | Tournament listings | Server Component |
| `/tournaments/[slug]` | Tournament detail | `getTournamentById()` |
| `/tournaments/[slug]/stats` | Tournament statistics | `getTournamentStats()` |
| `/teams` | Team directory | `prisma.team.findMany()` |
| `/teams/[slug]` | Team profile | `getTeamById()` |
| `/players` | Player directory | `prisma.player.findMany()` |
| `/players/[slug]` | Player profile | `getPlayerById()` |
| `/matches` | Match listings | `prisma.match.findMany()` |
| `/matches/[id]` | Match detail | `getMatchById()` |
| `/news` | News listings | `prisma.newsPost.findMany()` |
| `/news/[slug]` | Article detail | `prisma.newsPost.findUnique()` |

### (admin) - Management Dashboard

**Layout**: `src/app/(admin)/admin/layout.tsx`
- Sidebar navigation
- Requires authentication (redirects to `/login`)
- Uses `SessionProvider` for client components

**Routes**:
| Route | Purpose | Access |
|-------|---------|--------|
| `/admin` | Dashboard with stats | EDITOR+ |
| `/admin/tournaments` | Tournament management | EDITOR+ |
| `/admin/tournaments/[id]` | Tournament detail with enrollments | EDITOR+ |
| `/admin/teams` | Team CRUD | EDITOR+ |
| `/admin/players` | Player CRUD | EDITOR+ |
| `/admin/matches` | Match management | EDITOR+ |
| `/admin/matches/[id]` | Match events, results | EDITOR+ |
| `/admin/seasons` | Season management | ADMIN+ |
| `/admin/venues` | Venue management | ADMIN+ |
| `/admin/awards` | Award management | ADMIN+ |
| `/admin/news` | News article management | EDITOR+ |
| `/admin/users` | Admin user management | SUPER_ADMIN |
| `/admin/activity` | Audit log | SUPER_ADMIN |
| `/admin/standings` | Standings management | EDITOR+ |

### (auth) - Authentication

| Route | Purpose |
|-------|---------|
| `/login` | Credentials sign-in |

---

## Data Flow Patterns

### 1. Server Component Pattern (Public Pages)

```tsx
// src/app/(public)/tournaments/page.tsx
export const revalidate = 120; // ISR cache

async function getTournaments() {
  return prisma.tournament.findMany({
    where: { status: { in: ["ACTIVE", "UPCOMING"] } },
    orderBy: { startDate: "asc" },
  });
}

export default async function TournamentsPage() {
  const tournaments = await getTournaments();
  return <TournamentList tournaments={tournaments} />;
}
```

### 2. Server Action Pattern (Admin)

```tsx
// Component calls action → Action mutates → Revalidation
"use client";
import { createTournament } from "@/lib/actions/tournament";

export function TournamentForm() {
  async function onSubmit(formData: FormData) {
    const result = await createTournament(formData);
    if (result.success) {
      // Redirect or show success
    } else {
      // Show error
    }
  }
  return <form action={onSubmit}>...</form>;
}
```

### 3. Activity Logging Pattern

All mutations automatically log to `ActivityLog`:

```typescript
// In every action:
await logActivity({
  action: "CREATE",
  entityType: "TOURNAMENT",
  entityId: tournament.id,
  details: { name, gameCategory },
});
```

---

## Database Design

### Entity Relationships

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   Season    │────▶│   Tournament    │◀────│ Tournament  │
└─────────────┘     │  - gameCategory │     │   Group     │
                    │  - format       │     └─────────────┘
                    │  - status       │
                    └─────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
    ┌──────────┐     ┌──────────┐     ┌──────────┐
    │   Match  │     │Standing  │     │  Award   │
    │ - status │     │ - points │     │ - type   │
    │ - scores │     │ - played │     └──────────┘
    └──────────┘     └──────────┘
          │
          ▼
    ┌──────────┐
    │MatchEvent│◀── Source of truth for all stats
    │ - type   │     (goals, cards, assists, etc.)
    │ - value  │
    └──────────┘
```

### Multi-Game Support

The schema supports 5 games through flexible fields:

| Game | Participant Type | Key Fields |
|------|-----------------|------------|
| Football | TEAM | homeScore, awayScore, goalsFor, goalsAgainst |
| eFootball | TEAM or INDIVIDUAL | Same as Football |
| PUBG | TEAM or INDIVIDUAL | MatchParticipant (multi), totalScore |
| Snooker | INDIVIDUAL | MatchEvent (FRAME_WIN), totalScore |
| Checkers | INDIVIDUAL | Similar to Snooker |

---

## Authentication & Authorization

### NextAuth Configuration

```typescript
// src/lib/auth.ts
{
  providers: [Credentials({ ... })],
  callbacks: {
    jwt: ({ token, user }) => { token.role = user.role; return token; },
    session: ({ session, token }) => { session.user.role = token.role; return session; },
  },
  session: { strategy: "jwt" },
}
```

### Role-based Access

```typescript
// Hierarchy: SUPER_ADMIN (3) > ADMIN (2) > EDITOR (1)

// Option 1: In component/layout
const session = await auth();
if (!session) redirect("/login");

// Option 2: In server action
await requireRole("ADMIN"); // Throws if insufficient

// Option 3: Check specific action
if (role === "EDITOR") return { success: false, error: "Admin required" };
```

---

## State Management

### Server State
- **Prisma**: Database queries in Server Components
- **Server Actions**: Mutations with automatic revalidation

### Client State
- **react-hook-form**: Form state management
- **Zod**: Runtime validation
- **useState**: Local UI state only

### No Global State Library
- No Redux, Zustand, or Jotai
- Server Components for data fetching
- URL params for filter state

---

## Caching Strategy

| Strategy | Usage |
|----------|-------|
| `revalidate = 120` | Public pages (homepage, listings) |
| `dynamic = "force-dynamic"` | Admin dashboard (real-time stats) |
| `revalidatePath()` | After mutations in Server Actions |
| ISR | Public tournament/team pages |

---

## Component Architecture

### UI Components (shadcn/ui)

Located in `src/components/ui/`:

```
button.tsx    - All buttons (variants: default, destructive, outline, ghost, link)
card.tsx      - Content containers
dialog.tsx    - Modals
select.tsx    - Dropdowns
input.tsx     - Text inputs
textarea.tsx  - Multi-line text
table.tsx     - Data tables
tabs.tsx      - Tab navigation
badge.tsx     - Status labels
avatar.tsx    - Profile images
checkbox.tsx  - Checkboxes
separator.tsx - Visual dividers
skeleton.tsx  - Loading states
```

### Admin Components

```
sidebar.tsx       - Navigation sidebar
header.tsx        - Page headers
pagination.tsx    - List pagination
team-form.tsx     - Team creation/editing
player-form.tsx   - Player creation/editing
tournament-form.tsx - Tournament creation
```

### Public Components

```
navbar.tsx        - Top navigation
footer.tsx        - Site footer
smart-avatar.tsx  - Auto-loads player/team images
download-app-button.tsx - App store badges
```

---

## Build Output

### Web (`next build`)
```
.next/
├── server/         # Server-side code
├── static/         # Static assets
└── ...
```

### Mobile (`build-mobile.ps1`)
```
out/                # Static export
├── index.html
├── _next/
└── ...
    ↓
android/            # Capacitor Android project
└── app/src/main/assets/public/
```

---

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."      # For migrations

# Auth
AUTH_SECRET="..."                  # NextAuth secret
NEXTAUTH_URL="http://localhost:3000"

# App
NEXT_PUBLIC_APP_URL="..."
NEXT_PUBLIC_APP_NAME="Baloch Warriors League"
```

---

## Performance Optimizations

1. **Database**: Prisma singleton with global caching for Vercel Fluid Compute
2. **Images**: Next.js Image component with AVIF/WebP formats
3. **CSS**: Tailwind v4 with CSS variables for theming
4. **JS**: Server Components by default, Client Components only when needed
5. **Fonts**: System font stack (no external font loads)
