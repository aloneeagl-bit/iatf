import { Role, WorkflowStep } from '../components/TeamManagementTypes';

export type EventType =
  | 'CUSTOMER_COMPLAINT'
  | 'NONCONFORMITY_8D'
  | 'AUDIT_FINDING'
  | 'PFMEA_CHANGE'
  | 'CONTROL_PLAN_REVISION'
  | 'JOB_SETUP_VARIANCE'
  | 'WORK_INSTRUCTION_CHANGE'
  | 'SUPPLIER_QUALITY_ISSUE'
  | 'KPI_DEVIATION'
  | 'RISK_ASSESSMENT'
  | 'INSPECTION_RESULT'
  | 'SPC_CAPABILITY_ISSUE'
  | 'MSA_GAGE_RR'
  | 'APQP_PPAP_DELIVERABLE'
  | 'DOCUMENT_REVISION';

export interface EventClassification {
  eventType: EventType;
  titleFa: string;
  titleEn: string;
  confidence: number; // 0 to 100
  reasonFa: string;
  reasonEn: string;
  detectedEntities: string[];
  primaryClauseId?: string;
}

export type StepStatus =
  | 'Existing'
  | 'Recommended'
  | 'Missing'
  | 'Completed'
  | 'Pending'
  | 'Needs Review'
  | 'Conditional'
  | 'Optional'
  | 'Blocked';

export interface RouteStep {
  id: string;
  stepNumber: number;
  name: string;
  nameFa: string;
  status: StepStatus;
  proposedRoleId?: string;
  proposedRoleName?: string;
  proposedRoleNameFa?: string;
  affectedEntity: string;
  affectedEntityFa: string;
  whyFa: string;
  whyEn: string;
  clauseId?: string;
  expectedInputFa: string;
  expectedOutputFa: string;
  dependencies: string[];
  isMandatory: boolean;
  confidence: number;
}

export interface WorkflowRoute {
  id: string;
  titleFa: string;
  titleEn: string;
  type: 'PRIMARY' | 'ALTERNATIVE' | 'MINIMAL';
  descriptionFa: string;
  descriptionEn: string;
  steps: RouteStep[];
  totalSteps: number;
  existingCount: number;
  recommendedCount: number;
  missingCount: number;
  coverageScore: number; // Percentage 0-100
  gapsFa: string[];
  gapsEn: string[];
}

export interface NavigatorAnalysisResult {
  eventClassification: EventClassification;
  selectedGoalFa: string;
  selectedGoalEn: string;
  routes: WorkflowRoute[];
  activeRouteId: string;
  isRecalculating: boolean;
  lastUpdated: string;
}
