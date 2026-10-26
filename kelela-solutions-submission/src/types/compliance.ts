export type FrameworkCode = "INSA" | "NBE" | "ISO27001" | "NIST_CSF" | "PCI_DSS" | "SOC2";
export type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type AssessmentStatus =
  | "NOT_STARTED"
  | "IN_REVIEW"
  | "NON_COMPLIANT"
  | "COMPLIANT"
  | "NOT_APPLICABLE";

export interface AssignedUser {
  id: string;
  fullName: string;
}

export interface LinkedIncidentSummary {
  id: string;
  title: string;
  status: string;
  severity: string;
  slaDeadline: string;
}

export interface ControlAssessmentSummary {
  id: string;
  status: AssessmentStatus;
  assignedTo: AssignedUser | null;
  dueDate: string | null;
  evidenceFileName: string | null;
  evidenceHash?: string | null;
  linkedAssetName?: string | null;
  notes?: string | null;
  slaAutoFlag?: boolean;
  linkedIncidents?: LinkedIncidentSummary[];
}

export interface ComplianceControlRow {
  id: string;
  controlRef: string;
  framework: FrameworkCode;
  category: string;
  requirementText: string;
  riskLevel: RiskLevel;
  mappedIsoRefs?: string[];
  assessment: ControlAssessmentSummary | null;
}

export interface AuditLogRow {
  id: string;
  action: string;
  actorName: string;
  createdAt: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
}
