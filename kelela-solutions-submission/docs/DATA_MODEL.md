# Data Model

This document walks through `prisma/schema.prisma` at the level of "why is
it shaped this way," not just a field listing — useful for anyone reviewing
the design rather than reading migrations line by line.

## Two authorization scopes, one `User` table

Rather than a separate table for platform staff vs. tenant users, `User` has
a nullable `organizationId`:

- **Tenant users** (`ORG_ADMIN`, `COMPLIANCE_OFFICER`, `AUDITOR`, `IT_MANAGER`) always have an `organizationId` — every query touching their data is scoped by it.
- **Platform staff** (`SUPER_ADMIN`, `PLATFORM_ADMIN`) have `organizationId = null` — they aren't "in" any tenant.

This keeps auth, password hashing, and MFA enrollment as one code path for
everyone, while `src/lib/auth.ts` enforces the scope boundary at the guard
level (`withTenantRole` runtime-rejects anyone without an org; `withPlatformRole`
and `withSuperAdminRole` gate the platform console). The alternative —
two separate user tables — would have meant duplicating auth logic for no
real benefit, since the two scopes never need to log in with different
mechanisms.

## Framework catalog is shared; assessments are per-tenant

`ComplianceFramework` → `ComplianceControl` is a **shared, global catalog** —
every tenant sees the same INSA/NBE/ISO/NIST/PCI/SOC2 control definitions.
`ControlAssessment` is the per-tenant join: one row per `(control, organization)`
pair, holding that specific tenant's status, owner, evidence, and due date.

This means onboarding a new tenant requires provisioning a `ControlAssessment`
row for every existing control (`skipDuplicates: true` upserts, done both at
org-creation time and as a self-healing backfill on the Controls page, in
case a tenant existed before a new control was added to the catalog).

## Why incidents can link to a control assessment

`Incident.linkedControlAssessmentId` is optional. When set, an incident that
breaches its 48-hour INSA disclosure SLA can automatically flag that specific
control `NON_COMPLIANT` (see `src/lib/sla-sync.ts`) — because a missed
incident-response SLA *is* evidence that the incident-response control isn't
actually working, not a separate fact. `ControlAssessment.slaAutoFlag` is a
per-assessment escape hatch: a human overriding the status by hand
automatically turns auto-flagging off for that control, so automation never
silently fights a deliberate manual decision.

## The audit log is intentionally append-only

`AuditLogEntry` has no update/delete path anywhere in the application code —
`src/lib/audit-log.ts` only ever calls `.create()`. In a real deployment, the
database role the app connects as should also have no `UPDATE`/`DELETE`
grant on that table at the Postgres level, so even a compromised application
process couldn't rewrite history. Every mutating action in the app —
status changes, evidence uploads, incident updates, org suspension, staff
changes — writes one of these.

`organizationId` is nullable here too, for the same reason as `User`:
platform-level actions (e.g. a Super Admin onboarding a tenant) aren't
scoped to any one org.

## Notifications: broadcast vs. targeted

`Notification.userId` is nullable:

- **`null`** — an org-wide condition everyone should see (an SLA breach, an overdue control). Deduplicated via a `dedupeKey` unique per org, so re-scanning the same condition doesn't spam repeat alerts.
- **Set to a specific user** — a targeted event, like "this control was just assigned to you." The notifications API filters to `userId IS NULL OR userId = <current user>` so a targeted notification never leaks to the rest of the org.

## Soft-delete for tenant organizations

`Organization.status` includes `DELETED` alongside `ACTIVE`/`TRIAL`/`SUSPENDED`.
Removing a tenant is deliberately **not** a SQL `DELETE` — it locks out every
user in that org and hides it from the default organization list, but every
assessment, incident, evidence file, and audit log entry stays intact and
restorable. A compliance platform destroying a client's own compliance
records the moment they stop paying would be a liability in itself, both for
Kelela and potentially for the client's own regulatory retention obligations.

## Evidence integrity

`ControlAssessment.evidenceHash` stores a SHA-256 computed server-side
**before** the file is written to storage (`src/lib/hash.ts`). On every
download, the file is re-hashed and compared against the stored value before
being served — a mismatch means the file was altered after upload, and the
download is refused rather than silently serving tampered evidence.
