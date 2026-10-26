import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import argon2 from "argon2";
import type { UserRole } from "@prisma/client";

// ---------------------------------------------------------------------
// Env — never hardcode secrets. Fail fast at boot if missing.
// ---------------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Add it to your environment before starting the app.");
}
const secretKey = new TextEncoder().encode(JWT_SECRET);

const SESSION_COOKIE = "__session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8h

export interface SessionPayload {
  sub: string; // user id
  orgId: string | null; // null for SUPER_ADMIN and PLATFORM_ADMIN (Kelela Solutions staff)
  role: UserRole;
}

// ---------------------------------------------------------------------
// Password hashing (Argon2id — winner of the Password Hashing Competition,
// resistant to GPU/ASIC cracking better than bcrypt/scrypt at equal cost).
// ---------------------------------------------------------------------
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 19456, // ~19 MB, OWASP-recommended baseline
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}

// ---------------------------------------------------------------------
// Session issuance / verification
// ---------------------------------------------------------------------
export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey);

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as SessionPayload;
  } catch {
    return null; // expired / tampered / malformed
  }
}

export function clearSession(): void {
  cookies().delete(SESSION_COOKIE);
}

// ---------------------------------------------------------------------
// For server components/pages under the tenant (dashboard) route group.
// Redirects unauthenticated users to /login, and SUPER_ADMIN users to the
// platform console (they have no org to view a tenant dashboard for).
// Returns a session with orgId narrowed to `string`.
// ---------------------------------------------------------------------
export async function requireTenantSession(): Promise<TenantSessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.orgId) redirect("/platform"); // covers SUPER_ADMIN and PLATFORM_ADMIN alike
  return session as TenantSessionPayload;
}

// ---------------------------------------------------------------------
// For server components/pages under the (platform) route group. Redirects
// anyone who isn't platform staff (SUPER_ADMIN or PLATFORM_ADMIN) back to
// their tenant dashboard.
// ---------------------------------------------------------------------
export async function requirePlatformSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "SUPER_ADMIN" && session.role !== "PLATFORM_ADMIN") redirect("/");
  return session;
}

// ---------------------------------------------------------------------
// Narrower still: for platform pages/routes reserved to the single top
// Super Admin (e.g. managing other platform staff, suspending a tenant).
// ---------------------------------------------------------------------
export async function requireSuperAdminSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "SUPER_ADMIN") redirect("/platform");
  return session;
}

// ---------------------------------------------------------------------
// Tenant-scoped variant of withRole. SUPER_ADMIN has no organizationId,
// so it's never included in `allowedRoles` here — but this also adds a
// runtime check (not just a type narrowing) in case that invariant is
// ever violated, and returns session.orgId already narrowed to `string`
// so route handlers don't need non-null assertions everywhere.
// ---------------------------------------------------------------------
export interface TenantSessionPayload extends SessionPayload {
  orgId: string;
}

export function withTenantRole<
  T extends (req: Request, session: TenantSessionPayload, ctx: any) => Promise<Response>
>(allowedRoles: Exclude<UserRole, "SUPER_ADMIN" | "PLATFORM_ADMIN">[], handler: T) {
  return async (req: Request, ctx: any): Promise<Response> => {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, { status: 401 });
    }
    if (!allowedRoles.includes(session.role as Exclude<UserRole, "SUPER_ADMIN" | "PLATFORM_ADMIN">)) {
      return Response.json({ error: { code: "FORBIDDEN", message: "Insufficient role for this action." } }, { status: 403 });
    }
    if (!session.orgId) {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "This endpoint requires a tenant-scoped account." } },
        { status: 403 }
      );
    }
    return handler(req, { ...session, orgId: session.orgId }, ctx);
  };
}

// ---------------------------------------------------------------------
// For endpoints any signed-in user should reach regardless of whether
// they're tenant-scoped or platform staff — e.g. enrolling their own MFA,
// which has nothing to do with which side of the product they're on.
// ---------------------------------------------------------------------
export function withAnySession<T extends (req: Request, session: SessionPayload, ctx: any) => Promise<Response>>(
  handler: T
) {
  return async (req: Request, ctx: any): Promise<Response> => {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, { status: 401 });
    }
    return handler(req, session, ctx);
  };
}

// ---------------------------------------------------------------------
// Platform-scoped variants of withRole, for /api/platform/* routes.
// withPlatformRole admits both SUPER_ADMIN and PLATFORM_ADMIN; use it for
// anything the "several admins" tier should be able to do day-to-day
// (viewing orgs, onboarding new tenants). withSuperAdminRole is stricter —
// reserve it for actions with real blast radius (suspending a tenant,
// managing other platform staff) that should sit with the one top admin.
// ---------------------------------------------------------------------
export function withPlatformRole<T extends (req: Request, session: SessionPayload, ctx: any) => Promise<Response>>(
  handler: T
) {
  return async (req: Request, ctx: any): Promise<Response> => {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, { status: 401 });
    }
    if (session.role !== "SUPER_ADMIN" && session.role !== "PLATFORM_ADMIN") {
      return Response.json({ error: { code: "FORBIDDEN", message: "Platform staff access required." } }, { status: 403 });
    }
    return handler(req, session, ctx);
  };
}

export function withSuperAdminRole<T extends (req: Request, session: SessionPayload, ctx: any) => Promise<Response>>(
  handler: T
) {
  return async (req: Request, ctx: any): Promise<Response> => {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, { status: 401 });
    }
    if (session.role !== "SUPER_ADMIN") {
      return Response.json({ error: { code: "FORBIDDEN", message: "Super Admin access required." } }, { status: 403 });
    }
    return handler(req, session, ctx);
  };
}

// ---------------------------------------------------------------------
// Brute-force lockout policy, referenced by /api/auth/login
// ---------------------------------------------------------------------
export const LOGIN_LOCKOUT = {
  maxAttempts: 5,
  lockoutMinutes: 15,
};
