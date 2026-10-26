import { requireSuperAdminSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { StaffClient } from "@/components/platform/staff-client";

export default async function StaffPage() {
  const session = await requireSuperAdminSession();

  const staff = await db.user.findMany({
    where: { organizationId: null },
    select: { id: true, fullName: true, email: true, role: true, lastLoginAt: true, mfaEnabled: true, lockedUntil: true },
    orderBy: { createdAt: "asc" },
  });

  const rows = staff.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    email: s.email,
    role: s.role as "SUPER_ADMIN" | "PLATFORM_ADMIN",
    lastLoginAt: s.lastLoginAt?.toISOString() ?? null,
    mfaEnabled: s.mfaEnabled,
    disabled: !!(s.lockedUntil && s.lockedUntil > new Date()),
  }));

  return <StaffClient initialStaff={rows} currentUserId={session.sub} />;
}
