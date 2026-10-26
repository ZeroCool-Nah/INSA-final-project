# API Specification

Base path: `/api`. All endpoints require a valid session cookie (`__session`,
httpOnly, Secure, SameSite=strict, JWT) except `POST /api/auth/login` and
`POST /api/auth/mfa`. RBAC is enforced per-route as noted.

Two scopes exist: **tenant-scoped** routes (`/api/controls`, `/api/incidents`,
etc.) require `ORG_ADMIN` / `COMPLIANCE_OFFICER` / `AUDITOR` / `IT_MANAGER`
and always run against the caller's own `organizationId`. **Platform-scoped**
routes (`/api/platform/*`) require `SUPER_ADMIN` or `PLATFORM_ADMIN` and are
not tied to any one tenant — see README.md § Roles for the full breakdown.

All request bodies are validated with Zod; violations return `422` with a
field-level error map. All responses are JSON unless noted.

---

## Auth

### `POST /api/auth/login`
Body: `{ email: string; password: string }`
- Verifies Argon2id hash. On 5 consecutive failures, locks the account for 15
  minutes (`User.lockedUntil`) and returns `429`.
- If the account belongs to a `SUSPENDED` organization, returns `403` regardless of credentials.
- On success with `mfaEnabled = true` → `200 { mfaRequired: true, challengeToken }`
- On success with `mfaEnabled = false` → sets session cookie, `200 { data: { id, email, role } }`
  — the client redirects to `/platform` for `SUPER_ADMIN`/`PLATFORM_ADMIN`, `/` otherwise.

### `POST /api/auth/mfa`
Body: `{ challengeToken: string; totpCode: string }`
- Verifies TOTP code (±1 step window). On success, sets session cookie,
  returns `200 { user }`. On failure, `401`.

### `POST /api/auth/logout`
Clears session cookie. `204`.

---

## Controls & Assessments

### `GET /api/controls`
Roles: all authenticated.
Query params: `framework=INSA|NBE|ISO27001`, `status=`, `risk=`, `q=` (search
requirement text/control ref), `page`, `pageSize`.
Returns the control catalog **joined** with the caller's org assessment
status, so the matrix table can render in one request:

```json
{
  "data": [
    {
      "id": "ctl_123",
      "controlRef": "INSA-AC-04",
      "framework": "INSA",
      "category": "Access Control",
      "requirementText": "...",
      "riskLevel": "CRITICAL",
      "assessment": {
        "id": "asmt_456",
        "status": "IN_REVIEW",
        "assignedTo": { "id": "usr_1", "fullName": "Selamawit T." },
        "dueDate": "2026-09-01T00:00:00Z",
        "evidenceFileName": null
      }
    }
  ],
  "meta": { "total": 142, "page": 1, "pageSize": 25 }
}
```

### `GET /api/controls/:id`
Full control detail including `mappedIsoRefs`, assessment history (via audit
log), and evidence metadata. Used to populate the Control Detail Drawer.

### `PATCH /api/assessments/:id`
Roles: `ORG_ADMIN`, `COMPLIANCE_OFFICER`, `IT_MANAGER` (owner org only).
Body (partial): `{ status?, assignedToId?, notes?, dueDate?, linkedAssetName? }`
- Writes an `AuditLogEntry` with `action: STATUS_CHANGE` (or `UPDATE`) capturing
  `beforeState`/`afterState` diffs.
- Returns updated assessment, `200`.

### `POST /api/assessments/:id/evidence`
Roles: `ORG_ADMIN`, `COMPLIANCE_OFFICER`, `IT_MANAGER`.
`multipart/form-data`, field `file` (PDF/image, max 25MB).
- Server computes SHA-256 over the raw bytes **before** persisting to object
  storage.
- Persists `evidenceFileUrl`, `evidenceHash`, `evidenceFileName` on the
  assessment.
- Writes `AuditLogEntry { action: EVIDENCE_UPLOAD }`.
- Returns `201 { evidenceFileUrl, evidenceHash }`.

### `GET /api/assessments/:id/evidence`
Streams the file after re-computing and verifying the SHA-256 hash against
the stored value; `409` if the hash no longer matches (tamper signal).
Writes `AuditLogEntry { action: EVIDENCE_DOWNLOAD }`.

---

## Incidents

### `GET /api/incidents`
Query: `status=`, `severity=`, `active=true` (SLA not yet reported).
Returns incidents with computed `hoursRemaining` against `slaDeadline`.

### `POST /api/incidents`
Roles: `ORG_ADMIN`, `COMPLIANCE_OFFICER`, `IT_MANAGER`.
Body: `{ title, description, severity, detectedAt, affectedSystems: string[] }`
- Server computes `slaDeadline = detectedAt + 48h` (INSA mandatory disclosure
  window) — never trust a client-supplied deadline.
- Returns `201 { incident }`.

### `PATCH /api/incidents/:id`
Body (partial): `{ status?, insaReportedAt?, description? }`.
Transitioning to `REPORTED_TO_INSA` requires `insaReportedAt` and stamps it
against `slaDeadline` to record on-time/late for audit purposes.

---

## Reports

### `POST /api/reports/export`
Roles: `ORG_ADMIN`, `AUDITOR`, `COMPLIANCE_OFFICER`.
Body: `{ framework?: FrameworkCode; view: "executive" | "auditor" }`
- `executive` view: readiness %, critical gaps, incident SLA summary.
- `auditor` view: full control-by-control status with evidence hash ledger.
- Returns `200` with `Content-Type: application/pdf` (streamed, generated
  server-side — never client-rendered — so figures can't be tampered with
  before signing).
- Writes `AuditLogEntry { action: EXPORT }`.

---

## Platform Console (Kelela Solutions staff only)

Every route below is under `/api/platform/*`, requires `SUPER_ADMIN` or
`PLATFORM_ADMIN` (marked per-route where narrower), and writes audit log
entries with `organizationId: null` (platform-level action, not tied to a tenant).

### `GET /api/platform/organizations`
Roles: `SUPER_ADMIN`, `PLATFORM_ADMIN`.
Returns every tenant org with rollup stats: `userCount`, `activeIncidentCount`,
`readinessPct`. Never returns individual control/assessment detail — platform
staff see tenant health at a glance, not a tenant's actual compliance data.

### `POST /api/platform/organizations`
Roles: `SUPER_ADMIN`, `PLATFORM_ADMIN`. Onboards a new tenant.
Body: `{ name, sector, planTier?, primaryContactEmail?, adminFullName, adminEmail, adminPassword }`
- Creates the `Organization` and its first `ORG_ADMIN` user in one transaction — an org onboarded with no one able to log in isn't useful.

### `GET /api/platform/organizations/:id`
Roles: `SUPER_ADMIN`, `PLATFORM_ADMIN`. Org detail: user list, readiness %, active incident count.

### `PATCH /api/platform/organizations/:id`
Roles: `SUPER_ADMIN` **only**. Body (partial): `{ status?: "ACTIVE"|"TRIAL"|"SUSPENDED", planTier?, name? }`
- Suspending a tenant blocks login for every user in that org (checked in `POST /api/auth/login`) without deleting any data.

### `GET /api/platform/staff`
Roles: `SUPER_ADMIN` only. Lists platform staff (`organizationId: null` users).

### `POST /api/platform/staff`
Roles: `SUPER_ADMIN` only. Adds a new `PLATFORM_ADMIN`.
Body: `{ fullName, email, password, role: "PLATFORM_ADMIN" }`
- `role` is a literal — this endpoint can never create another `SUPER_ADMIN`; that's deliberately not exposed through the API at all.

### `PATCH /api/platform/staff/:id`
Roles: `SUPER_ADMIN` only. Body: `{ disabled: boolean }`
- Locks/unlocks a Platform Admin's login (reuses the brute-force lockout field rather than a hard delete, so audit log actor references never dangle).
- Rejects targeting a `SUPER_ADMIN` account or your own account.

---

## Error shape

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": { "severity": "Required" } } }
```

Standard codes: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404),
`VALIDATION_ERROR` (422), `RATE_LIMITED` (429), `CONFLICT` (409).
