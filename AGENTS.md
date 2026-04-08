<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# BWL Agent Documentation

> **New here?** Start with `SKILL.md` for the complete guide to working on this project.

## Quick Navigation

| File | Purpose | Read When... |
|------|---------|--------------|
| **[SKILL.md](SKILL.md)** | Complete agent skill guide | Starting any work on the project |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | System architecture overview | Understanding how things fit together |
| **[CHEATSHEET.md](CHEATSHEET.md)** | Quick reference & code snippets | Looking for copy-paste patterns |
| `prisma/schema.prisma` | Database schema | Working with data models |
| `src/lib/utils.ts` | Utility functions | Need formatting, colors, or helpers |
| `src/lib/actions/*.ts` | Server actions | Implementing CRUD operations |

## 30-Second Project Overview

**Baloch Warriors League (BWL)** is a tournament management platform supporting:
- **Games**: Football, eFootball, PUBG, Snooker, Checkers
- **Stack**: Next.js 16 + React 19 + TypeScript + Prisma + PostgreSQL + Tailwind v4
- **Auth**: NextAuth with role-based access (SUPER_ADMIN > ADMIN > EDITOR)
- **Mobile**: Capacitor for Android app

## Critical Patterns

1. **Server Actions** for all mutations → located in `src/lib/actions/*.ts`
2. **Server Components** by default → use `"use client"` only when needed
3. **shadcn/ui** components → located in `src/components/ui/`
4. **Role checking** → use `requireRole()` from `@/lib/auth`
5. **Revalidation** → always call `revalidatePath()` after mutations
6. **Activity logging** → automatic via `logActivity()` helper

## Common Entry Points

```
New feature → Start with SKILL.md section "Common Tasks"
Database issue → Check schema.prisma first
UI component → Check src/components/ui/ for existing
Styling question → See globals.css for design tokens
Auth problem → Check src/lib/auth.ts
Form validation → See src/lib/validations/
```

## Efficiency Tips

1. **Don't read entire files** - Use search for specific functions
2. **Copy existing patterns** - Actions and components follow consistent patterns
3. **Use the cheatsheet** - CHEATSHEET.md has copy-paste snippets
4. **Check the schema** - Understand data model before writing queries
5. **Reuse utilities** - `cn()`, `gameLabel()`, `statusColor()`, etc.

## Project Structure at a Glance

```
prisma/
  schema.prisma      # Database schema - READ THIS FIRST
  
src/
  app/
    (public)/        # Public website pages
    (admin)/admin/   # Admin dashboard pages
    (auth)/          # Login page
    api/             # API routes
  components/
    ui/              # shadcn/ui components
    admin/           # Admin-specific components
    public/          # Public site components
  lib/
    actions/         # Server actions for CRUD
    validations/     # Zod schemas
    auth.ts          # Authentication config
    db.ts            # Prisma singleton
    utils.ts         # All utility functions
```

## Build Commands

```bash
npm run dev           # Dev server
npm run build         # Production build
npm run db:migrate    # Database migrations
npm run db:seed       # Seed sample data
npm run db:studio     # Prisma Studio
```

---

**Remember**: When in doubt, check `SKILL.md` first. It has everything you need to work efficiently on this project.
