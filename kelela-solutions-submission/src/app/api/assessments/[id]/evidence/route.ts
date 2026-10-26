import { db } from "@/lib/db";
import { withTenantRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";
import { sha256FromArrayBuffer, sha256 } from "@/lib/hash";
import { putEvidence } from "@/lib/storage";

const MAX_BYTES = 25 * 1024 * 1024; // 25MB
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export const POST = withTenantRole(
  ["ORG_ADMIN", "COMPLIANCE_OFFICER", "IT_MANAGER"],
  async (req, session, ctx: { params: { id: string } }) => {
    const assessment = await db.controlAssessment.findUnique({ where: { id: ctx.params.id } });
    if (!assessment || assessment.organizationId !== session.orgId) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Assessment not found." } }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: { code: "VALIDATION_ERROR", message: "A file is required." } }, { status: 422 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Only PDF, PNG, or JPEG evidence is accepted." } },
        { status: 422 }
      );
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: { code: "VALIDATION_ERROR", message: "File exceeds 25MB limit." } }, { status: 422 });
    }

    const bytes = await file.arrayBuffer();
    const hash = await sha256FromArrayBuffer(bytes);

    // Bytes are written to storage keyed by hash before the DB row is
    // updated, so a crash never leaves a dangling hash with no file.
    const evidenceKey = `${session.orgId}/${hash}-${file.name}`;
    await putEvidence(evidenceKey, Buffer.from(bytes));
    const evidenceFileUrl = `/api/assessments/${ctx.params.id}/evidence`;

    const updated = await db.controlAssessment.update({
      where: { id: ctx.params.id },
      data: {
        evidenceFileUrl,
        evidenceHash: hash,
        evidenceFileName: file.name,
      },
    });

    await writeAuditLog({
      organizationId: session.orgId,
      actorId: session.sub,
      action: "EVIDENCE_UPLOAD",
      entityType: "ControlAssessment",
      entityId: updated.id,
      controlAssessmentId: updated.id,
      afterState: { evidenceFileName: file.name, evidenceHash: hash },
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ data: { evidenceFileUrl, evidenceHash: hash } }, { status: 201 });
  }
);

export const GET = withTenantRole(
  ["ORG_ADMIN", "COMPLIANCE_OFFICER", "IT_MANAGER", "AUDITOR"],
  async (req, session, ctx: { params: { id: string } }) => {
    const assessment = await db.controlAssessment.findUnique({ where: { id: ctx.params.id } });
    if (!assessment || assessment.organizationId !== session.orgId) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Assessment not found." } }, { status: 404 });
    }
    if (!assessment.evidenceHash || !assessment.evidenceFileName) {
      return Response.json({ error: { code: "NOT_FOUND", message: "No evidence on file." } }, { status: 404 });
    }

    const evidenceKey = `${session.orgId}/${assessment.evidenceHash}-${assessment.evidenceFileName}`;
    let bytes: Buffer;
    try {
      const { getEvidence } = await import("@/lib/storage");
      bytes = await getEvidence(evidenceKey);
    } catch {
      return Response.json({ error: { code: "NOT_FOUND", message: "Evidence file missing from storage." } }, { status: 404 });
    }

    // Re-verify integrity on every download — a mismatch here means the
    // file on disk was tampered with or corrupted after upload.
    const currentHash = sha256(bytes);
    if (currentHash !== assessment.evidenceHash) {
      return Response.json(
        { error: { code: "CONFLICT", message: "Evidence hash mismatch — file may have been tampered with." } },
        { status: 409 }
      );
    }

    await writeAuditLog({
      organizationId: session.orgId,
      actorId: session.sub,
      action: "EVIDENCE_DOWNLOAD",
      entityType: "ControlAssessment",
      entityId: assessment.id,
      controlAssessmentId: assessment.id,
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${assessment.evidenceFileName}"`,
      },
    });
  }
);
