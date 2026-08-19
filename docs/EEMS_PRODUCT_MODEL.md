# CASCADIS environmental and energy management model

## Product role

CASCADIS expands the existing location-intelligence module into a portfolio environmental and energy management workspace for data centres. The model joins portfolio oversight, site lifecycle, operating responsibilities, compliance work, environmental aspects, energy performance, contributor checklists, actions and assurance.

The current GitHub Pages edition is a read-only management workspace. Operational records await site-owner confirmation. Durable edits, approvals, attachments, notifications and audit history require a connected application service in a later phase.

## Management-system structure

The workspace follows the common high-level structure used by ISO management systems:

| Management need | CASCADIS workspace |
|---|---|
| Context, scope and accountable roles | Portfolio scope, lifecycle and responsibility matrix |
| Environmental aspects, impacts and obligations | Environmental and compliance registers |
| Significant energy uses, baselines and EnPIs | Energy and utilities register with PUE, WUE and CUE |
| Operational planning and control | Cooling asset register and contributor checklists |
| Objectives and improvement work | Assigned actions with owner, due date, status and next step |
| Performance evaluation | Command-center indicators, audits and management-review records |
| Continual improvement | Findings, corrective work and verification status |

The design supports ISO 14001:2026 and ISO 50001:2018 workflows. The interface does not make a certification or conformity claim.

The management-attention queue uses a deterministic sequence: compliance exceptions first, then blocked or overdue work, verification due, the number of open high-priority actions and open gap assessments. The queue is an operating-worklist order rather than a risk score.

## Six site archetypes

Lifecycle and ownership are independent dimensions. A site can be operational while an expansion is under construction, or operate under shared control while a management-system handover is in progress.

| Archetype | Lifecycle pattern | Operating-control model |
|---|---|---|
| Owned mature | Operational | Direct operational control |
| Owned expansion | Operational plus expansion | Direct control with project interfaces |
| Owned development | Planning and permitting | Developer-to-operator mobilisation |
| Build-to-suit | Construction and commissioning | Developer control moving to the future operator |
| Colocation | Operational | Provider-controlled infrastructure with customer assurance rights |
| Partner transition | Operational and control handover | Shared responsibilities during management-system integration |

The responsibility matrix records control separately for the asset, facilities, IT, cooling, utility account, permit, data and action approval. The separation prevents an ownership label from being treated as a complete RACI.

## Market patterns incorporated

The product structure reflects recurring patterns in enterprise EHS, environmental and energy-management products:

- a portfolio hierarchy with site drill-down;
- table-first registers backed by a geographic view;
- an exception queue for management attention;
- obligations, findings and actions linked to owners and due dates;
- site applicability with common portfolio templates;
- contributor checklists and evidence-oriented workflows;
- energy drill-down from portfolio indicators to site and equipment context;
- lifecycle continuity from construction and permitting through commissioning and operations.

Reference product pages reviewed:

- [Enablon solutions for data centres](https://www.wolterskluwer.com/en/solutions/enablon/solutions-for-data-centers)
- [Enablon environmental management](https://www.wolterskluwer.com/en/solutions/enablon/environmental-management-software)
- [Sphera operational compliance](https://sphera.com/solutions/environment-health-safety-sustainability/operational-compliance/)
- [Cority Environmental Cloud](https://www.cority.com/environmental-cloud/)
- [Intelex sustainability management](https://www.intelex.com/products/applications/sustainability-management-software)
- [Benchmark Gensuite environmental management](https://benchmarkgensuite.com/solutions/environmental-management/)
- [IBM Envizi interval meter analytics](https://www.ibm.com/products/envizi/interval-meter-analytics)
- [Schneider Electric Resource Advisor](https://www.se.com/us/en/work/services/sustainability-business/energy-and-sustainability-software/energy-management-software-resource-advisor/)

## Recommended connected-system roadmap

The next implementation should add authenticated contributors, role-based permissions, versioned workflow records, attachments, immutable event history, notifications, meter ingestion and approval gates. A relational EEMS service should store management records independently from the existing location-assessment API while joining both systems through stable site IDs.

My assumptions: the first release is intended for portfolio workflow evaluation and design validation. Certification evidence, legal applicability decisions and live operational control remain outside the static release. Correct me if needed.
