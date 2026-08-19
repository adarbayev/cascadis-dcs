export type LifecyclePhase =
  | "planning"
  | "permitting"
  | "construction"
  | "commissioning"
  | "operational"
  | "expansion"
  | "decommissioning";

export type SiteArchetypeId =
  | "owned_mature"
  | "owned_expansion"
  | "owned_development"
  | "build_to_suit"
  | "colocation"
  | "partner_transition";

export type OperatingModel = SiteArchetypeId | "to_be_confirmed";

export type PartyControl =
  | "company"
  | "landlord"
  | "developer"
  | "partner"
  | "contractor"
  | "shared"
  | "tbd";

export type EemsStage =
  | "not_onboarded"
  | "gap_assessment"
  | "controls_design"
  | "implementation"
  | "operating"
  | "assurance";

export type ComplianceStatus =
  | "not_assessed"
  | "active"
  | "due_soon"
  | "expired"
  | "review_required";

export type ActionHealth = "on_track" | "overdue" | "blocked" | "verification_due";
export type RecordWorkflowStatus = "draft" | "assigned" | "in_progress" | "submitted" | "under_review" | "blocked" | "closed";
export type Severity = "low" | "medium" | "high" | "critical";
export type MetricKind = "actual" | "target" | "not_available" | "not_applicable";

export interface MetricValue {
  value: number | null;
  unit: string;
  period: string;
  kind: MetricKind;
}

export interface ResponsibilityMatrix {
  assetOwner: PartyControl;
  facilitiesOperator: PartyControl;
  itOperator: PartyControl;
  coolingOperator: PartyControl;
  utilityAccountHolder: PartyControl;
  permitHolder: PartyControl;
  dataProvider: PartyControl;
  actionApprover: PartyControl;
}

export interface CoolingAsset {
  id: string;
  name: string;
  technology: string;
  operationalStatus: "design" | "commissioning" | "active" | "transition" | "not_selected";
  controlOwner: PartyControl;
  waterMode: "water_cooled" | "hybrid" | "dry_led" | "closed_loop" | "provider_service" | "not_selected";
  notes: string;
}

export interface PermitRecord {
  id: string;
  title: string;
  category: "air" | "water" | "chemicals" | "construction" | "planning" | "waste" | "other";
  holder: PartyControl;
  status: "active" | "due_soon" | "pending" | "review_required" | "handover_due" | "closure_due" | "closed";
  ownerRole: string;
  reviewDate: string;
  dueDate?: string;
  conditions: string[];
}

export interface AspectImpactRecord {
  id: string;
  activity: string;
  aspect: string;
  impact: string;
  condition: "normal" | "abnormal" | "emergency" | "lifecycle";
  significance: Severity;
  control: string;
  residualRisk: Severity;
}

export interface ChecklistRecord {
  id: string;
  title: string;
  status: RecordWorkflowStatus;
  ownerRole: string;
  dueDate: string;
  completedItems: number;
  totalItems: number;
  completionPct: number;
}

export interface ActionRecord {
  id: string;
  title: string;
  category: "compliance" | "energy" | "water" | "cooling" | "construction" | "assurance" | "transition";
  severity: Severity;
  status: RecordWorkflowStatus;
  ownerRole: string;
  dueDate: string;
  nextStep: string;
}

export interface AuditRecord {
  id: string;
  title: string;
  type: "internal" | "supplier" | "commissioning" | "transition" | "management_review";
  status: "scheduled" | "in_progress" | "complete" | "follow_up_due";
  scheduledDate: string;
  openFindings: number;
  summary: string;
}

export interface SiteEemsProfile {
  id: string;
  assessmentId: string;
  siteId: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
    countryName: string;
  };
  archetype: SiteArchetypeId | null;
  archetypeLabel: string;
  lifecycle: {
    primaryPhase: LifecyclePhase;
    concurrentPhases: LifecyclePhase[];
    phaseGate: string;
    targetGateDate?: string;
  };
  operatingModel: {
    id: OperatingModel;
    label: string;
    summary: string;
  };
  responsibilities: ResponsibilityMatrix;
  status: {
    eemsStage: EemsStage;
    compliance: ComplianceStatus;
    actionHealth: ActionHealth;
    checklistCompletionPct: number;
    openHighPriorityActions: number;
    flags: string[];
  };
  recordReview: {
    status: "awaiting_site_owner_confirmation";
    label: "Awaiting site-owner confirmation";
    lastReviewedAt?: string;
  };
  metrics: {
    period: string;
    facilityEnergyMWh: MetricValue;
    itEnergyMWh: MetricValue;
    pue: MetricValue;
    waterConsumptionM3: MetricValue;
    wueLPerKwh: MetricValue;
    cueKgCo2ePerKwh: MetricValue;
  };
  coolingAssets: CoolingAsset[];
  permits: PermitRecord[];
  aspects: AspectImpactRecord[];
  checklists: ChecklistRecord[];
  actions: ActionRecord[];
  audits: AuditRecord[];
}
