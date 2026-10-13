/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DocSection {
  id: string;
  title: string;
  items: any[];
  headers?: string[];
  smartType?: string;
  columns?: any[];
}

export interface QmsDocumentRecord {
  id: string;
  document_name: string;
  items?: any[]; // Legacy support
  sections?: DocSection[]; // Multi-table support
  lastUpdatedTime: number;
}

export interface CsrDocument {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface CsrComparisonItem {
  customerId: string;
  customerNumber: string;
  customerTitle: string;
  customerText: string;
  mappedIatfClauseId: string;
  alignmentScore: number;
  status: "fully_aligned" | "partially_aligned" | "gap_detected";
  comparisonText: string;
  documentId?: string; // Optional reference to the source document
  documentTitle?: string; // Cache the source document title
}

export interface IndicatorRecord {
  period: string; // Period name e.g. "فروردین" or "Q1"
  value: number; // Actual measured value
  isArchived: boolean; // Is archived/historical vs active/running
}

export interface Indicator {
  id: string;
  type: "process" | "quality_objective" | "short_term" | "long_term";
  titleFa: string;
  titleEn: string;
  clauseId: string; // Mapped subclause ID (e.g. 9.1.1.1, 10.2.4)
  target: number; // Target limit value
  unit: string; // Unit description (e.g. "%", "PPM", "Days")
  records: IndicatorRecord[];
  formula?: string;
  variableLabels?: Record<string, string>;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'user';
  recoveryQuestion: string;
  recoveryAnswerHash: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

