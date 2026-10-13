import { IATFClause } from '../data/iatfData';

export interface User {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  role: 'admin' | 'user'; // legacy role for backwards compatibility with App.tsx
  roleIds?: string[]; // Multiple roles supported dynamically
  companyId?: string; // Multi-Tenant Company ID
  companyName?: string;
  site?: string;
  plant?: string;
  departmentIds?: string[];
  jobPosition?: string;
  email?: string;
  avatar?: string; // profile photo as base64 or SVG name
  securityQuestion?: string;
  securityAnswer?: string;
  isBlocked?: boolean;
  isOnline?: boolean;
  lastLoginAt?: string;
  lastActivityAt?: string;
  failedLoginAttempts?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  digitalSignature?: string; // Base64 signature image or vector data
  preferredLanguage?: 'fa' | 'en';
  preferredTimezone?: string;
  preferredTheme?: 'dark' | 'light';
  allowedProducts?: string[]; // Allowed product IDs for scoping user permissions
  permissions: {
    home: boolean;
    iatf: boolean;
    iatf_tools: boolean;
    csr: boolean;
    indicators: boolean;
    strategic_management: boolean;
    iso9001_docs: boolean;
    db_explorer: boolean;
    records: boolean;
    clauses?: Record<string, { view: boolean; docList: boolean; archive: boolean }>;
    projectTree?: Record<string, boolean>;
  };
}

export interface Product {
  id: string;
  name: string;
  technicalNumber: string;
  customerName: string;
  imageUrl: string;
  organizationId: string;
  createdAt: string;
  status: 'active' | 'development' | 'obsolete';
}

export interface Organization {
  id: string;
  name: string;
  nameFa: string;
  code: string;
  description?: string;
  logoUrl?: string;
  industry: string;
  establishedDate: string;
  address: string;
  contactPerson: string;
  email: string;
  phone: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string; // userId
  dueDate: string;
  status: 'pending' | 'in_progress' | 'done';
  feedback?: string;
  createdAt: string;
  module?: string;
  productId?: string; // Associated product ID for multi-product scoping
}

export interface Proposal {
  id: string;
  userId: string;
  userFullName: string;
  timestamp: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  module: 'home' | 'iatf_tools' | 'csr' | 'indicators' | 'strategic_management' | 'iso9001_docs' | 'records' | 'header_title';
  targetId: string;
  targetName: string;
  proposedData: any;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Role {
  id: string;
  name: string;
  nameFa: string;
  isEnabled: boolean;
  isSystem?: boolean; // System roles cannot be deleted
  companyId: string; // Multi-Tenant
  permissions: {
    home: boolean;
    iatf: boolean;
    iatf_tools: boolean;
    csr: boolean;
    indicators: boolean;
    strategic_management: boolean;
    iso9001_docs: boolean;
    db_explorer: boolean;
    records: boolean;
    clauses?: Record<string, {
      view: boolean;
      create: boolean;
      edit: boolean;
      delete: boolean;
      print: boolean;
      export: boolean;
      import: boolean;
      approve: boolean;
      reject: boolean;
      versionControl: boolean;
      attachments: boolean;
      history: boolean;
      logs: boolean;
    }>;
    projectTree?: Record<string, boolean>;
  };
}

export interface OrgUnit {
  id: string;
  type: 'company' | 'site' | 'plant' | 'department' | 'team' | 'position';
  name: string;
  nameFa: string;
  parentId?: string; // For hierarchy relation
  companyId: string;
}

export interface ProcessOwner {
  id: string;
  processKey: string; // matches field1 (process name) or ID in the Turtle matrix
  processName: string;
  ownerUserId: string;
  ownerFullName: string;
  backupUserId?: string;
  backupFullName?: string;
  companyId: string;
}

export interface WorkflowStep {
  stepNumber: number;
  name: string;
  nameFa: string;
  approverRoleId?: string;
  approverUserId?: string;
  isParallel?: boolean;
}

export interface Workflow {
  id: string;
  documentType: string; // documentType from document templates
  companyId: string;
  steps: WorkflowStep[];
}

export interface WorkflowHistoryItem {
  timestamp: string;
  userId: string;
  userFullName: string;
  action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'RETURN' | 'CANCEL' | 'REOPEN';
  stepNumber: number;
  stepName: string;
  comment: string;
}

export interface WorkflowHistory {
  id: string;
  documentId: string;
  documentName: string;
  companyId: string;
  currentStepIndex: number;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'RETURNED' | 'CANCELLED';
  history: WorkflowHistoryItem[];
}

export interface ImmutableAuditLog {
  id: string;
  userId: string;
  username: string;
  userFullName: string;
  companyId: string;
  timestamp: string;
  action: string;
  actionFa: string;
  module: string;
  recordId: string;
  ipAddress: string;
  browser: string;
  os: string;
  device: string;
  preValue: string; // JSON string of old state
  postValue: string; // JSON string of new state
}

export interface ActiveSession {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  companyId: string;
  loginTime: string;
  lastActivity: string;
  ipAddress: string;
  device: string;
  browser: string;
}
