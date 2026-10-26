import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const db = new PrismaClient();

const CONTROLS_SEED = [
  {
    controlRef: "INSA-AC-04",
    frameworkCode: "INSA" as const,
    category: "Access Control",
    requirementText:
      "The organization must enforce multi-factor authentication for all privileged access to critical infrastructure systems.",
    riskLevel: "CRITICAL" as const,
    mappedIsoRefs: ["ISO27001-A.9.4.2", "NIST-PR.AC-7"],
  },
  {
    controlRef: "INSA-IR-02",
    frameworkCode: "INSA" as const,
    category: "Incident Response",
    requirementText:
      "Security incidents affecting critical infrastructure must be reported to INSA within 48 hours of detection.",
    riskLevel: "CRITICAL" as const,
    mappedIsoRefs: ["ISO27001-A.16.1.2"],
  },
  {
    controlRef: "NBE-CSD-3.2",
    frameworkCode: "NBE" as const,
    category: "Data Protection",
    requirementText:
      "Financial institutions must encrypt customer data at rest and in transit using approved cryptographic standards.",
    riskLevel: "HIGH" as const,
    mappedIsoRefs: ["ISO27001-A.10.1.1"],
  },
  {
    controlRef: "NBE-CSD-5.1",
    frameworkCode: "NBE" as const,
    category: "Third-Party Risk",
    requirementText:
      "Institutions must conduct annual security assessments of critical third-party service providers.",
    riskLevel: "MEDIUM" as const,
    mappedIsoRefs: ["ISO27001-A.15.2.1"],
  },
  {
    controlRef: "INSA-LOG-07",
    frameworkCode: "INSA" as const,
    category: "Logging & Monitoring",
    requirementText:
      "Systems must retain audit logs for a minimum of 12 months and enable real-time alerting for anomalous access.",
    riskLevel: "HIGH" as const,
    mappedIsoRefs: ["ISO27001-A.12.4.1"],
  },

  // --- ISO/IEC 27001:2022 (Annex A) — independently trackable, not just a
  // cross-reference tag on other frameworks' controls. --------------------
  {
    controlRef: "ISO-A.5.1",
    frameworkCode: "ISO27001" as const,
    category: "Organizational Controls",
    requirementText: "Information security policies must be defined, approved by management, and reviewed at planned intervals.",
    riskLevel: "MEDIUM" as const,
    mappedIsoRefs: [],
  },
  {
    controlRef: "ISO-A.5.23",
    frameworkCode: "ISO27001" as const,
    category: "Organizational Controls",
    requirementText: "Security requirements for using cloud services must be established, including provider due diligence and exit terms.",
    riskLevel: "HIGH" as const,
    mappedIsoRefs: [],
  },
  {
    controlRef: "ISO-A.8.9",
    frameworkCode: "ISO27001" as const,
    category: "Technological Controls",
    requirementText: "Configuration of hardware, software, and networks must be established, documented, and monitored for unauthorized changes.",
    riskLevel: "HIGH" as const,
    mappedIsoRefs: ["INSA-LOG-07"],
  },
  {
    controlRef: "ISO-A.8.12",
    frameworkCode: "ISO27001" as const,
    category: "Technological Controls",
    requirementText: "Data leakage prevention measures must be applied to systems, networks, and devices that process sensitive information.",
    riskLevel: "HIGH" as const,
    mappedIsoRefs: ["NBE-CSD-3.2"],
  },
  {
    controlRef: "ISO-A.8.24",
    frameworkCode: "ISO27001" as const,
    category: "Technological Controls",
    requirementText: "Rules for the effective use of cryptography, including key management, must be defined and implemented.",
    riskLevel: "CRITICAL" as const,
    mappedIsoRefs: ["NBE-CSD-3.2"],
  },
  {
    controlRef: "ISO-A.6.3",
    frameworkCode: "ISO27001" as const,
    category: "People Controls",
    requirementText: "All personnel must receive appropriate information security awareness education and training, updated regularly.",
    riskLevel: "MEDIUM" as const,
    mappedIsoRefs: [],
  },
  {
    controlRef: "ISO-A.7.2",
    frameworkCode: "ISO27001" as const,
    category: "Physical Controls",
    requirementText: "Secure areas must be protected by appropriate entry controls to ensure only authorized personnel gain access.",
    riskLevel: "MEDIUM" as const,
    mappedIsoRefs: [],
  },
  {
    controlRef: "ISO-A.5.30",
    frameworkCode: "ISO27001" as const,
    category: "Organizational Controls",
    requirementText: "ICT readiness for business continuity must be planned, implemented, maintained, and tested based on availability requirements.",
    riskLevel: "HIGH" as const,
    mappedIsoRefs: [],
  },

  // --- NIST Cybersecurity Framework 2.0 — six functions: Govern, Identify,
  // Protect, Detect, Respond, Recover. -------------------------------------
  {
    controlRef: "NIST-GV.OC-01",
    frameworkCode: "NIST_CSF" as const,
    category: "Govern",
    requirementText: "The organizational mission is understood and informs cybersecurity risk management decisions.",
    riskLevel: "MEDIUM" as const,
    mappedIsoRefs: ["ISO-A.5.1"],
  },
  {
    controlRef: "NIST-ID.AM-01",
    frameworkCode: "NIST_CSF" as const,
    category: "Identify",
    requirementText: "Inventories of hardware managed by the organization must be maintained and kept current.",
    riskLevel: "MEDIUM" as const,
    mappedIsoRefs: [],
  },
  {
    controlRef: "NIST-PR.AA-05",
    frameworkCode: "NIST_CSF" as const,
    category: "Protect",
    requirementText: "Access permissions and authorizations are defined and enforced based on the principle of least privilege.",
    riskLevel: "CRITICAL" as const,
    mappedIsoRefs: ["INSA-AC-04"],
  },
  {
    controlRef: "NIST-PR.DS-01",
    frameworkCode: "NIST_CSF" as const,
    category: "Protect",
    requirementText: "The confidentiality, integrity, and availability of data-at-rest are protected.",
    riskLevel: "HIGH" as const,
    mappedIsoRefs: ["NBE-CSD-3.2", "ISO-A.8.24"],
  },
  {
    controlRef: "NIST-DE.CM-01",
    frameworkCode: "NIST_CSF" as const,
    category: "Detect",
    requirementText: "Networks and network services are monitored to find potentially adverse events.",
    riskLevel: "HIGH" as const,
    mappedIsoRefs: ["INSA-LOG-07"],
  },
  {
    controlRef: "NIST-RS.MA-01",
    frameworkCode: "NIST_CSF" as const,
    category: "Respond",
    requirementText: "The incident response plan is executed once an incident is declared, in coordination with relevant third parties.",
    riskLevel: "CRITICAL" as const,
    mappedIsoRefs: ["INSA-IR-02"],
  },
  {
    controlRef: "NIST-RC.RP-01",
    frameworkCode: "NIST_CSF" as const,
    category: "Recover",
    requirementText: "The recovery portion of the incident response plan is executed once initiated from the response process.",
    riskLevel: "HIGH" as const,
    mappedIsoRefs: ["ISO-A.5.30"],
  },

  // --- PCI DSS v4.0 — only strictly required if a tenant handles cardholder
  // data, but tracked here since several banks will. -----------------------
  {
    controlRef: "PCI-1.2",
    frameworkCode: "PCI_DSS" as const,
    category: "Network Security",
    requirementText: "Network security controls (firewalls) must be configured and maintained to restrict connections to the cardholder data environment.",
    riskLevel: "CRITICAL" as const,
    mappedIsoRefs: [],
  },
  {
    controlRef: "PCI-3.5",
    frameworkCode: "PCI_DSS" as const,
    category: "Cardholder Data Protection",
    requirementText: "Primary account numbers must be rendered unreadable anywhere they are stored, using strong cryptography.",
    riskLevel: "CRITICAL" as const,
    mappedIsoRefs: ["ISO-A.8.24"],
  },
  {
    controlRef: "PCI-6.3",
    frameworkCode: "PCI_DSS" as const,
    category: "Secure Development",
    requirementText: "Security vulnerabilities must be identified and managed, including timely installation of critical patches.",
    riskLevel: "HIGH" as const,
    mappedIsoRefs: [],
  },
  {
    controlRef: "PCI-8.3",
    frameworkCode: "PCI_DSS" as const,
    category: "Access Control",
    requirementText: "Strong authentication, including multi-factor authentication, must be implemented for all access into the cardholder data environment.",
    riskLevel: "CRITICAL" as const,
    mappedIsoRefs: ["INSA-AC-04", "NIST-PR.AA-05"],
  },
  {
    controlRef: "PCI-10.2",
    frameworkCode: "PCI_DSS" as const,
    category: "Logging & Monitoring",
    requirementText: "Audit logs must be implemented to support the detection of anomalies and suspicious activity in the cardholder data environment.",
    riskLevel: "HIGH" as const,
    mappedIsoRefs: ["INSA-LOG-07", "NIST-DE.CM-01"],
  },
  {
    controlRef: "PCI-11.4",
    frameworkCode: "PCI_DSS" as const,
    category: "Security Testing",
    requirementText: "External and internal penetration testing must be performed at least once every 12 months and after significant changes.",
    riskLevel: "HIGH" as const,
    mappedIsoRefs: [],
  },

  // --- SOC 2 (Trust Services Criteria) — a common ask from enterprise or
  // international partners doing vendor due diligence on Kelela's clients.
  {
    controlRef: "SOC2-CC6.1",
    frameworkCode: "SOC2" as const,
    category: "Logical Access",
    requirementText: "Logical access security software, infrastructure, and architectures are implemented to protect information assets from unauthorized access.",
    riskLevel: "CRITICAL" as const,
    mappedIsoRefs: ["INSA-AC-04", "NIST-PR.AA-05"],
  },
  {
    controlRef: "SOC2-CC7.2",
    frameworkCode: "SOC2" as const,
    category: "System Monitoring",
    requirementText: "The system is monitored to detect anomalies indicative of malicious acts, natural disasters, or errors affecting objectives.",
    riskLevel: "HIGH" as const,
    mappedIsoRefs: ["NIST-DE.CM-01"],
  },
  {
    controlRef: "SOC2-CC7.4",
    frameworkCode: "SOC2" as const,
    category: "Incident Response",
    requirementText: "The organization responds to identified security incidents by executing a defined incident response program.",
    riskLevel: "CRITICAL" as const,
    mappedIsoRefs: ["INSA-IR-02", "NIST-RS.MA-01"],
  },
  {
    controlRef: "SOC2-A1.2",
    frameworkCode: "SOC2" as const,
    category: "Availability",
    requirementText: "Environmental protections, backup processes, and recovery infrastructure are authorized, designed, and implemented to meet availability commitments.",
    riskLevel: "HIGH" as const,
    mappedIsoRefs: ["ISO-A.5.30"],
  },
  {
    controlRef: "SOC2-C1.1",
    frameworkCode: "SOC2" as const,
    category: "Confidentiality",
    requirementText: "Confidential information is identified and protected in accordance with the entity's confidentiality commitments.",
    riskLevel: "HIGH" as const,
    mappedIsoRefs: ["ISO-A.8.12"],
  },
];

/**
 * Seeds a compliance snapshot (control assessments, one already-compliant
 * control, and a 30-day readiness trend) for one tenant org. Called once
 * per tenant so the platform console has more than one row to manage.
 */
async function seedTenantComplianceData(
  frameworks: Record<string, string>,
  orgId: string,
  ownerId: string,
  opts: { alreadyCompliantRefs?: string[]; trendBaseline?: number } = {}
) {
  const assessmentByRef = new Map<string, string>();

  for (const c of CONTROLS_SEED) {
    const control = await db.complianceControl.upsert({
      where: { frameworkId_controlRef: { frameworkId: frameworks[c.frameworkCode], controlRef: c.controlRef } },
      update: {},
      create: {
        frameworkId: frameworks[c.frameworkCode],
        controlRef: c.controlRef,
        category: c.category,
        requirementText: c.requirementText,
        riskLevel: c.riskLevel,
        mappedIsoRefs: c.mappedIsoRefs,
      },
    });

    const assessment = await db.controlAssessment.upsert({
      where: { controlId_organizationId: { controlId: control.id, organizationId: orgId } },
      update: {},
      create: {
        controlId: control.id,
        organizationId: orgId,
        status: c.riskLevel === "CRITICAL" ? "NON_COMPLIANT" : "IN_REVIEW",
        assignedToId: ownerId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    assessmentByRef.set(c.controlRef, assessment.id);
  }

  // A brand-new org with every control red isn't representative of what a
  // demo or interview wants to show, so mark a handful of controls compliant
  // spread across different risk levels and frameworks.
  for (const ref of opts.alreadyCompliantRefs ?? []) {
    const control = await db.complianceControl.findFirst({ where: { controlRef: ref } });
    if (control) {
      await db.controlAssessment.updateMany({
        where: { controlId: control.id, organizationId: orgId },
        data: { status: "COMPLIANT" },
      });
    }
  }

  // Historical readiness snapshots so the trend chart isn't empty on first
  // load. Trends gently upward, with the usual week-to-week noise.
  const DAYS = 30;
  const baseline = opts.trendBaseline ?? 20;
  for (let i = DAYS; i >= 0; i--) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);

    const progress = (DAYS - i) / DAYS;
    const noise = Math.round(Math.sin(i * 0.7) * 4);
    const insaPct = Math.max(5, Math.min(95, Math.round(baseline + progress * 45) + noise));
    const nbePct = Math.max(5, Math.min(95, Math.round(baseline - 5 + progress * 55) + noise));
    const overallPct = Math.round((insaPct + nbePct) / 2);

    await db.readinessSnapshot.upsert({
      where: { organizationId_date: { organizationId: orgId, date } },
      update: {},
      create: { organizationId: orgId, date, insaPct, nbePct, overallPct },
    });
  }

  return assessmentByRef;
}

async function main() {
  const passwordHash = await argon2.hash("Password123!", { type: argon2.argon2id });

  // --- Kelela Solutions platform staff (not scoped to any tenant org) ----
  const superAdmin = await db.user.upsert({
    where: { email: "founder@kelelasolutions.com" },
    update: {},
    create: {
      email: "founder@kelelasolutions.com",
      passwordHash,
      fullName: "Yohannes Girma",
      role: "SUPER_ADMIN",
      organizationId: null,
      mfaEnabled: false,
    },
  });

  await db.user.upsert({
    where: { email: "ops@kelelasolutions.com" },
    update: {},
    create: {
      email: "ops@kelelasolutions.com",
      passwordHash,
      fullName: "Betelhem Alemu",
      role: "PLATFORM_ADMIN",
      organizationId: null,
      mfaEnabled: false,
    },
  });

  // --- Frameworks (shared catalog across all tenants) ---------------------
  const frameworkDefs = [
    {
      code: "INSA" as const,
      version: "1263-2021",
      name: "INSA Critical Infrastructure Cybersecurity Proclamation No. 1263/2021",
      effectiveDate: new Date("2021-04-01"),
    },
    {
      code: "NBE" as const,
      version: "2021-directive",
      name: "NBE Cybersecurity Directive",
      effectiveDate: new Date("2021-08-01"),
    },
    {
      code: "ISO27001" as const,
      version: "2022",
      name: "ISO/IEC 27001:2022 — Information Security Management",
      effectiveDate: new Date("2022-10-25"),
    },
    {
      code: "NIST_CSF" as const,
      version: "2.0",
      name: "NIST Cybersecurity Framework 2.0",
      effectiveDate: new Date("2024-02-26"),
    },
    {
      code: "PCI_DSS" as const,
      version: "4.0",
      name: "PCI Data Security Standard v4.0",
      effectiveDate: new Date("2024-03-31"),
    },
    {
      code: "SOC2" as const,
      version: "2017-TSC",
      name: "SOC 2 — Trust Services Criteria",
      effectiveDate: new Date("2017-05-01"),
    },
  ];

  const frameworks: Record<string, string> = {};
  for (const fw of frameworkDefs) {
    const created = await db.complianceFramework.upsert({
      where: { code_version: { code: fw.code, version: fw.version } },
      update: {},
      create: fw,
    });
    frameworks[fw.code] = created.id;
  }

  // --- Tenant 1: Kelela Solutions' own org (they use their own product) --
  const kelelaOrg = await db.organization.upsert({
    where: { tinNumber: "0000000000" },
    update: { name: "Kelela Solutions" },
    create: {
      name: "Kelela Solutions",
      sector: "OTHER",
      tinNumber: "0000000000",
      status: "ACTIVE",
      planTier: "Enterprise",
      primaryContactEmail: "admin@kelelasolutions.com",
    },
  });

  const kelelaAdmin = await db.user.upsert({
    where: { email: "admin@kelelasolutions.com" },
    update: {},
    create: {
      email: "admin@kelelasolutions.com",
      passwordHash,
      fullName: "Selamawit Tesfaye",
      role: "ORG_ADMIN",
      organizationId: kelelaOrg.id,
      mfaEnabled: false, // kept off for local preview; flip on to test the MFA screen
    },
  });

  const kelelaAssessments = await seedTenantComplianceData(frameworks, kelelaOrg.id, kelelaAdmin.id, {
    alreadyCompliantRefs: ["NBE-CSD-3.2", "ISO-A.5.1", "ISO-A.6.3", "NIST-ID.AM-01", "SOC2-C1.1", "PCI-6.3"],
    trendBaseline: 20,
  });

  const kelelaDetectedAt = new Date(Date.now() - 40 * 60 * 60 * 1000); // 40h ago -> 8h left on SLA
  await db.incident.create({
    data: {
      organizationId: kelelaOrg.id,
      title: "Suspicious lateral movement on core banking VLAN",
      description: "SOC detected anomalous SMB traffic between core banking segment and a compromised workstation.",
      severity: "CRITICAL",
      status: "CONTAINED",
      detectedAt: kelelaDetectedAt,
      slaDeadline: new Date(kelelaDetectedAt.getTime() + 48 * 60 * 60 * 1000),
      affectedSystems: ["Core Banking VLAN", "AD-DC-02"],
      linkedControlAssessmentId: kelelaAssessments.get("INSA-IR-02"),
    },
  });

  // --- Tenant 2: a second onboarded bank, so the platform console has
  // more than one organization to actually demonstrate managing. --------
  const abyssiniaOrg = await db.organization.upsert({
    where: { tinNumber: "0000000001" },
    update: {},
    create: {
      name: "Abyssinia Digital Bank S.C.",
      sector: "FINANCIAL",
      tinNumber: "0000000001",
      status: "TRIAL",
      planTier: "Standard",
      primaryContactEmail: "compliance@abyssiniadigital.et",
    },
  });

  const abyssiniaAdmin = await db.user.upsert({
    where: { email: "admin@abyssiniadigital.et" },
    update: {},
    create: {
      email: "admin@abyssiniadigital.et",
      passwordHash,
      fullName: "Dawit Mekonnen",
      role: "ORG_ADMIN",
      organizationId: abyssiniaOrg.id,
      mfaEnabled: false,
    },
  });

  await seedTenantComplianceData(frameworks, abyssiniaOrg.id, abyssiniaAdmin.id, {
    alreadyCompliantRefs: ["ISO-A.5.1", "NIST-ID.AM-01"],
    trendBaseline: 10, // newer tenant, lower baseline — still ramping up
  });

  console.log("Seed complete.");
  console.log("Super Admin:      founder@kelelasolutions.com / Password123!");
  console.log("Platform Admin:   ops@kelelasolutions.com / Password123!");
  console.log("Kelela org admin: admin@kelelasolutions.com / Password123!");
  console.log("Abyssinia admin:  admin@abyssiniadigital.et / Password123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => db.$disconnect());
