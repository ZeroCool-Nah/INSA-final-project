# Kelela Solutions — Cybersecurity Compliance Platform


A full-stack, multi-tenant SaaS platform that lets Ethiopian banks, telecoms, and critical infrastructure operators track and prove compliance against INSA, NBE, and four international security frameworks — built end to end (architecture, backend, frontend, auth, and security design) as an independent project, not a course exercise.

**Live in this submission:** working source code, a seeded demo database, an architecture/API spec, and a slide deck (`presentation/`) explaining the platform's purpose and design decisions for anyone evaluating it who won't read the code line by line first.

## At a glance

- **Two-layer multi-tenant architecture** — a platform console for the SaaS operator (multi-org oversight, tenant onboarding/removal) sitting above per-tenant dashboards, fully data-isolated by organization

- **Three-tier RBAC** enforced by runtime guards (not just UI conditionals) across two separate authorization scopes

- **6 independently tracked compliance frameworks**, 31 controls, cross-referenced where they overlap

- **Real security engineering**: Argon2id hashing, TOTP MFA with QR enrollment, SHA-256 evidence integrity checking, an append-only audit log, brute-force lockout, security response headers

- **Live incident SLA tracking** against INSA's 48-hour disclosure requirement, with auto-flagging of linked controls on breach

- **Server-generated PDF reporting**, in-app notifications, readiness trend charts, and a working global search

## Quick start (for evaluators)

```
pnpm install
cp .env.example .env          # set DATABASE_URL and JWT_SECRET at minimum
pnpm prisma migrate dev --name init
pnpm prisma db seed           # loads frameworks, controls, and demo accounts
pnpm dev
```

Then open `http://localhost:3000` and sign in with any seeded account (all use password `Password123!`):

| Account | Email | What you'll see |
| - | - | - |
| Super Admin | `founder@kelelasolutions.com` | Platform console — manage all tenant organizations |
| Org Admin | `admin@kelelasolutions.com` | A tenant's compliance dashboard, controls matrix, incidents |


> **Note:** Platform staff (Super Admin / Platform Admin) have mandatory MFA — logging in as `founder@kelelasolutions.com` will prompt a real TOTP QR-code enrollment (any authenticator app works: Google Authenticator, Authy, 1Password, etc.). This is intentional, not a bug — it's demonstrating that MFA enforcement is a real runtime gate, not just a UI toggle. The `admin@kelelasolutions.com` tenant account has MFA off by default for a faster first look.

Kelela Solutions is a multi-tenant compliance operations platform for Ethiopian regulated enterprises (banks, telecom, critical infrastructure) to track and prove compliance against:

- **INSA** Critical Infrastructure Cybersecurity Proclamations & Risk Assessment Frameworks (mandatory, Ethiopia)

- **NBE** (National Bank of Ethiopia) Cybersecurity Directives (mandatory, Ethiopia — financial sector)

- **ISO/IEC 27001:2022** — international information security management baseline

- **NIST Cybersecurity Framework 2.0** — Govern/Identify/Protect/Detect/Respond/Recover

- **PCI DSS v4.0** — for any tenant handling cardholder data

- **SOC 2** (Trust Services Criteria) — common requirement from enterprise/international partners

Each is a real, independently filterable and trackable control set (not just a cross-reference tag) — controls across frameworks that cover the same underlying requirement are linked via `mappedIsoRefs` so overlapping evidence doesn't have to be proven twice.

Design direction: dark-mode-first, high information density, no decorative filler — modeled on Linear / Vercel / Supabase console conventions.

## Roles

The platform has two separate scopes — **platform staff** (Kelela Solutions' own team, who operate the SaaS across every tenant) and **tenant users** (a bank or telecom's own compliance team, scoped to their one organization). A tenant user never sees another tenant's data; platform staff manage tenants but don't casually browse a tenant's compliance detail.

| Role | Scope | Console | Can do |
| - | - | - | - |
| `SUPER_ADMIN` | Platform-wide | `/platform` | Everything: onboard/suspend tenants, manage Platform Admins |
| `PLATFORM_ADMIN` | Platform-wide | `/platform` | Onboard/view tenants, **cannot** suspend a tenant or manage other staff |
| `ORG_ADMIN` | One tenant org | `/` (dashboard) | Full control within their own organization |
| `COMPLIANCE_OFFICER` / `AUDITOR` / `IT_MANAGER` | One tenant org | `/` (dashboard) | Day-to-day compliance work, scoped by role |


Enforced via three guards in `src/lib/auth.ts`: `withTenantRole` (org-scoped, runtime-rejects anyone without an `organizationId`), `withPlatformRole` (Super Admin or Platform Admin), and `withSuperAdminRole` (Super Admin only, for suspend-a-tenant / manage-staff actions).


## 1. Folder structure

```
insa-compliance-platform/
├── prisma/
│   └── schema.prisma                 # DB models (see docs/DATA_MODEL.md)
├── docs/
│   ├── API_SPEC.md                   # REST endpoint spec
│   └── DATA_MODEL.md                 # Schema rationale + ERD notes
├── presentation/
│   ├── kelela-solutions-showcase.pdf
│   └── kelela-solutions-showcase.pptx
├── public/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout, font + theme providers
│   │   ├── globals.css                # Tailwind base + design tokens
│   │   ├── (auth)/
│   │   │   └── login/page.tsx         # Login + MFA challenge screen
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx             # Sidebar + topbar shell, auth guard
│   │   │   ├── page.tsx               # Overview / compliance summary
│   │   │   ├── controls/page.tsx      # Controls mapping matrix
│   │   │   ├── incidents/page.tsx     # Incident log + SLA tracker
│   │   │   └── audit/page.tsx         # Audit readiness / report export
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts     # POST credential check → MFA step
│   │       │   └── mfa/route.ts       # POST TOTP verification → session
│   │       ├── controls/route.ts      # GET controls (filterable)
│   │       ├── assessments/[id]/route.ts  # GET/PATCH one control assessment
│   │       ├── incidents/route.ts     # GET/POST incidents
│   │       └── reports/export/route.ts    # POST → generates PDF summary
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── sidebar.tsx
│   │   │   ├── topbar.tsx
│   │   │   └── sla-countdown.tsx
│   │   ├── compliance/
│   │   │   ├── controls-table.tsx
│   │   │   ├── control-detail-drawer.tsx
│   │   │   ├── status-badge.tsx
│   │   │   ├── risk-badge.tsx
│   │   │   └── evidence-uploader.tsx
│   │   ├── incidents/
│   │   │   └── incident-row.tsx
│   │   └── ui/                        # shadcn primitives (generated, not hand-rolled)
│   ├── lib/
│   │   ├── db.ts                      # Prisma client singleton
│   │   ├── auth.ts                    # JWT/session + RBAC helpers
│   │   ├── audit-log.ts               # Immutable audit trail writer
│   │   ├── hash.ts                    # SHA-256 evidence hashing
│   │   └── utils.ts                   # cn() + formatting helpers
│   └── types/
│       └── compliance.ts              # Shared TS types/enums
├── .env.example
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## 2. Stack

- **Frontend**: Next.js 14 (App Router, TypeScript, Server Components by default), Tailwind CSS (hand-built dark-mode design system, no component library), Lucide icons, Recharts for the readiness trend/status charts.

- **Backend**: Next.js Route Handlers (co-located, avoids a second service for v1). A standalone NestJS/FastAPI service is a drop-in replacement behind the same `docs/API_SPEC.md` contract if you outgrow the monolith.

- **DB**: PostgreSQL + Prisma.

- **Auth**: JWT in `httpOnly`, `Secure`, `SameSite=strict` cookies; Argon2id password hashing; TOTP MFA (RFC 6238) with QR-code enrollment; RBAC middleware on every route handler, split across tenant and platform authorization scopes.

- **Email**: Nodemailer over SMTP, with a console-log fallback so invite/reset flows work in local dev without any mail server configured.

## 3. Documentation included in this submission

- `docs/API_SPEC.md` — every REST endpoint, request/response shape, and role requirement

- `docs/DATA_MODEL.md` — schema walkthrough and the reasoning behind key design decisions

- `presentation/kelela-solutions-showcase.pdf` (and `.pptx`) — a 12-slide deck covering the problem, architecture, security model, and roadmap, for anyone evaluating the project who wants the narrative before the code

## 4. What's implemented beyond the original spec

- **Readiness trend chart** — `ReadinessSnapshot` rows are written on every control status change (`src/lib/snapshot.ts`) and plotted as a 30-day line chart on Overview.

- **Incident ↔ Control linking** — an incident can optionally link to a control assessment (e.g. an incident-response control). If that incident breaches its 48h SLA before being reported, the linked control auto-flags `NON_COMPLIANT` (`src/lib/sla-sync.ts`), unless the control owner has turned auto-flagging off for that control.

- **In-app notifications** — a bell in the topbar surfaces SLA breaches/at-risk incidents and overdue/due-soon controls, deduplicated so the same condition doesn't spam repeat alerts (`src/lib/notifications.ts`, `src/components/dashboard/notification-bell.tsx`).

- **Real TOTP MFA enrollment** — `/settings` walks through QR-code enrollment and confirmation, not just a toggle (`src/app/api/auth/mfa/enroll/*`).

- **Audit Log viewer** — `/audit-log` renders the immutable `audit_log_entries` table with entity-type filtering.

- **Bulk control assignment** — select multiple rows in the Controls Matrix and reassign owner in one action (`/api/assessments/bulk`).

- **Local evidence storage** — evidence files land on disk under `.evidence-storage/` via `src/lib/storage.ts` so upload/download works out of the box in local dev without S3 credentials; swap that module for an S3/GCS client for production.

## 5. Security notes

- No secret, connection string, or key is hardcoded anywhere in `src/` — all read via `process.env` and validated at boot with a Zod env schema (`src/lib/env.ts`, extend as needed).

- Every evidence file upload is hashed (SHA-256) server-side before it touches storage; the hash is stored alongside the file URL in `ControlAssessment.evidenceHash` and re-verified on download.

- Every write to `ControlAssessment`, `Incident`, and evidence storage appends an `AuditLogEntry` row (append-only, no update/delete grants in DB role for that table).

- All API input is validated with Zod schemas at the route handler boundary before touching Prisma.

