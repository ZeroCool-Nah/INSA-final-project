import { z } from "zod";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "@/lib/db";
import { withTenantRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";

const exportSchema = z.object({
  framework: z.enum(["INSA", "NBE", "ISO27001", "NIST_CSF", "PCI_DSS", "SOC2"]).optional(),
  view: z.enum(["executive", "auditor"]),
});

export const POST = withTenantRole(["ORG_ADMIN", "AUDITOR", "COMPLIANCE_OFFICER"], async (req, session) => {
  const body = await req.json().catch(() => null);
  const parsed = exportSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid payload.", fields: parsed.error.flatten().fieldErrors } },
      { status: 422 }
    );
  }

  const org = await db.organization.findUniqueOrThrow({ where: { id: session.orgId } });

  const assessments = await db.controlAssessment.findMany({
    where: {
      organizationId: session.orgId,
      ...(parsed.data.framework ? { control: { framework: { code: parsed.data.framework } } } : {}),
    },
    include: { control: { include: { framework: true } }, assignedTo: true },
    orderBy: [{ control: { riskLevel: "asc" } }, { control: { controlRef: "asc" } }],
  });

  const total = assessments.length;
  const compliant = assessments.filter((a) => a.status === "COMPLIANT").length;
  const readinessPct = total ? Math.round((compliant / total) * 100) : 0;
  const criticalGaps = assessments.filter(
    (a) => a.control.riskLevel === "CRITICAL" && a.status !== "COMPLIANT"
  );

  const activeIncidents = await db.incident.findMany({
    where: { organizationId: session.orgId, status: { notIn: ["REPORTED_TO_INSA", "CLOSED"] } },
  });

  // --- Build the PDF server-side so figures can't be altered before signing ---
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]); // A4
  let y = 800;

  const drawText = (text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number } = {}) => {
    if (y < 60) {
      page = pdf.addPage([595, 842]);
      y = 800;
    }
    page.drawText(text, {
      x: 50,
      y,
      size: opts.size ?? 10,
      font: opts.bold ? bold : font,
      color: opts.color ? rgb(...opts.color) : rgb(0.1, 0.1, 0.1),
    });
    y -= opts.gap ?? (opts.size ?? 10) + 6;
  };

  drawText(`${org.name} — Cybersecurity Compliance Summary`, { size: 16, bold: true, gap: 18 });
  drawText("Generated via Kelela Solutions Compliance Platform", { size: 8.5, color: [0.5, 0.5, 0.5], gap: 14 });
  drawText(
    `${parsed.data.view === "executive" ? "Executive summary" : "Auditor detail"} · Generated ${new Date().toISOString()}`,
    { size: 9, color: [0.4, 0.4, 0.4], gap: 20 }
  );

  drawText(`Overall readiness: ${readinessPct}% (${compliant}/${total} controls compliant)`, { size: 12, bold: true, gap: 20 });

  if (activeIncidents.length > 0) {
    drawText(`Active incidents pending INSA disclosure: ${activeIncidents.length}`, { size: 11, bold: true, color: [0.7, 0.1, 0.1], gap: 16 });
  }

  drawText(`Critical-risk gaps requiring immediate action: ${criticalGaps.length}`, { size: 11, gap: 20 });

  if (parsed.data.view === "executive") {
    drawText("Top open critical gaps", { size: 12, bold: true, gap: 16 });
    for (const gap of criticalGaps.slice(0, 10)) {
      drawText(`• ${gap.control.controlRef} — ${gap.control.category} (${gap.status})`, { size: 10, gap: 14 });
    }
  } else {
    drawText("Full control-by-control ledger", { size: 12, bold: true, gap: 16 });
    for (const a of assessments) {
      drawText(
        `${a.control.controlRef}  |  ${a.control.framework.code}  |  ${a.status}  |  owner: ${a.assignedTo?.fullName ?? "unassigned"}  |  evidence hash: ${a.evidenceHash ?? "none"}`,
        { size: 8.5, gap: 12 }
      );
    }
  }

  const pdfBytes = await pdf.save();

  await writeAuditLog({
    organizationId: session.orgId,
    actorId: session.sub,
    action: "EXPORT",
    entityType: "Report",
    entityId: `${parsed.data.view}-${parsed.data.framework ?? "all"}-${Date.now()}`,
    afterState: { view: parsed.data.view, framework: parsed.data.framework, readinessPct },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="compliance-summary-${parsed.data.view}.pdf"`,
    },
  });
});
