import type { AssessmentResult } from "../types";
import type {
  MetricKind,
  MetricValue,
  PartyControl,
  ResponsibilityMatrix,
  SiteEemsProfile,
} from "./types";

export const RECORD_REVIEW_LABEL = "Awaiting site-owner confirmation" as const;

const ACTUAL_PERIOD = "2026-07";
const DESIGN_PERIOD = "Design target";

function metric(value: number | null, unit: string, period = ACTUAL_PERIOD, kind: MetricKind = "actual"): MetricValue {
  return { value, unit, period, kind };
}

function pendingMetric(unit: string, period = ACTUAL_PERIOD): MetricValue {
  return metric(null, unit, period, "not_available");
}

function controls(overrides: Partial<ResponsibilityMatrix> = {}): ResponsibilityMatrix {
  return {
    assetOwner: "company",
    facilitiesOperator: "company",
    itOperator: "company",
    coolingOperator: "company",
    utilityAccountHolder: "company",
    permitHolder: "company",
    dataProvider: "company",
    actionApprover: "company",
    ...overrides,
  };
}

function genericConditions(...conditions: string[]): string[] {
  return conditions;
}

export const EEMS_ARCHETYPE_PROFILES: SiteEemsProfile[] = [
  {
    id: "eems-google-dc-irl-dublin-ireland",
    assessmentId: "5d18d0d0-1023-4c89-8f84-faa86a885f6d",
    siteId: "google-dc-irl-dublin-ireland",
    name: "Dublin, Ireland",
    location: { latitude: 53.3493795, longitude: -6.2605593, countryName: "Ireland" },
    archetype: "owned_mature",
    archetypeLabel: "Owned and operator-controlled campus",
    lifecycle: {
      primaryPhase: "operational",
      concurrentPhases: [],
      phaseGate: "Annual management review",
      targetGateDate: "2026-10-15",
    },
    operatingModel: {
      id: "owned_mature",
      label: "Direct operational control",
      summary: "Facilities, IT, cooling, utility records and operating controls are managed within one site system.",
    },
    responsibilities: controls(),
    status: {
      eemsStage: "operating",
      compliance: "due_soon",
      actionHealth: "verification_due",
      checklistCompletionPct: 92,
      openHighPriorityActions: 1,
      flags: ["Permit renewal due", "Energy baseline review due"],
    },
    recordReview: {
      status: "awaiting_site_owner_confirmation",
      label: RECORD_REVIEW_LABEL,
      lastReviewedAt: "2026-08-18",
    },
    metrics: {
      period: ACTUAL_PERIOD,
      facilityEnergyMWh: metric(30_000, "MWh"),
      itEnergyMWh: metric(24_000, "MWh"),
      pue: metric(1.25, "ratio"),
      waterConsumptionM3: metric(16_800, "m³"),
      wueLPerKwh: metric(0.7, "L/kWh"),
      cueKgCo2ePerKwh: metric(0.35, "kgCO₂e/kWh IT"),
    },
    coolingAssets: [
      {
        id: "dublin-primary-cooling",
        name: "Primary cooling plant",
        technology: "Chilled-water plant with evaporative heat rejection and economiser mode",
        operationalStatus: "active",
        controlOwner: "company",
        waterMode: "water_cooled",
        notes: "Seasonal control sequence and water balance are reviewed through the site energy programme.",
      },
    ],
    permits: [
      {
        id: "dublin-air-emissions",
        title: "Backup generation air emissions authorisation",
        category: "air",
        holder: "company",
        status: "due_soon",
        ownerRole: "Site environmental lead",
        reviewDate: "2026-07-22",
        dueDate: "2026-11-30",
        conditions: genericConditions("Operating-hour review", "Maintenance record check"),
      },
      {
        id: "dublin-water-discharge",
        title: "Water discharge conditions",
        category: "water",
        holder: "company",
        status: "active",
        ownerRole: "Facilities compliance manager",
        reviewDate: "2026-08-04",
        dueDate: "2027-08-04",
        conditions: genericConditions("Monthly water balance", "Abnormal discharge escalation"),
      },
    ],
    aspects: [
      {
        id: "dublin-electricity",
        activity: "Data-centre operation",
        aspect: "Facility and IT electricity consumption",
        impact: "Operational greenhouse-gas emissions and grid demand",
        condition: "normal",
        significance: "high",
        control: "Monthly energy review, EnPI monitoring and cooling optimisation",
        residualRisk: "medium",
      },
      {
        id: "dublin-water",
        activity: "Heat rejection",
        aspect: "Cooling-water consumption",
        impact: "Pressure on local water availability",
        condition: "normal",
        significance: "high",
        control: "Metered water balance and seasonal economiser control",
        residualRisk: "medium",
      },
      {
        id: "dublin-refrigerant",
        activity: "Cooling maintenance",
        aspect: "Refrigerant inventory",
        impact: "Potential climate impact from loss of containment",
        condition: "abnormal",
        significance: "medium",
        control: "Leak checks, inventory reconciliation and incident response",
        residualRisk: "low",
      },
    ],
    checklists: [
      {
        id: "dublin-monthly-eems",
        title: "Monthly compliance and meter review",
        status: "submitted",
        ownerRole: "Site environmental lead",
        dueDate: "2026-08-21",
        completedItems: 23,
        totalItems: 25,
        completionPct: 92,
      },
    ],
    actions: [
      {
        id: "dublin-chilled-water-reset",
        title: "Optimise chilled-water temperature reset",
        category: "energy",
        severity: "high",
        status: "in_progress",
        ownerRole: "Energy manager",
        dueDate: "2026-09-30",
        nextStep: "Verify the control change against PUE and redundancy guardrails.",
      },
    ],
    audits: [
      {
        id: "dublin-internal-energy-review",
        title: "Internal energy-performance review",
        type: "internal",
        status: "follow_up_due",
        scheduledDate: "2026-09-12",
        openFindings: 1,
        summary: "Energy baseline relevance requires confirmation after the latest capacity change.",
      },
    ],
  },
  {
    id: "eems-google-dc-usa-central-ohio",
    assessmentId: "997f3f75-809c-4871-99d2-8abc1082d691",
    siteId: "google-dc-usa-central-ohio",
    name: "Central Ohio",
    location: { latitude: 39.9622601, longitude: -83.0007065, countryName: "United States" },
    archetype: "owned_expansion",
    archetypeLabel: "Owned campus with active expansion",
    lifecycle: {
      primaryPhase: "operational",
      concurrentPhases: ["expansion", "construction"],
      phaseGate: "Expansion commissioning readiness",
      targetGateDate: "2026-12-15",
    },
    operatingModel: {
      id: "owned_expansion",
      label: "Direct control with construction interfaces",
      summary: "Live operations remain under direct control while project contractors deliver the expansion package.",
    },
    responsibilities: controls({ dataProvider: "shared" }),
    status: {
      eemsStage: "implementation",
      compliance: "active",
      actionHealth: "verification_due",
      checklistCompletionPct: 78,
      openHighPriorityActions: 2,
      flags: ["Management of change open", "Commissioning evidence incomplete"],
    },
    recordReview: {
      status: "awaiting_site_owner_confirmation",
      label: RECORD_REVIEW_LABEL,
      lastReviewedAt: "2026-08-18",
    },
    metrics: {
      period: ACTUAL_PERIOD,
      facilityEnergyMWh: metric(42_000, "MWh"),
      itEnergyMWh: metric(32_800, "MWh"),
      pue: metric(1.28, "ratio"),
      waterConsumptionM3: metric(13_120, "m³"),
      wueLPerKwh: metric(0.4, "L/kWh"),
      cueKgCo2ePerKwh: metric(0.23, "kgCO₂e/kWh IT"),
    },
    coolingAssets: [
      {
        id: "central-ohio-existing-cooling",
        name: "Existing hybrid cooling plant",
        technology: "Hybrid heat rejection with economiser operation",
        operationalStatus: "active",
        controlOwner: "company",
        waterMode: "hybrid",
        notes: "Existing plant remains live during the expansion programme.",
      },
      {
        id: "central-ohio-expansion-cooling",
        name: "Expansion cooling distribution",
        technology: "Liquid-ready closed-loop distribution",
        operationalStatus: "commissioning",
        controlOwner: "contractor",
        waterMode: "closed_loop",
        notes: "Final ownership transfers after commissioning acceptance.",
      },
    ],
    permits: [
      {
        id: "central-ohio-operational-controls",
        title: "Operational environmental conditions",
        category: "other",
        holder: "company",
        status: "active",
        ownerRole: "Site environmental lead",
        reviewDate: "2026-07-18",
        dueDate: "2027-07-18",
        conditions: genericConditions("Monthly control verification", "Change notification review"),
      },
      {
        id: "central-ohio-construction-runoff",
        title: "Construction stormwater controls",
        category: "construction",
        holder: "shared",
        status: "active",
        ownerRole: "Construction environmental manager",
        reviewDate: "2026-08-11",
        dueDate: "2026-12-31",
        conditions: genericConditions("Post-rainfall inspection", "Sediment-control maintenance"),
      },
    ],
    aspects: [
      {
        id: "central-ohio-live-energy",
        activity: "Live data-centre operation",
        aspect: "Electricity consumption during capacity growth",
        impact: "Operational greenhouse-gas emissions and peak grid demand",
        condition: "normal",
        significance: "high",
        control: "Load-normalised EnPIs and staged commissioning",
        residualRisk: "medium",
      },
      {
        id: "central-ohio-runoff",
        activity: "Expansion construction",
        aspect: "Stormwater runoff and exposed soil",
        impact: "Sediment movement and local water-quality pressure",
        condition: "lifecycle",
        significance: "high",
        control: "Inspection plan, sediment barriers and corrective-action log",
        residualRisk: "medium",
      },
      {
        id: "central-ohio-commissioning",
        activity: "Cooling-system commissioning",
        aspect: "Temporary energy and water demand",
        impact: "Short-term resource consumption",
        condition: "abnormal",
        significance: "medium",
        control: "Commissioning plan with metered test windows",
        residualRisk: "low",
      },
    ],
    checklists: [
      {
        id: "central-ohio-construction-controls",
        title: "Construction environmental controls",
        status: "in_progress",
        ownerRole: "Construction environmental manager",
        dueDate: "2026-08-28",
        completedItems: 18,
        totalItems: 23,
        completionPct: 78,
      },
    ],
    actions: [
      {
        id: "central-ohio-meter-integration",
        title: "Connect expansion meters to the energy baseline",
        category: "energy",
        severity: "high",
        status: "in_progress",
        ownerRole: "Commissioning manager",
        dueDate: "2026-10-15",
        nextStep: "Complete point-to-point testing for facility, IT and cooling meters.",
      },
      {
        id: "central-ohio-moc",
        title: "Close environmental management-of-change review",
        category: "construction",
        severity: "high",
        status: "under_review",
        ownerRole: "Site environmental lead",
        dueDate: "2026-09-05",
        nextStep: "Approve the updated aspect register and operational controls.",
      },
    ],
    audits: [
      {
        id: "central-ohio-commissioning-assurance",
        title: "Expansion commissioning assurance",
        type: "commissioning",
        status: "in_progress",
        scheduledDate: "2026-09-24",
        openFindings: 2,
        summary: "Meter integration and control handover evidence remain open.",
      },
    ],
  },
  {
    id: "eems-google-dc-tha-chonburi-thailand",
    assessmentId: "c7455ede-ea6e-4892-a576-abc81154f4c1",
    siteId: "google-dc-tha-chonburi-thailand",
    name: "Chonburi, Thailand",
    location: { latitude: 13.1857117, longitude: 101.1210777, countryName: "Thailand" },
    archetype: "owned_development",
    archetypeLabel: "Owned greenfield development",
    lifecycle: {
      primaryPhase: "planning",
      concurrentPhases: ["permitting"],
      phaseGate: "Cooling concept and permit strategy approval",
      targetGateDate: "2026-11-20",
    },
    operatingModel: {
      id: "owned_development",
      label: "Developer control with future operator input",
      summary: "Design and permitting responsibilities are coordinated before transfer into construction and operations.",
    },
    responsibilities: controls({
      facilitiesOperator: "tbd",
      coolingOperator: "tbd",
      utilityAccountHolder: "tbd",
      permitHolder: "developer",
      dataProvider: "shared",
      actionApprover: "shared",
    }),
    status: {
      eemsStage: "gap_assessment",
      compliance: "not_assessed",
      actionHealth: "on_track",
      checklistCompletionPct: 46,
      openHighPriorityActions: 2,
      flags: ["Gap assessment in progress", "Cooling selection decision open"],
    },
    recordReview: {
      status: "awaiting_site_owner_confirmation",
      label: RECORD_REVIEW_LABEL,
      lastReviewedAt: "2026-08-18",
    },
    metrics: {
      period: DESIGN_PERIOD,
      facilityEnergyMWh: pendingMetric("MWh", DESIGN_PERIOD),
      itEnergyMWh: pendingMetric("MWh", DESIGN_PERIOD),
      pue: metric(1.16, "ratio", DESIGN_PERIOD, "target"),
      waterConsumptionM3: pendingMetric("m³", DESIGN_PERIOD),
      wueLPerKwh: metric(0.2, "L/kWh", DESIGN_PERIOD, "target"),
      cueKgCo2ePerKwh: metric(0.14, "kgCO₂e/kWh IT", DESIGN_PERIOD, "target"),
    },
    coolingAssets: [
      {
        id: "chonburi-cooling-concept",
        name: "Cooling concept",
        technology: "Technology selection in progress",
        operationalStatus: "not_selected",
        controlOwner: "developer",
        waterMode: "not_selected",
        notes: "Selection requires a water budget, hourly climate assessment and resilience review.",
      },
    ],
    permits: [
      {
        id: "chonburi-environmental-assessment",
        title: "Environmental assessment and planning conditions",
        category: "planning",
        holder: "developer",
        status: "pending",
        ownerRole: "Development environmental manager",
        reviewDate: "2026-08-12",
        dueDate: "2026-11-20",
        conditions: genericConditions("Impact assessment", "Stakeholder commitment register"),
      },
      {
        id: "chonburi-water-availability",
        title: "Water availability and discharge review",
        category: "water",
        holder: "developer",
        status: "review_required",
        ownerRole: "Water programme lead",
        reviewDate: "2026-08-12",
        dueDate: "2026-10-15",
        conditions: genericConditions("Source-specific water balance", "Drought operating scenario"),
      },
    ],
    aspects: [
      {
        id: "chonburi-land",
        activity: "Site development",
        aspect: "Land disturbance and construction footprint",
        impact: "Habitat, soil and local-community disturbance",
        condition: "lifecycle",
        significance: "high",
        control: "Design-stage mitigation hierarchy and construction control plan",
        residualRisk: "medium",
      },
      {
        id: "chonburi-future-water",
        activity: "Future cooling operation",
        aspect: "Projected water demand",
        impact: "Potential pressure on local water availability",
        condition: "lifecycle",
        significance: "critical",
        control: "Cooling option appraisal with an approved annual water budget",
        residualRisk: "high",
      },
      {
        id: "chonburi-future-energy",
        activity: "Future data-centre operation",
        aspect: "Projected electricity demand",
        impact: "Operational greenhouse-gas emissions and grid capacity pressure",
        condition: "lifecycle",
        significance: "high",
        control: "Energy design criteria and efficiency requirements",
        residualRisk: "medium",
      },
    ],
    checklists: [
      {
        id: "chonburi-design-gap",
        title: "Design and permitting gap assessment",
        status: "in_progress",
        ownerRole: "Development environmental manager",
        dueDate: "2026-09-30",
        completedItems: 11,
        totalItems: 24,
        completionPct: 46,
      },
    ],
    actions: [
      {
        id: "chonburi-cooling-selection",
        title: "Approve cooling option against water and resilience criteria",
        category: "cooling",
        severity: "critical",
        status: "in_progress",
        ownerRole: "Design authority",
        dueDate: "2026-10-15",
        nextStep: "Complete the source-specific water study and option comparison.",
      },
      {
        id: "chonburi-energy-design",
        title: "Approve design energy baseline and EnPIs",
        category: "energy",
        severity: "high",
        status: "assigned",
        ownerRole: "Energy design lead",
        dueDate: "2026-10-30",
        nextStep: "Define relevant variables and acceptance thresholds for commissioning.",
      },
    ],
    audits: [
      {
        id: "chonburi-design-review",
        title: "Environmental and energy design review",
        type: "internal",
        status: "scheduled",
        scheduledDate: "2026-10-08",
        openFindings: 0,
        summary: "Review will test permit readiness, significant aspects and energy design controls.",
      },
    ],
  },
  {
    id: "eems-google-dc-nld-groningen-netherlands",
    assessmentId: "7220bd66-772a-4145-aa5d-8e256acc8367",
    siteId: "google-dc-nld-groningen-netherlands",
    name: "Groningen, Netherlands",
    location: { latitude: 53.2190652, longitude: 6.5680077, countryName: "Netherlands" },
    archetype: "build_to_suit",
    archetypeLabel: "Build-to-suit leased facility",
    lifecycle: {
      primaryPhase: "construction",
      concurrentPhases: ["commissioning"],
      phaseGate: "Operational handover readiness",
      targetGateDate: "2027-02-15",
    },
    operatingModel: {
      id: "build_to_suit",
      label: "Contracted delivery with divided controls",
      summary: "Developer-led delivery transfers defined operating responsibilities after commissioning acceptance.",
    },
    responsibilities: controls({
      assetOwner: "landlord",
      facilitiesOperator: "tbd",
      coolingOperator: "developer",
      utilityAccountHolder: "tbd",
      permitHolder: "developer",
      dataProvider: "shared",
      actionApprover: "shared",
    }),
    status: {
      eemsStage: "implementation",
      compliance: "review_required",
      actionHealth: "blocked",
      checklistCompletionPct: 64,
      openHighPriorityActions: 2,
      flags: ["Handover evidence due", "Utility responsibility requires confirmation"],
    },
    recordReview: {
      status: "awaiting_site_owner_confirmation",
      label: RECORD_REVIEW_LABEL,
      lastReviewedAt: "2026-08-18",
    },
    metrics: {
      period: DESIGN_PERIOD,
      facilityEnergyMWh: pendingMetric("MWh", DESIGN_PERIOD),
      itEnergyMWh: pendingMetric("MWh", DESIGN_PERIOD),
      pue: metric(1.2, "ratio", DESIGN_PERIOD, "target"),
      waterConsumptionM3: pendingMetric("m³", DESIGN_PERIOD),
      wueLPerKwh: metric(0.35, "L/kWh", DESIGN_PERIOD, "target"),
      cueKgCo2ePerKwh: metric(0.41, "kgCO₂e/kWh IT", DESIGN_PERIOD, "target"),
    },
    coolingAssets: [
      {
        id: "groningen-closed-loop",
        name: "Commissioning cooling plant",
        technology: "Closed-loop distribution with air-cooled heat rejection",
        operationalStatus: "commissioning",
        controlOwner: "developer",
        waterMode: "dry_led",
        notes: "Control ownership transfers after functional and resilience testing.",
      },
    ],
    permits: [
      {
        id: "groningen-construction-controls",
        title: "Construction environmental conditions",
        category: "construction",
        holder: "developer",
        status: "active",
        ownerRole: "Developer environmental manager",
        reviewDate: "2026-08-07",
        dueDate: "2027-02-15",
        conditions: genericConditions("Site runoff controls", "Construction waste tracking"),
      },
      {
        id: "groningen-operational-handover",
        title: "Operational environmental obligation handover",
        category: "other",
        holder: "shared",
        status: "handover_due",
        ownerRole: "Handover manager",
        reviewDate: "2026-08-14",
        dueDate: "2026-12-18",
        conditions: genericConditions("Responsibility matrix", "Evidence index", "Operational control transfer"),
      },
    ],
    aspects: [
      {
        id: "groningen-flush-water",
        activity: "Cooling-system commissioning",
        aspect: "System flushing and discharge water",
        impact: "Temporary water demand and discharge-quality risk",
        condition: "abnormal",
        significance: "high",
        control: "Approved flushing method, sampling and discharge route",
        residualRisk: "medium",
      },
      {
        id: "groningen-refrigerant-charge",
        activity: "Cooling-system commissioning",
        aspect: "Initial refrigerant charge",
        impact: "Potential climate impact from loss of containment",
        condition: "abnormal",
        significance: "medium",
        control: "Charge reconciliation and pressure-test evidence",
        residualRisk: "low",
      },
      {
        id: "groningen-construction-waste",
        activity: "Facility construction",
        aspect: "Construction material and packaging waste",
        impact: "Resource consumption and waste generation",
        condition: "lifecycle",
        significance: "medium",
        control: "Segregation plan and monthly waste reconciliation",
        residualRisk: "low",
      },
    ],
    checklists: [
      {
        id: "groningen-handover-evidence",
        title: "Commissioning and EEMS handover evidence",
        status: "in_progress",
        ownerRole: "Handover manager",
        dueDate: "2026-12-18",
        completedItems: 16,
        totalItems: 25,
        completionPct: 64,
      },
    ],
    actions: [
      {
        id: "groningen-acceptance-tests",
        title: "Close cooling acceptance-test findings",
        category: "cooling",
        severity: "high",
        status: "in_progress",
        ownerRole: "Commissioning manager",
        dueDate: "2026-10-28",
        nextStep: "Repeat resilience tests and attach signed acceptance records.",
      },
      {
        id: "groningen-responsibility-matrix",
        title: "Approve utility and permit responsibility matrix",
        category: "compliance",
        severity: "high",
        status: "blocked",
        ownerRole: "Handover manager",
        dueDate: "2026-09-30",
        nextStep: "Resolve open ownership fields with the developer and future operator.",
      },
    ],
    audits: [
      {
        id: "groningen-commissioning-assurance",
        title: "Commissioning and handover assurance",
        type: "commissioning",
        status: "in_progress",
        scheduledDate: "2026-10-20",
        openFindings: 3,
        summary: "Cooling acceptance and operational responsibility evidence remain open.",
      },
    ],
  },
  {
    id: "eems-google-dc-usa-northern-virginia",
    assessmentId: "53a223f3-c70e-4a92-9752-64de79ce8b4f",
    siteId: "google-dc-usa-northern-virginia",
    name: "Northern Virginia",
    location: { latitude: 38.8047, longitude: -77.8, countryName: "United States" },
    archetype: "colocation",
    archetypeLabel: "Colocation capacity",
    lifecycle: {
      primaryPhase: "operational",
      concurrentPhases: [],
      phaseGate: "Annual provider assurance review",
      targetGateDate: "2026-11-10",
    },
    operatingModel: {
      id: "colocation",
      label: "Contractual operational control",
      summary: "IT operations are internally controlled while facility utilities, cooling and permits are provider-managed.",
    },
    responsibilities: controls({
      assetOwner: "landlord",
      facilitiesOperator: "landlord",
      coolingOperator: "landlord",
      utilityAccountHolder: "landlord",
      permitHolder: "landlord",
      dataProvider: "landlord",
      actionApprover: "shared",
    }),
    status: {
      eemsStage: "assurance",
      compliance: "review_required",
      actionHealth: "blocked",
      checklistCompletionPct: 58,
      openHighPriorityActions: 1,
      flags: ["Data access gap", "Provider evidence review open"],
    },
    recordReview: {
      status: "awaiting_site_owner_confirmation",
      label: RECORD_REVIEW_LABEL,
      lastReviewedAt: "2026-08-18",
    },
    metrics: {
      period: ACTUAL_PERIOD,
      facilityEnergyMWh: metric(8_600, "MWh"),
      itEnergyMWh: metric(6_060, "MWh"),
      pue: metric(1.42, "ratio"),
      waterConsumptionM3: metric(2_424, "m³"),
      wueLPerKwh: metric(0.4, "L/kWh"),
      cueKgCo2ePerKwh: metric(0.64, "kgCO₂e/kWh IT"),
    },
    coolingAssets: [
      {
        id: "northern-virginia-provider-cooling",
        name: "Provider cooling service",
        technology: "Landlord chilled-water service",
        operationalStatus: "active",
        controlOwner: "landlord",
        waterMode: "provider_service",
        notes: "Performance and water allocation depend on provider reporting and contract terms.",
      },
    ],
    permits: [
      {
        id: "northern-virginia-provider-assurance",
        title: "Provider environmental assurance statement",
        category: "other",
        holder: "landlord",
        status: "review_required",
        ownerRole: "Supplier assurance manager",
        reviewDate: "2026-07-30",
        dueDate: "2026-11-10",
        conditions: genericConditions("Permit status confirmation", "Material incident disclosure", "Annual evidence refresh"),
      },
    ],
    aspects: [
      {
        id: "northern-virginia-contracted-energy",
        activity: "Colocation IT operation",
        aspect: "Allocated facility and cooling electricity",
        impact: "Operational greenhouse-gas emissions and grid demand",
        condition: "normal",
        significance: "high",
        control: "Contracted performance reporting and monthly allocation review",
        residualRisk: "medium",
      },
      {
        id: "northern-virginia-indirect-water",
        activity: "Provider cooling service",
        aspect: "Allocated cooling-water consumption",
        impact: "Pressure on local water availability",
        condition: "normal",
        significance: "high",
        control: "Annual water allocation methodology and service review",
        residualRisk: "high",
      },
      {
        id: "northern-virginia-backup-power",
        activity: "Facility resilience operation",
        aspect: "Provider-managed backup generation",
        impact: "Air emissions and fuel-storage risk",
        condition: "abnormal",
        significance: "medium",
        control: "Provider assurance evidence and incident notification terms",
        residualRisk: "medium",
      },
    ],
    checklists: [
      {
        id: "northern-virginia-provider-evidence",
        title: "Supplier environmental and energy evidence",
        status: "in_progress",
        ownerRole: "Supplier assurance manager",
        dueDate: "2026-09-18",
        completedItems: 14,
        totalItems: 24,
        completionPct: 58,
      },
    ],
    actions: [
      {
        id: "northern-virginia-data-clause",
        title: "Add water allocation and cooling-efficiency data requirements",
        category: "assurance",
        severity: "high",
        status: "blocked",
        ownerRole: "Commercial service manager",
        dueDate: "2026-10-31",
        nextStep: "Agree monthly data fields and evidence rights with the provider.",
      },
    ],
    audits: [
      {
        id: "northern-virginia-supplier-review",
        title: "Provider environmental and energy assurance review",
        type: "supplier",
        status: "follow_up_due",
        scheduledDate: "2026-09-22",
        openFindings: 2,
        summary: "Water allocation methodology and cooling performance evidence require follow-up.",
      },
    ],
  },
  {
    id: "eems-google-dc-gbr-waltham-cross-united-kingdom",
    assessmentId: "d9207af4-3c27-4147-ae0e-14cb9b47f234",
    siteId: "google-dc-gbr-waltham-cross-united-kingdom",
    name: "Waltham Cross, United Kingdom",
    location: { latitude: 51.6857829, longitude: -0.0330001, countryName: "United Kingdom" },
    archetype: "partner_transition",
    archetypeLabel: "Partner-operated control handover",
    lifecycle: {
      primaryPhase: "operational",
      concurrentPhases: ["commissioning"],
      phaseGate: "Operating-control handover approval",
      targetGateDate: "2026-12-20",
    },
    operatingModel: {
      id: "partner_transition",
      label: "Shared control during handover",
      summary: "Operational responsibilities are distributed across internal and partner teams while controls and records move into the common management system.",
    },
    responsibilities: controls({
      assetOwner: "partner",
      facilitiesOperator: "partner",
      coolingOperator: "partner",
      utilityAccountHolder: "partner",
      permitHolder: "partner",
      dataProvider: "shared",
      actionApprover: "shared",
    }),
    status: {
      eemsStage: "controls_design",
      compliance: "review_required",
      actionHealth: "blocked",
      checklistCompletionPct: 71,
      openHighPriorityActions: 2,
      flags: ["Control handover action blocked", "Transition responsibility unresolved"],
    },
    recordReview: {
      status: "awaiting_site_owner_confirmation",
      label: RECORD_REVIEW_LABEL,
      lastReviewedAt: "2026-08-18",
    },
    metrics: {
      period: ACTUAL_PERIOD,
      facilityEnergyMWh: metric(5_200, "MWh"),
      itEnergyMWh: metric(3_850, "MWh"),
      pue: metric(1.35, "ratio"),
      waterConsumptionM3: metric(1_925, "m³"),
      wueLPerKwh: metric(0.5, "L/kWh"),
      cueKgCo2ePerKwh: metric(0.43, "kgCO₂e/kWh IT"),
    },
    coolingAssets: [
      {
        id: "waltham-cross-hybrid-cooling",
        name: "Partner-managed cooling plant",
        technology: "Hybrid wet and dry heat rejection",
        operationalStatus: "transition",
        controlOwner: "partner",
        waterMode: "hybrid",
        notes: "Operating sequences and performance evidence are being aligned to the common control plan.",
      },
    ],
    permits: [
      {
        id: "waltham-cross-operational-controls",
        title: "Operational environmental conditions",
        category: "other",
        holder: "partner",
        status: "review_required",
        ownerRole: "Partner compliance lead",
        reviewDate: "2026-08-05",
        dueDate: "2026-09-30",
        conditions: genericConditions("Responsibility confirmation", "Transition incident route"),
      },
      {
        id: "waltham-cross-handover-plan",
        title: "Operating responsibility handover plan",
        category: "other",
        holder: "shared",
        status: "handover_due",
        ownerRole: "Transition manager",
        reviewDate: "2026-08-05",
        dueDate: "2026-11-15",
        conditions: genericConditions("Asset-register reconciliation", "Control evidence transfer", "Record retention"),
      },
    ],
    aspects: [
      {
        id: "waltham-cross-control-handover",
        activity: "Operating-control handover",
        aspect: "Cooling controls split across responsible parties",
        impact: "Reduced energy efficiency and delayed response to deviations",
        condition: "abnormal",
        significance: "high",
        control: "Shared operating procedure, alarm route and monthly performance review",
        residualRisk: "medium",
      },
      {
        id: "waltham-cross-refrigerant-inventory",
        activity: "Cooling asset handover",
        aspect: "Refrigerant inventory and maintenance responsibility",
        impact: "Potential climate impact from loss of containment",
        condition: "lifecycle",
        significance: "critical",
        control: "Verified inventory, leak-check schedule and assigned maintenance owner",
        residualRisk: "medium",
      },
      {
        id: "waltham-cross-equipment-waste",
        activity: "Equipment maintenance and replacement",
        aspect: "Electrical equipment and material waste transfers",
        impact: "Waste generation and resource loss",
        condition: "lifecycle",
        significance: "high",
        control: "Reuse hierarchy, asset tracking and approved service-provider route",
        residualRisk: "medium",
      },
    ],
    checklists: [
      {
        id: "waltham-cross-handover-checklist",
        title: "Operations and environmental control handover",
        status: "in_progress",
        ownerRole: "Transition manager",
        dueDate: "2026-11-15",
        completedItems: 17,
        totalItems: 24,
        completionPct: 71,
      },
    ],
    actions: [
      {
        id: "waltham-cross-refrigerant-handover",
        title: "Complete refrigerant inventory and maintenance handover",
        category: "transition",
        severity: "critical",
        status: "in_progress",
        ownerRole: "Cooling transition lead",
        dueDate: "2026-09-15",
        nextStep: "Reconcile installed charge, leak-check status and accountable maintenance owner.",
      },
      {
        id: "waltham-cross-transition-raci",
        title: "Approve transition responsibility matrix",
        category: "compliance",
        severity: "high",
        status: "blocked",
        ownerRole: "Transition manager",
        dueDate: "2026-08-31",
        nextStep: "Resolve the permit-holder and evidence-approval roles.",
      },
    ],
    audits: [
      {
        id: "waltham-cross-transition-assurance",
        title: "Transition and operating-control assurance",
        type: "transition",
        status: "in_progress",
        scheduledDate: "2026-09-08",
        openFindings: 3,
        summary: "Responsibility, refrigerant and evidence-transfer controls remain under review.",
      },
    ],
  },
];

export const EEMS_PROFILE_BY_SITE_ID: Readonly<Record<string, SiteEemsProfile>> = Object.freeze(
  Object.fromEntries(EEMS_ARCHETYPE_PROFILES.map((profile) => [profile.siteId, profile])),
);

function primaryPhaseFor(assessment: AssessmentResult): SiteEemsProfile["lifecycle"]["primaryPhase"] {
  const facilityStatus = assessment.site.location_evidence?.facility_status;
  if (facilityStatus === "under_construction") return "construction";
  if (facilityStatus === "operating") return "operational";
  return "planning";
}

function countryNameFor(assessment: AssessmentResult): string {
  const publishedLabelCountry = assessment.site.name.includes(",")
    ? assessment.site.name.split(",").at(-1)?.trim()
    : null;
  return (
    assessment.site.country_name ??
    assessment.source?.grid?.country_name ??
    assessment.source?.grid?.entity ??
    assessment.source?.water?.geography?.name_0 ??
    publishedLabelCountry ??
    "Country to be confirmed"
  );
}

function genericMetric(value: number | null | undefined, unit: string, period: string): MetricValue {
  return value == null ? pendingMetric(unit, period) : metric(value, unit, period, "actual");
}

function currentGridFactor(assessment: AssessmentResult): number | null {
  const source = assessment.source?.grid;
  const candidate = source?.emissions_intensity_gco2_per_kwh
    ?? source?.factor_gco2e_per_kwh
    ?? source?.carbon_intensity;
  return typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0 ? candidate : null;
}

function cueMetricFor(assessment: AssessmentResult, pueMetric: MetricValue): MetricValue {
  const gridFactor = currentGridFactor(assessment);
  if (pueMetric.value === null || gridFactor === null) {
    return pendingMetric("kgCO₂e/kWh IT", pueMetric.period);
  }
  return metric(
    pueMetric.value * gridFactor / 1000,
    "kgCO₂e/kWh IT",
    pueMetric.period,
    pueMetric.kind === "target" ? "target" : "actual",
  );
}

export function createGapAssessmentProfile(assessment: AssessmentResult): SiteEemsProfile {
  const period = assessment.created_at?.slice(0, 7) ?? "2026-08";
  const pue = assessment.site.pue;
  const wue = assessment.site.wue_l_per_kwh;
  const cue = assessment.policy_v1?.proxy_metrics?.cue_location_based_kgco2e_per_kwh_it;
  const numericCue = typeof cue === "number" ? cue : null;

  return {
    id: `eems-${assessment.site.id}`,
    assessmentId: assessment.assessment_id,
    siteId: assessment.site.id,
    name: assessment.site.name,
    location: {
      latitude: assessment.site.latitude,
      longitude: assessment.site.longitude,
      countryName: countryNameFor(assessment),
    },
    archetype: null,
    archetypeLabel: "Site onboarding",
    lifecycle: {
      primaryPhase: primaryPhaseFor(assessment),
      concurrentPhases: [],
      phaseGate: "Complete initial EEMS gap assessment",
    },
    operatingModel: {
      id: "to_be_confirmed",
      label: "Operating model to be confirmed",
      summary: "Control rights and site responsibilities will be assigned during onboarding.",
    },
    responsibilities: controls({
      assetOwner: "tbd",
      facilitiesOperator: "tbd",
      itOperator: "tbd",
      coolingOperator: "tbd",
      utilityAccountHolder: "tbd",
      permitHolder: "tbd",
      dataProvider: "tbd",
      actionApprover: "tbd",
    }),
    status: {
      eemsStage: "gap_assessment",
      compliance: "not_assessed",
      actionHealth: "on_track",
      checklistCompletionPct: 0,
      openHighPriorityActions: 1,
      flags: ["Gap assessment in progress", "Operating model confirmation required"],
    },
    recordReview: {
      status: "awaiting_site_owner_confirmation",
      label: RECORD_REVIEW_LABEL,
    },
    metrics: {
      period,
      facilityEnergyMWh: pendingMetric("MWh", period),
      itEnergyMWh: genericMetric(assessment.site.annual_it_energy_mwh, "MWh/year", period),
      pue: genericMetric(pue, "ratio", period),
      waterConsumptionM3: pendingMetric("m³", period),
      wueLPerKwh: genericMetric(wue, "L/kWh", period),
      cueKgCo2ePerKwh: genericMetric(numericCue, "kgCO₂e/kWh IT", period),
    },
    coolingAssets: [],
    permits: [],
    aspects: [],
    checklists: [
      {
        id: `${assessment.site.id}-initial-gap-assessment`,
        title: "Initial environmental and energy gap assessment",
        status: "assigned",
        ownerRole: "Site contributor",
        dueDate: "2026-10-31",
        completedItems: 0,
        totalItems: 24,
        completionPct: 0,
      },
    ],
    actions: [
      {
        id: `${assessment.site.id}-confirm-controls`,
        title: "Confirm operating model and control responsibilities",
        category: "assurance",
        severity: "high",
        status: "assigned",
        ownerRole: "Portfolio EEMS manager",
        dueDate: "2026-10-31",
        nextStep: "Assign site, permit, utilities, cooling and evidence owners.",
      },
    ],
    audits: [],
  };
}

export function getEemsProfile(assessment: AssessmentResult): SiteEemsProfile {
  const archetype = EEMS_PROFILE_BY_SITE_ID[assessment.site.id];
  if (!archetype) return createGapAssessmentProfile(assessment);
  const pueMetric = archetype.metrics.pue;
  return {
    ...archetype,
    assessmentId: assessment.assessment_id,
    name: assessment.site.name,
    location: {
      latitude: assessment.site.latitude,
      longitude: assessment.site.longitude,
      countryName: countryNameFor(assessment),
    },
    metrics: {
      ...archetype.metrics,
      cueKgCo2ePerKwh: cueMetricFor(assessment, pueMetric),
    },
  };
}

export function buildEemsPortfolio(assessments: AssessmentResult[]): SiteEemsProfile[] {
  return assessments.map(getEemsProfile);
}

export function isPartyControl(value: string): value is PartyControl {
  return ["company", "landlord", "developer", "partner", "contractor", "shared", "tbd"].includes(value);
}
