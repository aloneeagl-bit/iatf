import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, UserCheck, Shield, Key, Plus, Trash2, Check, X, AlertCircle, 
  Inbox, ListTodo, Clipboard, Play, CheckCircle2, RefreshCw, Eye, EyeOff,
  UserPlus, UserMinus, Calendar, ArrowRight, Sparkles, Filter, CheckSquare, Info,
  Lock, Unlock, Upload, HelpCircle, History, Activity, ShieldAlert, BadgeAlert,
  Settings, ShieldCheck, Copy, Download, PenTool, CheckSquare as CheckIcon,
  Network, BookOpen, Layers, User as UserIcon, Compass, ExternalLink, MessageSquare, Tag, FileText, RotateCcw, Link
} from 'lucide-react';

import { iatfData, IATFClause } from '../data/iatfData';
import { 
  User, Task, Proposal, Role, OrgUnit, ProcessOwner, Workflow, 
  WorkflowHistory, ImmutableAuditLog, ActiveSession, WorkflowStep, Product 
} from './TeamManagementTypes';
import { hasUserPermission } from './TeamManagementPermissionEngine';

// Backward compatibility exports for App.tsx and other views
export type { User, Task, Proposal, Product };


// Import our beautifully designed sub-components
import { TeamManagementDashboard } from './TeamManagementDashboard';
import { TeamManagementOrgStructure } from './TeamManagementOrgStructure';
import { TeamManagementProcessOwners } from './TeamManagementProcessOwners';
import { TeamManagementWorkflows } from './TeamManagementWorkflows';
import { TeamManagementAuditLogs } from './TeamManagementAuditLogs';
import { 
  WorkflowCartableTask, 
  TaskComment,
  getStoredWorkflowCartableTasks, 
  seedInitialWorkflowCartableTasks, 
  getCartableWorkflowTasksForUser, 
  approveWorkflowCartableTask, 
  rejectWorkflowCartableTask,
  addTaskComment,
  syncConfiguredWorkflowsToCartable,
  isUserAuthorizedForWorkflowTask 
} from '../lib/workflowCartableSync';

// Helper to write robust row-level Immutable Audit Logs in localStorage
export function logSystemActivity(
  username: string, 
  fullName: string, 
  action: string, 
  actionFa: string, 
  details: string,
  module: string = 'identity',
  recordId: string = 'N/A',
  preVal: any = {},
  postVal: any = {}
) {
  try {
    const raw = localStorage.getItem('qms_user_audit_log') || '[]';
    const logs = JSON.parse(raw);
    const newLog: ImmutableAuditLog = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      userId: 'usr-' + username,
      username,
      userFullName: fullName,
      companyId: 'company-primary',
      timestamp: new Date().toISOString(),
      action,
      actionFa,
      module,
      recordId,
      ipAddress: '192.168.1.' + (Math.floor(Math.random() * 250) + 2),
      browser: 'Chrome 124',
      os: 'Windows 11',
      device: 'Desktop PC',
      preValue: JSON.stringify(preVal),
      postValue: JSON.stringify(postVal)
    };
    logs.unshift(newLog);
    localStorage.setItem('qms_user_audit_log', JSON.stringify(logs.slice(0, 1500)));
    
    // Dispatch reactive events
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('qms-audit-log-updated'));
  } catch (e) {
    console.error('Error writing audit log:', e);
  }
}

interface TeamManagementProps {
  lang: 'fa' | 'en';
  currentUser: User | null;
  users: User[];
  tasks: Task[];
  proposals: Proposal[];
  onLogin: (username: string, password?: string) => boolean | { success: boolean; error?: string };
  onLogout: () => void;
  onAddUser: (user: Omit<User, 'id'>) => void;
  onDeleteUser: (id: string) => void;
  onUpdatePermissions: (userId: string, permissions: User['permissions']) => void;
  onUpdateUser?: (updatedUser: User) => void;
  onAddTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onUpdateTaskStatus: (taskId: string, status: Task['status'], feedback?: string) => void;
  onApproveProposal: (proposalId: string) => void;
  onRejectProposal: (proposalId: string) => void;
  products?: Product[];
}

interface ClausePermissionNodeProps {
  key?: string | number;
  clause: IATFClause;
  rolePermissions: Record<string, any>;
  onToggle: (clauseId: string, field: string, checked: boolean) => void;
  isRtl: boolean;
}

// Compact Recursive Standard Clause Permissions Selector with toggle checkboxes (Support 13 actions per clause!)
function ClausePermissionNode({ 
  clause, 
  rolePermissions, 
  onToggle,
  isRtl
}: ClausePermissionNodeProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const perm = rolePermissions[clause.id] || {
    view: true, create: true, edit: true, delete: true, print: true, 
    export: true, import: true, approve: true, reject: true, 
    versionControl: true, attachments: true, history: true, logs: true
  };

  const fields = [
    { key: 'view', label: 'مشاهده / View' },
    { key: 'create', label: 'ایجاد / Create' },
    { key: 'edit', label: 'ویرایش / Edit' },
    { key: 'delete', label: 'حذف / Delete' },
    { key: 'approve', label: 'تأیید / Approve' },
    { key: 'reject', label: 'رد / Reject' },
    { key: 'versionControl', label: 'نسخه‌گذاری / VC' }
  ];

  return (
    <div className="border-l border-zinc-800/60 pl-3 py-1.5 text-right font-sans" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-black/10 hover:bg-black/25 p-2 rounded-xl transition-all border border-zinc-900/40">
        <div 
          className="flex items-center gap-2 cursor-pointer select-none flex-1" 
          onClick={() => setIsOpen(!isOpen)}
        >
          {clause.subClauses && clause.subClauses.length > 0 ? (
            <span className="text-amber-500 font-bold text-[10px] w-4 text-center">{isOpen ? '▼' : '►'}</span>
          ) : (
            <span className="w-4" />
          )}
          <span className="text-xs font-black text-amber-400 font-mono bg-amber-500/5 px-1.5 py-0.5 rounded border border-amber-500/10">{clause.number}</span>
          <span className="text-xs font-bold text-zinc-300 truncate max-w-[200px] sm:max-w-xs">{clause.title}</span>
        </div>
        
        {/* Short toggle summary when collapsed */}
        {!isOpen && (
          <span className="text-[9px] text-zinc-600 font-mono hidden sm:inline bg-zinc-900/40 px-1.5 py-0.5 rounded border border-zinc-850">
            {Object.values(perm).filter(Boolean).length} / 13 allowed
          </span>
        )}
      </div>

      {/* Expanded Actions Grid */}
      {isOpen && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 bg-[#0d0d0f] border border-zinc-900 p-3 mt-1.5 rounded-xl text-[9px] text-zinc-400">
          {fields.map(f => (
            <label key={f.key} className="flex items-center gap-1.5 cursor-pointer hover:text-white select-none py-0.5">
              <input 
                type="checkbox" 
                checked={perm[f.key] !== false} 
                onChange={(e) => onToggle(clause.id, f.key, e.target.checked)} 
                className="rounded border-[#2c2c31] text-amber-500 focus:ring-0 cursor-pointer w-3 h-3"
              />
              <span>{isRtl ? f.label.split('/')[0].trim() : f.label.split('/')[1].trim()}</span>
            </label>
          ))}
        </div>
      )}
      
      {/* Recursion for Sub-clauses */}
      {clause.subClauses && clause.subClauses.length > 0 && isOpen && (
        <div className="border-r border-zinc-900 mr-2 pr-2.5 mt-1.5 space-y-1.5">
          {clause.subClauses.map(sub => (
            <ClausePermissionNode 
              key={sub.id} 
              clause={sub} 
              rolePermissions={rolePermissions} 
              onToggle={onToggle}
              isRtl={isRtl}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- PROJECT TREE STRUCTURE PERMISSIONS TYPES & DATA ---
export interface ProjectTreeNode {
  id: string;
  label: string;
  labelEn: string;
  children?: ProjectTreeNode[];
}

export const PROJECT_TREE_DATA: ProjectTreeNode[] = [
  {
    id: 'view_home',
    label: '۱. داشبورد و میز کار اصلی سازمان',
    labelEn: '1. Executive Workspace & QMS Dashboard',
    children: [
      { id: 'home_qms_deck', label: 'پایش لحظه‌ای و مقایسه چندبعدی شاخص‌های قطعات', labelEn: 'Real-time Quality Compliance Comparison Deck' },
      { id: 'home_supply_chain', label: 'تحلیل تلفیقی زنجیره تامین خودرو', labelEn: 'Supply Chain QMS Realtime Analytics' },
      { id: 'home_standards_ratio', label: 'میزان پیشرفت و انطباق عمومی مستندات IATF', labelEn: 'General Progress & Standard IATF Compliance' },
      { id: 'home_shopfloor_kpis', label: 'شاخص‌های پیشرفته تولید (PPM و Cpk)', labelEn: 'Advanced Shopfloor KPIs (PPM & Cpk)' },
      { id: 'home_audits_csr', label: 'ممیزی‌ها، الزامات تکوین و وضعیت APQP', labelEn: 'Audits, CSR Compliance & APQP Phase' }
    ]
  },
  {
    id: 'view_iatf',
    label: '۲. کاوشگر بندهای استاندارد IATF 16949 / ISO 9001',
    labelEn: '2. Standard Clauses Explorer (IATF 16949 / ISO 9001)',
    children: [
      { id: 'iatf_clause_4', label: 'بند ۴ - بافت سازمان (Context of Organization)', labelEn: 'Clause 4 - Context of Organization' },
      { id: 'iatf_clause_5', label: 'بند ۵ - رهبری و مشارکت (Leadership)', labelEn: 'Clause 5 - Leadership' },
      { id: 'iatf_clause_6', label: 'بند ۶ - طرح‌ریزی سیستم مدیریت کیفیت (Planning)', labelEn: 'Clause 6 - Planning' },
      { id: 'iatf_clause_7', label: 'بند ۷ - پشتیبانی و منابع (Support)', labelEn: 'Clause 7 - Support' },
      {
        id: 'iatf_clause_8',
        label: 'بند ۸ - طرح‌ریزی و کنترل عملیاتی (Operation)',
        labelEn: 'Clause 8 - Operation',
        children: [
          { id: 'iatf_clause_8_1', label: '۸.۱ طرح‌ریزی و کنترل عملیاتی', labelEn: '8.1 Operational planning and control' },
          { id: 'iatf_clause_8_2', label: '۸.۲ الزامات محصولات و خدمات', labelEn: '8.2 Requirements for products and services' },
          { id: 'iatf_clause_8_3', label: '۸.۳ طراحی و توسعه محصولات و خدمات (APQP)', labelEn: '8.3 Design and development of products and services' },
          { id: 'iatf_clause_8_4', label: '۸.۴ کنترل محصولات تأمین شده بیرونی (زنجیره تأمین)', labelEn: '8.4 Control of externally provided products and services' },
          { id: 'iatf_clause_8_5', label: '۸.۵ تولید و ارائه خدمات (Shopfloor Production)', labelEn: '8.5 Production and service provision' },
          { id: 'iatf_clause_8_6', label: '۸.۶ ترخیص محصولات و خدمات (Release)', labelEn: '8.6 Release of products and services' },
          { id: 'iatf_clause_8_7', label: '۸.۷ کنترل خروجی‌های نامنطبق (Nonconforming Outputs)', labelEn: '8.7 Control of nonconforming outputs' }
        ]
      },
      { id: 'iatf_clause_9', label: 'بند ۹ - ارزیابی عملکرد (Performance Evaluation)', labelEn: 'Clause 9 - Performance Evaluation' },
      { id: 'iatf_clause_10', label: 'بند ۱۰ - بهبود مستمر و اقدامات اصلاحی (Improvement)', labelEn: 'Clause 10 - Improvement' }
    ]
  },
  {
    id: 'view_corrective_action',
    label: '۳. کارتابل تخصصی اقدامات اصلاحی (8D / RCA Corrective Action)',
    labelEn: '3. Corrective Action & 8D Incident Control Portal',
    children: [
      { id: 'ca_d1_team', label: 'گام D1 - تشکیل تیم چندتخصصی CFT حل مسئله', labelEn: 'Phase D1 - Cross-Functional Team Formation' },
      { id: 'ca_d2_problem', label: 'گام D2 - تعریف دقیق و تشریح عیوب و انحرافات', labelEn: 'Phase D2 - Problem Detailed Description' },
      { id: 'ca_d3_containment', label: 'گام D3 - اقدامات مهار، قرنطینه و تفکیک فوری', labelEn: 'Phase D3 - Interim Containment & Isolation' },
      { id: 'ca_d4_rca', label: 'گام D4 - تحلیل ریشه‌ای خطا (RCA - Ishikawa / 5Why)', labelEn: 'Phase D4 - Root Cause Analysis (5-Why & Fishbone)' },
      { id: 'ca_d5_pca', label: 'گام D5 - تعیین و تصویب اقدامات اصلاحی دائم (PCA)', labelEn: 'Phase D5 - Permanent Corrective Actions' },
      { id: 'ca_d6_validation', label: 'گام D6 - اجرای عملیاتی و اعتبارسنجی اثربخشی', labelEn: 'Phase D6 - Verification & Validation of PCA' },
      { id: 'ca_d7_prevention', label: 'گام D7 - پیشگیری سیستماتیک تکرار خطا (PFMEA / WI)', labelEn: 'Phase D7 - Prevent Recurrence (FMEA / Control Plan Update)' },
      { id: 'ca_d8_closure', label: 'گام D8 - تقدیر رسمی تیمی و بستن نهایی پرونده', labelEn: 'Phase D8 - Team Recognition & Closure Approval' }
    ]
  },
  {
    id: 'view_indicators',
    label: '۴. پایش هوشمند شاخص‌های عملکردی کیفیت (KPI Indicators)',
    labelEn: '4. SMART Performance Indicators & Automotive KPIs',
    children: [
      { id: 'kpi_ppm_chart', label: 'نمودار ترند و سطح ضایعات برگشتی (PPM)', labelEn: 'Defect Rate Trend Chart (PPM)' },
      { id: 'kpi_cpk_chart', label: 'نمایشگر زنده توانمندی فرآیند تولید (Cpk)', labelEn: 'Process Capability Gauge (Cpk)' },
      { id: 'kpi_capa_speed', label: 'سرعت حل و فصل و بستن اقدامات اصلاحی (CAPA Speed)', labelEn: 'Average CAPA Closure Speed' },
      { id: 'kpi_csr_gauge', label: 'درصد انطباق با الزامات خاص مشتریان (CSR)', labelEn: 'Customer Specific Requirements Compliance' },
      { id: 'kpi_audits_summary', label: 'ممیزی‌های فعال داخلی و خارجی و عدم انطباق‌ها', labelEn: 'Internal / External Audit Non-Conformances' }
    ]
  },
  {
    id: 'view_iso9001_docs',
    label: '۵. سامانه مدیریت و کنترل مستندات (ISO 9001 & CSR Library)',
    labelEn: '5. ISO 9001 Document Control & CSR Library',
    children: [
      { id: 'doc_sop', label: 'دستورالعمل‌های استاندارد کارگاهی (SOP / Work Instructions)', labelEn: 'Standard Operating Procedures & WIs' },
      { id: 'doc_fmea', label: 'مستندات تجزیه و تحلیل حالات خرابی فرآیند (PFMEA)', labelEn: 'Process FMEA Documents' },
      { id: 'doc_control_plan', label: 'طرح‌های کنترل خطوط تولید (Control Plans)', labelEn: 'Process Control Plans' },
      { id: 'doc_ppap', label: 'پرونده‌های تأیید قطعات تکوین نهایی (PPAP Dossier)', labelEn: 'PPAP Approved Dossiers' }
    ]
  },
  {
    id: 'view_assistant',
    label: '۶. دستیار هوشمند ممیزی و مشاور ارشد IATF (AI Auditor)',
    labelEn: '6. AI Auditor Assistant & Gemini QMS Advisor',
    children: [
      { id: 'ai_production_audit', label: 'عارضه‌یابی و ممیزی هوشمند خطوط تولید', labelEn: 'AI Shopfloor Troubleshooting & Audit' },
      { id: 'ai_8d_scenarios', label: 'تولید اتوماتیک سناریوی حل مسئله ۸D و RCA', labelEn: 'AI 8D/RCA Problem Solving Generator' },
      { id: 'ai_clause_compliance', label: 'تحلیل انطباق سازمان با بندهای استاندارد IATF', labelEn: 'AI Clause Compliance Analysis' }
    ]
  },
  {
    id: 'view_db_explorer',
    label: '۷. مرکز مدیریت پایگاه داده‌های رابطه‌ای (QMS-DB Explorer)',
    labelEn: '7. Relational QMS-DB Explorer & SQL Terminal',
    children: [
      { id: 'db_tbl_users', label: 'جدول و کاتالوگ کاربران و دسترسی‌ها (USERS)', labelEn: 'Database Users Catalog Table' },
      { id: 'db_tbl_documents', label: 'جدول اسناد، مستندات و گواهی‌نامه‌ها (DOCUMENTS)', labelEn: 'QMS Documents Ledger Table' },
      { id: 'db_tbl_tasks', label: 'جدول اقدامات، پروژه‌ها و کارها (TASKS)', labelEn: 'Corrective Action Tasks Table' },
      { id: 'db_tbl_security_logs', label: 'جدول تاریخچه لاگ‌ها و رخدادهای امنیتی (SECURITY_LOGS)', labelEn: 'Security Audit & Operation Logs Table' }
    ]
  },
  {
    id: 'view_records',
    label: '۸. سامانه جامع بایگانی سوابق (QC Records Snapshots Ledger)',
    labelEn: '8. Records & Compliance Snapshots Ledger Archive',
    children: [
      { id: 'rec_nc_archive', label: 'بایگانی عدم انطباق‌های ممیزی برطرف شده', labelEn: 'Closed Non-Conformance Audit Cases Archive' },
      { id: 'rec_change_history', label: 'بایگانی تاریخچه تغییرات و ممیزی فرآیندها', labelEn: 'Process Audits & Change History' }
    ]
  }
];

interface ProjectPermissionNodeProps {
  key?: string | number;
  node: ProjectTreeNode;
  projectPermissions: Record<string, boolean>;
  onToggle: (nodeId: string, checked: boolean) => void;
  isRtl: boolean;
}

function ProjectPermissionNode({
  node,
  projectPermissions,
  onToggle,
  isRtl
}: ProjectPermissionNodeProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(true);
  const isChecked = projectPermissions[node.id] !== false;

  return (
    <div className={`py-1.5 font-sans ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between gap-3 bg-zinc-950/40 hover:bg-[#1A1A1E] p-2.5 rounded-xl transition-all border border-zinc-900/50">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {node.children && node.children.length > 0 ? (
            <button 
              type="button"
              className="text-amber-500 font-extrabold text-[11px] w-4 text-center cursor-pointer hover:text-amber-400 select-none flex items-center justify-center"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? '▼' : '►'}
            </button>
          ) : (
            <span className="w-4" />
          )}
          
          <label className="flex items-center gap-2 cursor-pointer select-none min-w-0 flex-1">
            <input 
              type="checkbox" 
              checked={isChecked} 
              onChange={(e) => onToggle(node.id, e.target.checked)} 
              className="rounded border-[#2d2d35] text-amber-500 focus:ring-0 cursor-pointer w-4 h-4 shrink-0"
            />
            <span className="text-xs font-black text-zinc-100 truncate">
              {isRtl ? node.label : node.labelEn}
            </span>
          </label>
        </div>
        
        {node.children && node.children.length > 0 && (
          <span className="text-[8px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-md font-mono font-bold hidden sm:inline border border-amber-500/10">
            {node.children.length} {isRtl ? 'بخش جزئی' : 'sub-items'}
          </span>
        )}
      </div>

      {/* Recursion for Child nodes */}
      {node.children && node.children.length > 0 && isOpen && (
        <div className={`mt-1.5 space-y-1.5 border-zinc-800 ${isRtl ? 'border-r pr-3.5 mr-2' : 'border-l pl-3.5 ml-2'}`}>
          {node.children.map(child => (
            <ProjectPermissionNode 
              key={child.id} 
              node={child} 
              projectPermissions={projectPermissions} 
              onToggle={onToggle}
              isRtl={isRtl}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeamManagement({
  lang,
  currentUser,
  users,
  tasks,
  proposals,
  onLogin,
  onLogout,
  onAddUser,
  onDeleteUser,
  onUpdatePermissions,
  onUpdateUser,
  onAddTask,
  onUpdateTaskStatus,
  onApproveProposal,
  onRejectProposal,
  products = []
}: TeamManagementProps) {

  const isRtl = lang === 'fa';

  // --- Dynamic Roles CRUD state ---
  const [roles, setRoles] = useState<Role[]>(() => {
    try {
      const saved = localStorage.getItem('qms_enterprise_roles');
      if (saved) return JSON.parse(saved);
    } catch {}
    // Seed default Roles if empty
    return [
      {
        id: 'role-superadmin',
        name: 'Super Admin',
        nameFa: 'مدیر ارشد سیستم',
        isEnabled: true,
        isSystem: true,
        companyId: 'company-primary',
        permissions: {
          home: true, iatf: true, iatf_tools: true, csr: true, indicators: true,
          strategic_management: true, iso9001_docs: true, db_explorer: true, records: true,
          clauses: {}
        }
      },
      {
        id: 'role-qmsmanager',
        name: 'QMS Manager',
        nameFa: 'مدیر تضمین کیفیت / مهندسی',
        isEnabled: true,
        isSystem: false,
        companyId: 'company-primary',
        permissions: {
          home: true, iatf: true, iatf_tools: true, csr: true, indicators: true,
          strategic_management: true, iso9001_docs: true, db_explorer: false, records: true,
          clauses: {}
        }
      },
      {
        id: 'role-processowner',
        name: 'Process Owner',
        nameFa: 'مالک فرآیند (Process Owner)',
        isEnabled: true,
        isSystem: false,
        companyId: 'company-primary',
        permissions: {
          home: true, iatf: true, iatf_tools: true, csr: false, indicators: true,
          strategic_management: false, iso9001_docs: true, db_explorer: false, records: true,
          clauses: {}
        }
      }
    ];
  });

  // --- Organizational Units (Hierarchy) state ---
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>(() => {
    try {
      const saved = localStorage.getItem('qms_enterprise_org_units');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 'org-root', type: 'company', name: 'Primary Company', nameFa: 'هلدینگ مرکزی قطعات خودرو', companyId: 'company-primary' },
      { id: 'org-site-tehran', type: 'site', name: 'Tehran Plant', nameFa: 'سایت تولیدی تهران', parentId: 'org-root', companyId: 'company-primary' },
      { id: 'org-dept-qa', type: 'department', name: 'Quality Assurance', nameFa: 'واحد تضمین کیفیت', parentId: 'org-site-tehran', companyId: 'company-primary' },
      { id: 'org-dept-prod', type: 'department', name: 'Production Dept', nameFa: 'واحد تولید و مهندسی', parentId: 'org-site-tehran', companyId: 'company-primary' }
    ];
  });

  // --- Process Owners mapping state ---
  const [processOwners, setProcessOwners] = useState<ProcessOwner[]>(() => {
    try {
      const saved = localStorage.getItem('qms_enterprise_process_owners');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // --- Workflows Engine configuration state ---
  const [workflows, setWorkflows] = useState<Workflow[]>(() => {
    try {
      const saved = localStorage.getItem('qms_enterprise_workflows');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // --- Active sessions state ---
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>(() => {
    try {
      const saved = localStorage.getItem('qms_enterprise_sessions');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('qms_enterprise_roles', JSON.stringify(roles));
  }, [roles]);

  useEffect(() => {
    localStorage.setItem('qms_enterprise_org_units', JSON.stringify(orgUnits));
  }, [orgUnits]);

  useEffect(() => {
    localStorage.setItem('qms_enterprise_process_owners', JSON.stringify(processOwners));
  }, [processOwners]);

  useEffect(() => {
    localStorage.setItem('qms_enterprise_workflows', JSON.stringify(workflows));
    syncConfiguredWorkflowsToCartable(workflows, roles);
    loadWorkflowCartableTasks();
  }, [workflows, roles]);

  useEffect(() => {
    localStorage.setItem('qms_enterprise_sessions', JSON.stringify(activeSessions));
  }, [activeSessions]);

  // --- Sub-Tab Navigation ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cartable' | 'admin_users' | 'admin_roles' | 'org_units' | 'process_owners' | 'workflows' | 'audit_logs' | 'profile'>(
    currentUser?.role === 'admin' ? 'dashboard' : 'cartable'
  );

  // Enforce strict RBAC: non-admin users can ONLY access 'cartable' and 'profile'
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin' && activeTab !== 'cartable' && activeTab !== 'profile') {
      setActiveTab('cartable');
    }
  }, [currentUser, activeTab]);

  // Document Inspection Preview Modal State
  const [selectedDocPreview, setSelectedDocPreview] = useState<{
    docId: string;
    docTitle?: string;
    docType?: string;
    clauseId?: string;
    task?: WorkflowCartableTask;
  } | null>(null);

  // Rejection Dialog State
  const [rejectingTask, setRejectingTask] = useState<WorkflowCartableTask | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('عدم انطباق با الزامات استاندارد');
  const [rejectionTagInput, setRejectionTagInput] = useState('عدم پذیرش و عودت به گام قبل');

  // Comment Modal State
  const [commentingTask, setCommentingTask] = useState<WorkflowCartableTask | null>(null);
  const [newCommentInput, setNewCommentInput] = useState('');
  const [newCommentTagInput, setNewCommentTagInput] = useState('یادداشت ممیزی');

  // Admin View Mode inside Cartable (My Tasks vs All Org Tasks Oversight)
  const [cartableAdminScope, setCartableAdminScope] = useState<'my_actions' | 'all_org_oversight'>('my_actions');
  const [cartableStatusFilter, setCartableStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Immutable Audit Logs local load
  const [auditLogs, setAuditLogs] = useState<ImmutableAuditLog[]>([]);
  const loadAuditLogs = () => {
    try {
      const raw = localStorage.getItem('qms_user_audit_log') || '[]';
      setAuditLogs(JSON.parse(raw));
    } catch {}
  };

  // Workflow Cartable Tasks State & Reactive Real-time Sync
  const [rawWorkflowTasks, setRawWorkflowTasks] = useState<WorkflowCartableTask[]>(() => 
    seedInitialWorkflowCartableTasks(roles)
  );

  const loadWorkflowCartableTasks = () => {
    try {
      const tasks = getStoredWorkflowCartableTasks();
      setRawWorkflowTasks(tasks);
    } catch (e) {
      console.error('Error loading workflow cartable tasks:', e);
    }
  };

  useEffect(() => {
    loadAuditLogs();
    loadWorkflowCartableTasks();
    window.addEventListener('qms-audit-log-updated', loadAuditLogs);
    window.addEventListener('qms-workflow-sync', loadWorkflowCartableTasks);
    window.addEventListener('storage', loadWorkflowCartableTasks);
    return () => {
      window.removeEventListener('qms-audit-log-updated', loadAuditLogs);
      window.removeEventListener('qms-workflow-sync', loadWorkflowCartableTasks);
      window.removeEventListener('storage', loadWorkflowCartableTasks);
    };
  }, []);

  // Custom confirmation dialog state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    confirmClass?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // --- Add Role Form State ---
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleNameFa, setNewRoleNameFa] = useState('');
  const [selectedRoleToEdit, setSelectedRoleToEdit] = useState<Role | null>(null);
  const [editingRolePermissions, setEditingRolePermissions] = useState<Role['permissions'] | null>(null);
  const [permsViewMode, setPermsViewMode] = useState<'standard' | 'project'>('standard');
  const [rolesSubTab, setRolesSubTab] = useState<'roles' | 'products'>('roles');

  // --- Add User State ---
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newUserRoleIds, setNewUserRoleIds] = useState<string[]>(['role-processowner']);
  const [newUserCompany, setNewUserCompany] = useState('هلدینگ مرکزی قطعات خودرو');
  const [newUserDept, setNewUserDept] = useState('org-dept-qa');
  const [newUserPosition, setNewUserPosition] = useState('کارشناس مهندسی کیفیت');
  const [newAllowedProductIds, setNewAllowedProductIds] = useState<string[]>([]);
  const [selectedUserToEdit, setSelectedUserToEdit] = useState<User | null>(null);
  const [editingUserProductsId, setEditingUserProductsId] = useState<string | null>(null);
  const [editingUserProductsList, setEditingUserProductsList] = useState<string[]>([]);

  // --- Profile Edit Form States ---
  const [profileFullName, setProfileFullName] = useState(currentUser?.fullName || '');
  const [profileUsername, setProfileUsername] = useState(currentUser?.username || '');
  const [profileJobPosition, setProfileJobPosition] = useState(currentUser?.jobPosition || '');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');

  useEffect(() => {
    if (currentUser) {
      setProfileFullName(currentUser.fullName);
      setProfileUsername(currentUser.username);
      setProfileJobPosition(currentUser.jobPosition || '');
    }
  }, [currentUser]);

  // Digital Signature Canvas Refs
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);
  const [savedSignatureData, setSavedSignatureData] = useState<string>('');

  // Precise coordinate scaling helper for CSS scaled canvas
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    return { x, y };
  };

  const getCanvasTouchCoordinates = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas || e.touches.length === 0) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    return { x, y };
  };

  // Draw Signature Helpers
  const startDrawingSignature = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    const coords = getCanvasCoordinates(e);
    ctx.moveTo(coords.x, coords.y);
    setIsDrawingSignature(true);
  };

  const drawSignature = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingSignature) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const coords = getCanvasCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#f59e0b'; // amber color signature vector
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const startDrawingSignatureTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    const coords = getCanvasTouchCoordinates(e);
    ctx.moveTo(coords.x, coords.y);
    setIsDrawingSignature(true);
  };

  const drawSignatureTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawingSignature) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const coords = getCanvasTouchCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const clearSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSavedSignatureData('');
  };

  const saveSignatureData = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const base64Url = canvas.toDataURL('image/png');
    setSavedSignatureData(base64Url);
    alert(isRtl ? 'امضای دیجیتال برای این کاربر با موفقیت ثبت شد.' : 'Digital signature captured successfully.');
  };

  // Handle direct file upload for PNG signature
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert(isRtl ? 'لطفاً فقط فایل تصویر معتبر انتخاب کنید.' : 'Please select a valid image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target?.result as string;
      setSavedSignatureData(base64Url);
      if (currentUser) {
        const updatedUser = { ...currentUser, digitalSignature: base64Url };
        if (onUpdateUser) {
          onUpdateUser(updatedUser);
        }
      }
      alert(isRtl ? 'فایل امضاء با موفقیت بارگذاری و اعمال شد.' : 'Signature file uploaded and applied successfully.');
    };
    reader.readAsDataURL(file);
  };

  // --- Handlers ---
  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName || !newRoleNameFa) return;

    const newRole: Role = {
      id: 'role-' + Date.now(),
      name: newRoleName.trim(),
      nameFa: newRoleNameFa.trim(),
      isEnabled: true,
      companyId: 'company-primary',
      permissions: {
        home: true, iatf: true, iatf_tools: true, csr: false, indicators: true,
        strategic_management: false, iso9001_docs: true, db_explorer: false, records: true,
        clauses: {}
      }
    };

    setRoles(prev => [...prev, newRole]);
    logSystemActivity(
      currentUser?.username || 'sysadmin',
      currentUser?.fullName || 'مدیر سیستم',
      'CREATE_ROLE',
      'تعریف نقش جدید سازمانی',
      `ایجاد نقش "${newRoleNameFa}" در سیستم کنترل دسترسی`,
      'security',
      newRole.id,
      {},
      newRole
    );

    setNewRoleName('');
    setNewRoleNameFa('');
  };

  const handleDeleteRole = (id: string, nameFa: string) => {
    const found = roles.find(r => r.id === id);
    if (found?.isSystem) {
      alert(isRtl ? 'حذف نقش‌های سیستمی امکان‌پذیر نیست.' : 'System roles cannot be deleted.');
      return;
    }

    const confirmMsg = isRtl 
      ? `آیا از حذف نقش "${nameFa}" اطمینان دارید؟ کاربران با این نقش ممکن است دسترسی خود را از دست بدهند.` 
      : `Are you sure you want to delete role "${nameFa}"? Users with this role may lose access.`;
    
    setConfirmModal({
      isOpen: true,
      title: isRtl ? '⚠️ حذف نقش سازمانی' : '⚠️ Delete Role',
      message: confirmMsg,
      confirmLabel: isRtl ? 'بله، حذف شود' : 'Delete',
      confirmClass: 'bg-red-500 hover:bg-red-650',
      onConfirm: () => {
        setRoles(prev => prev.filter(r => r.id !== id));
        logSystemActivity(
          currentUser?.username || 'sysadmin',
          currentUser?.fullName || 'مدیر سیستم',
          'DELETE_ROLE',
          'حذف نقش سازمانی',
          `حذف نقش "${nameFa}" از لیست مجوزهای دسترسی`,
          'security',
          id,
          found,
          {}
        );
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleCopyRole = (role: Role) => {
    const cloned: Role = {
      ...role,
      id: 'role-copy-' + Date.now(),
      name: `${role.name} (Copy)`,
      nameFa: `${role.nameFa} (کپی)`,
      isSystem: false
    };
    setRoles(prev => [...prev, cloned]);
    logSystemActivity(
      currentUser?.username || 'sysadmin',
      currentUser?.fullName || 'مدیر سیستم',
      'CLONE_ROLE',
      'تکثیر و کپی کردن نقش دسترسی',
      `تکثیر نقش "${role.nameFa}" به نقش جدید با سطح دسترسی کپی شده`,
      'security',
      cloned.id,
      role,
      cloned
    );
  };

  const handleSaveRolePermissions = () => {
    if (!selectedRoleToEdit || !editingRolePermissions) return;
    setRoles(prev => prev.map(r => r.id === selectedRoleToEdit.id ? { ...r, permissions: editingRolePermissions } : r));
    logSystemActivity(
      currentUser?.username || 'sysadmin',
      currentUser?.fullName || 'مدیر سیستم',
      'UPDATE_ROLE_PERMS',
      'ویرایش مجوزهای نقش سازمانی',
      `به‌روزرسانی ساختار درختی بندها و صفحات مجاز برای نقش "${selectedRoleToEdit.nameFa}"`,
      'security',
      selectedRoleToEdit.id,
      selectedRoleToEdit.permissions,
      editingRolePermissions
    );
    setSelectedRoleToEdit(null);
    setEditingRolePermissions(null);
  };

  const handleToggleClausePermission = (clauseId: string, field: string, checked: boolean) => {
    if (!editingRolePermissions) return;
    const currentClauses = editingRolePermissions.clauses || {};
    const updated = {
      ...currentClauses,
      [clauseId]: {
        ...(currentClauses[clauseId] || {
          view: true, create: true, edit: true, delete: true, print: true, 
          export: true, import: true, approve: true, reject: true, 
          versionControl: true, attachments: true, history: true, logs: true
        }),
        [field]: checked
      }
    };
    setEditingRolePermissions({
      ...editingRolePermissions,
      clauses: updated
    });
  };

  const handleToggleProjectPermission = (nodeId: string, checked: boolean) => {
    if (!editingRolePermissions) return;
    const currentProjectTree = editingRolePermissions.projectTree || {};
    
    const updatedProjectTree = {
      ...currentProjectTree,
      [nodeId]: checked
    };

    const findAndToggleChildren = (nodes: ProjectTreeNode[]): boolean => {
      for (const node of nodes) {
        if (node.id === nodeId) {
          const toggleAllDescendants = (n: ProjectTreeNode) => {
            if (n.children) {
              n.children.forEach(c => {
                updatedProjectTree[c.id] = checked;
                toggleAllDescendants(c);
              });
            }
          };
          toggleAllDescendants(node);
          return true;
        }
        if (node.children) {
          const found = findAndToggleChildren(node.children);
          if (found) return true;
        }
      }
      return false;
    };
    findAndToggleChildren(PROJECT_TREE_DATA);

    setEditingRolePermissions({
      ...editingRolePermissions,
      projectTree: updatedProjectTree
    });
  };

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newFullName) return;

    if (users.some(u => u.username.toLowerCase() === newUsername.toLowerCase())) {
      alert(isRtl ? 'این نام کاربری از قبل در دیتابیس وجود دارد.' : 'This username already exists.');
      return;
    }

    onAddUser({
      username: newUsername.trim(),
      password: newPassword || '1234',
      fullName: newFullName.trim(),
      role: 'user', // legacy
      roleIds: newUserRoleIds,
      companyId: 'company-primary',
      companyName: newUserCompany,
      departmentIds: [newUserDept],
      jobPosition: newUserPosition,
      isBlocked: false,
      isOnline: false,
      digitalSignature: savedSignatureData || undefined,
      allowedProducts: newAllowedProductIds,
      permissions: {
        home: true, iatf: true, iatf_tools: true, csr: false, indicators: true,
        strategic_management: false, iso9001_docs: true, db_explorer: false, records: true
      }
    });

    logSystemActivity(
      currentUser?.username || 'sysadmin',
      currentUser?.fullName || 'مدیر سیستم',
      'CREATE_USER',
      'ثبت نام پرسنل و کاربر جدید',
      `ثبت کاربر "${newFullName}" با دسترسی‌ها و پست "${newUserPosition}" در دیتابیس هویت`,
      'identity',
      'usr-' + newUsername
    );

    setNewUsername('');
    setNewPassword('');
    setNewFullName('');
    setSavedSignatureData('');
    setNewAllowedProductIds([]);
  };

  const handleDisconnectSession = (sessId: string) => {
    const session = activeSessions.find(s => s.id === sessId);
    setActiveSessions(prev => prev.filter(s => s.id !== sessId));
    if (session) {
      logSystemActivity(
        currentUser?.username || 'sysadmin',
        currentUser?.fullName || 'مدیر سیستم',
        'KILL_SESSION',
        'قطع نشست همزمان کاربر (Kill Session)',
        `خاتمه دادن اجباری به توکن فعال نشست کاربر "${session.fullName}"`,
        'security',
        sessId
      );
    }
  };

  // Login handler
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleFormLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginUsername) return;

    const res = onLogin(loginUsername, loginPassword);
    let success = false;
    let errMessage = '';
    if (typeof res === 'object') {
      success = res.success;
      errMessage = res.error || '';
    } else {
      success = res;
    }

    if (!success) {
      setLoginError(errMessage || (isRtl ? 'نام کاربری یا کلمه عبور وارد شده نامعتبر است.' : 'Invalid credentials.'));
      logSystemActivity(
        loginUsername,
        loginUsername,
        'FAILED_LOGIN',
        'تلاش ناموفق برای ورود به پورتال',
        `تلاش ورود ناموفق با کلمه عبور نادرست`,
        'security'
      );
    } else {
      const u = users.find(user => user.username.toLowerCase() === loginUsername.toLowerCase());
      if (u) {
        logSystemActivity(
          u.username,
          u.fullName,
          'LOGIN',
          'ورود پرسنل به پورتال سیستم کیفیت',
          `ورود موفقیت آمیز پرسنل به سیستم مدیریت کیفیت مبتنی بر IATF 16949`,
          'identity'
        );
      }
      setLoginUsername('');
      setLoginPassword('');
    }
  };

  // Sub tab inside Cartable (Document Workflows vs Personal Tasks)
  const [cartableSubTab, setCartableSubTab] = useState<'workflows' | 'personal'>('workflows');

  // Filter Tasks assigned to Me
  const myTasks = useMemo(() => {
    if (!currentUser) return [];
    return tasks.filter(t => t.assignedTo === currentUser.id);
  }, [tasks, currentUser]);

  // Filter Document Workflow Cartable Tasks assigned to Me / My Role
  const myWorkflowCartableTasks = useMemo(() => {
    return getCartableWorkflowTasksForUser(currentUser, roles);
  }, [currentUser, roles, rawWorkflowTasks]);

  return (
    <div className="space-y-6 max-w-full font-sans" dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* Dynamic Header Block with breadcrumb */}
      <div className="bg-[#121215] border border-[#232326] p-6 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-widest font-black">
            <span>{isRtl ? 'هسته اصلی امنیت و پرسنل' : 'Central Identity & Security Console'}</span>
            <span>/</span>
            <span className="text-amber-500">Enterprise Administration</span>
          </div>
          <h2 className="text-sm md:text-base font-black text-white flex items-center gap-2">
            <ShieldCheck size={18} className="text-amber-500" />
            <span>{isRtl ? 'مدیریت کاربران، نقش‌ها و سطوح دسترسی پیشرفته' : 'Enterprise Access & Identity Controller'}</span>
          </h2>
        </div>

        {currentUser ? (
          <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-2xl">
            <div className="flex flex-col text-right">
              <span className="text-xs font-black text-zinc-200">{currentUser.fullName}</span>
              <span className="text-[9px] font-mono text-amber-500">@{currentUser.username} ({currentUser.jobPosition || 'Staff'})</span>
            </div>
            <button
              onClick={onLogout}
              className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/15 hover:border-rose-500/25 rounded-xl text-[10px] font-black transition-all cursor-pointer"
            >
              {isRtl ? 'خروج پرسنل' : 'Exit Console'}
            </button>
          </div>
        ) : (
          <span className="text-xs text-rose-400 font-bold bg-rose-500/5 px-3.5 py-1.5 rounded-xl border border-rose-500/10 flex items-center gap-1.5">
            <AlertCircle size={14} />
            <span>{isRtl ? 'قفل ایمنی دسترسی - لطفاً ابتدا وارد شوید' : 'Identity Guard Active - Please Log In'}</span>
          </span>
        )}
      </div>

      {currentUser ? (
        <>
          {/* Sub Tab Switchers Bar */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1.5 custom-scrollbar border-b border-[#202023] text-xs">
            
            <button
              onClick={() => setActiveTab('cartable')}
              className={`px-4 py-2 rounded-xl transition-all font-bold shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'cartable' ? 'bg-amber-500 text-black shadow-lg font-extrabold' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Inbox size={13} />
              <span>{isRtl ? 'کارتابل وظایف شما' : 'Your Personal Inbox'}</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 rounded-xl transition-all font-bold shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'profile' ? 'bg-amber-500 text-black shadow-lg font-extrabold' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <UserIcon size={13} />
              <span>{isRtl ? 'پروفایل و تنظیمات کاربری' : 'My Profile & Settings'}</span>
            </button>

            {currentUser.role === 'admin' && (
              <>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-4 py-2 rounded-xl transition-all font-bold shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'dashboard' ? 'bg-amber-500 text-black shadow-lg font-extrabold' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Activity size={13} />
                  <span>{isRtl ? 'داشبورد مانیتورینگ' : 'Live Dashboard'}</span>
                </button>

                <button
                  onClick={() => setActiveTab('admin_users')}
                  className={`px-4 py-2 rounded-xl transition-all font-bold shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'admin_users' ? 'bg-amber-500 text-black shadow-lg font-extrabold' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Users size={13} />
                  <span>{isRtl ? 'مدیریت کل کاربران' : 'All Users Database'}</span>
                </button>

                <button
                  onClick={() => setActiveTab('admin_roles')}
                  className={`px-4 py-2 rounded-xl transition-all font-bold shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'admin_roles' ? 'bg-amber-500 text-black shadow-lg font-extrabold' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Shield size={13} />
                  <span>{isRtl ? 'نقش‌ها و دسترسی‌ها' : 'Roles & Permissions'}</span>
                </button>

                <button
                  onClick={() => setActiveTab('org_units')}
                  className={`px-4 py-2 rounded-xl transition-all font-bold shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'org_units' ? 'bg-amber-500 text-black shadow-lg font-extrabold' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Network size={13} />
                  <span>{isRtl ? 'ساختار سازمانی چارت' : 'Organizational Units'}</span>
                </button>

                <button
                  onClick={() => setActiveTab('process_owners')}
                  className={`px-4 py-2 rounded-xl transition-all font-bold shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'process_owners' ? 'bg-amber-500 text-black shadow-lg font-extrabold' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <UserCheck size={13} />
                  <span>{isRtl ? 'مالکین فرآیندها (۴.۴)' : 'Process Owners Mapping'}</span>
                </button>

                <button
                  onClick={() => setActiveTab('workflows')}
                  className={`px-4 py-2 rounded-xl transition-all font-bold shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'workflows' ? 'bg-amber-500 text-black shadow-lg font-extrabold' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Settings size={13} />
                  <span>{isRtl ? 'گردش کار مدارک' : 'Approval Workflows'}</span>
                </button>

                <button
                  onClick={() => setActiveTab('audit_logs')}
                  className={`px-4 py-2 rounded-xl transition-all font-bold shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'audit_logs' ? 'bg-amber-500 text-black shadow-lg font-extrabold' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <History size={13} />
                  <span>{isRtl ? 'لاگ بازرسی ممیزی' : 'Immutable Audit Trail'}</span>
                </button>
              </>
            )}
          </div>

          {/* ACTIVE TAB VIEWS */}
          <div className="pt-2">
            
            {activeTab === 'dashboard' && (
              <TeamManagementDashboard
                lang={lang}
                currentUser={currentUser}
                users={users}
                roles={roles}
                auditLogs={auditLogs}
                activeSessions={activeSessions}
                onDisconnectSession={handleDisconnectSession}
                isRtl={isRtl}
              />
            )}

            {activeTab === 'cartable' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-150">
                {/* Personal Profile & signature capture panel */}
                <div className="bg-[#121215] border border-[#232326] rounded-2xl p-5 shadow-xl space-y-4">
                  <h3 className="text-xs font-black text-white flex items-center gap-2 border-b border-white/5 pb-3">
                    <span className="text-amber-500">🛡️</span>
                    <span>{isRtl ? 'پیکربندی هویت و امضای پرسنلی' : 'Personal Security & Sign Settings'}</span>
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 bg-black/10 p-3 rounded-xl border border-zinc-900">
                      <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-mono font-black text-xs shrink-0 border border-amber-500/20">
                        {currentUser.username.substr(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-black text-white truncate">{currentUser.fullName}</span>
                        <span className="text-[9px] text-zinc-500 font-mono">@{currentUser.username}</span>
                      </div>
                    </div>

                    {/* Signature pad section */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1">{isRtl ? 'ثبت نمونه امضای دیجیتال برای مصوبات ممیزی' : 'Draw Digital Signature for approvals'}</label>
                      
                      {currentUser.digitalSignature || savedSignatureData ? (
                        <div className="bg-[#141418] border border-emerald-500/20 p-4 rounded-xl flex flex-col items-center justify-center gap-3">
                          <img src={currentUser.digitalSignature || savedSignatureData} alt="signature" className="max-h-16 object-contain filter invert opacity-90" />
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmModal({
                                isOpen: true,
                                title: isRtl ? '✍️ بازنشانی امضا' : '✍️ Reset Signature',
                                message: isRtl ? 'آیا مایل به تعریف مجدد امضا هستید؟' : 'Are you sure you want to clear and redraw your signature?',
                                confirmLabel: isRtl ? 'بله، بازنشانی شود' : 'Reset',
                                confirmClass: 'bg-red-500 hover:bg-red-650',
                                onConfirm: () => {
                                  setSavedSignatureData('');
                                  currentUser.digitalSignature = undefined;
                                  if (onUpdateUser) {
                                    onUpdateUser({ ...currentUser, digitalSignature: undefined });
                                  }
                                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                }
                              });
                            }}
                            className="text-[9px] text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                          >
                            {isRtl ? 'بازنشانی و امضای مجدد' : 'Clear & Redraw'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <canvas
                            ref={signatureCanvasRef}
                            width={280}
                            height={120}
                            onMouseDown={startDrawingSignature}
                            onMouseMove={drawSignature}
                            onMouseUp={() => setIsDrawingSignature(false)}
                            onMouseLeave={() => setIsDrawingSignature(false)}
                            onTouchStart={startDrawingSignatureTouch}
                            onTouchMove={drawSignatureTouch}
                            onTouchEnd={() => setIsDrawingSignature(false)}
                            className="bg-black/30 border border-zinc-850 hover:border-zinc-700 rounded-xl cursor-crosshair w-full block touch-none"
                          />
                          <div className="flex justify-between items-center text-[10px]">
                            <button
                              type="button"
                              onClick={clearSignatureCanvas}
                              className="text-zinc-500 hover:text-white cursor-pointer font-bold"
                            >
                              {isRtl ? 'پاک کردن صفحه' : 'Clear canvas'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const canvas = signatureCanvasRef.current;
                                if (!canvas) return;
                                const base64Url = canvas.toDataURL('image/png');
                                setSavedSignatureData(base64Url);
                                if (onUpdateUser) {
                                  onUpdateUser({ ...currentUser, digitalSignature: base64Url });
                                } else {
                                  currentUser.digitalSignature = base64Url;
                                }
                                alert(isRtl ? 'امضای دیجیتال با موفقیت ثبت شد.' : 'Digital signature captured.');
                              }}
                              className="bg-amber-500 hover:bg-amber-600 text-black px-3.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer"
                            >
                              {isRtl ? 'تأیید و ذخیره امضا' : 'Capture Signature'}
                            </button>
                          </div>
                          <div className="mt-2.5 pt-2.5 border-t border-zinc-900/60 flex flex-col gap-1.5">
                            <span className="text-[9px] text-zinc-500 font-bold">{isRtl ? 'یا بارگذاری تصویر آماده امضا (PNG):' : 'Or upload ready signature image (PNG):'}</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleSignatureUpload} 
                              className="text-[9px] text-zinc-400 file:bg-zinc-800 file:text-zinc-300 file:border-0 file:py-1 file:px-2.5 file:rounded file:mr-2 file:cursor-pointer hover:file:bg-zinc-700 cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Synchronized Document Workflow & Cartable Inbox */}
                <div className="md:col-span-2 space-y-4">
                  <div className="bg-[#121215] border border-[#232326] rounded-2xl p-5 shadow-xl space-y-4">
                    
                    {/* Header & Sub-Tab Switcher for Cartable */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-3.5">
                      <h3 className="text-xs font-black text-white flex items-center gap-2">
                        <Inbox size={15} className="text-amber-500" />
                        <span>{isRtl ? 'کارتابل هوشمند وظایف و گردش کار مدارک' : 'Smart Workflow & Tasks Cartable'}</span>
                      </h3>

                      <div className="flex items-center gap-1.5 bg-[#17171c] p-1 rounded-xl border border-zinc-800 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setCartableSubTab('workflows')}
                          className={`px-3 py-1 rounded-lg font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                            cartableSubTab === 'workflows' 
                              ? 'bg-amber-500 text-black shadow-md' 
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          <Settings size={12} />
                          <span>{isRtl ? 'گردش کار مدارک' : 'Document Workflows'}</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                            cartableSubTab === 'workflows' ? 'bg-black/20 text-black' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {myWorkflowCartableTasks.filter(t => t.status === 'pending').length}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setCartableSubTab('personal')}
                          className={`px-3 py-1 rounded-lg font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                            cartableSubTab === 'personal' 
                              ? 'bg-amber-500 text-black shadow-md' 
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          <Clipboard size={12} />
                          <span>{isRtl ? 'وظایف شخصی' : 'Personal Tasks'}</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                            cartableSubTab === 'personal' ? 'bg-black/20 text-black' : 'bg-zinc-800 text-zinc-300'
                          }`}>
                            {myTasks.filter(t => t.status !== 'done').length}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* CONTENT TAB 1: Document Approval Workflows */}
                    {cartableSubTab === 'workflows' && (
                      <div className="space-y-6">
                        
                        {/* Admin Cartable Scope Toggle Bar (if currentUser is admin) */}
                        {currentUser?.role === 'admin' && (
                          <div className="flex items-center gap-2 bg-[#17171d] p-1.5 rounded-2xl border border-amber-500/20 text-xs">
                            <button
                              type="button"
                              onClick={() => setCartableAdminScope('my_actions')}
                              className={`px-3.5 py-1.5 rounded-xl font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                                cartableAdminScope === 'my_actions'
                                  ? 'bg-amber-500 text-black shadow-md'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              <UserIcon size={13} />
                              <span>{isRtl ? 'وظایف تحت اقدام شما' : 'Your Assigned Action Items'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setCartableAdminScope('all_org_oversight')}
                              className={`px-3.5 py-1.5 rounded-xl font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                                cartableAdminScope === 'all_org_oversight'
                                  ? 'bg-amber-500 text-black shadow-md'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              <Eye size={13} />
                              <span>{isRtl ? 'مانیتورینگ و مدیریت کلیه وظایف سازمان (مخصوص ادمین)' : 'All Org Tasks Oversight'}</span>
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-black/20 text-black font-bold">
                                {rawWorkflowTasks.length}
                              </span>
                            </button>
                          </div>
                        )}

                        {/* ADMIN OVERSIGHT VIEW FOR ALL ORG TASKS */}
                        {currentUser?.role === 'admin' && cartableAdminScope === 'all_org_oversight' ? (
                          <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#15151a] p-3 rounded-2xl border border-zinc-800">
                              <h4 className="text-xs font-black text-amber-400 flex items-center gap-2">
                                <ShieldCheck size={16} />
                                <span>{isRtl ? 'جدول مانیتورینگ کلیه وظایف و گردش‌کارهای سازمان' : 'All Organization Workflow Tasks Oversight'}</span>
                              </h4>

                              {/* Status Filter */}
                              <div className="flex items-center gap-1 text-[10px]">
                                {(['all', 'pending', 'approved', 'rejected'] as const).map(st => (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() => setCartableStatusFilter(st)}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer uppercase ${
                                      cartableStatusFilter === st
                                        ? 'bg-amber-500 text-black font-black'
                                        : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                                    }`}
                                  >
                                    {st === 'all' ? (isRtl ? 'همه' : 'All') : st === 'pending' ? (isRtl ? 'در انتظار' : 'Pending') : st === 'approved' ? (isRtl ? 'تصویب شده' : 'Approved') : (isRtl ? 'رد شده' : 'Rejected')}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* All Tasks Table */}
                            <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-[#141418]">
                              <table className="w-full text-right text-xs">
                                <thead className="bg-[#1c1c22] text-zinc-400 text-[10px] font-extrabold uppercase border-b border-zinc-800">
                                  <tr>
                                    <th className="p-3">عنوان مدرک (کلیک برای مشاهده)</th>
                                    <th className="p-3">نوع مدرک</th>
                                    <th className="p-3">گام</th>
                                    <th className="p-3">نقش مسئول</th>
                                    <th className="p-3">وضعیت</th>
                                    <th className="p-3">عملیات ادمین</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                                  {rawWorkflowTasks
                                    .filter(t => cartableStatusFilter === 'all' || t.status === cartableStatusFilter)
                                    .map(t => (
                                      <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="p-3">
                                          <button
                                            type="button"
                                            onClick={() => setSelectedDocPreview({ docId: t.documentId, docTitle: t.documentTitle, docType: t.documentType, clauseId: t.clauseId, task: t })}
                                            className="font-bold text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer text-right"
                                          >
                                            <ExternalLink size={12} className="shrink-0" />
                                            <span>{t.documentTitle}</span>
                                          </button>
                                        </td>
                                        <td className="p-3 font-mono text-[10px] text-zinc-400">{t.documentType}</td>
                                        <td className="p-3 font-bold text-zinc-200">گام {t.stepNumber} از {t.totalSteps}</td>
                                        <td className="p-3 text-zinc-300">{t.approverRoleNameFa || 'کمیته کیفی'}</td>
                                        <td className="p-3">
                                          <span className={`px-2 py-0.5 rounded text-[9.5px] font-black ${
                                            t.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                            t.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                            'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                                          }`}>
                                            {t.status === 'approved' ? 'تصویب شده' : t.status === 'rejected' ? 'رد شده' : 'در انتظار اقدام'}
                                          </span>
                                        </td>
                                        <td className="p-3">
                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() => setSelectedDocPreview({ docId: t.documentId, docTitle: t.documentTitle, docType: t.documentType, clauseId: t.clauseId, task: t })}
                                              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[10px] cursor-pointer"
                                              title="مشاهده جزئیات کامل"
                                            >
                                              <Eye size={12} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setCommentingTask(t)}
                                              className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-[10px] cursor-pointer"
                                              title="افزودن کامنت ادمین"
                                            >
                                              <MessageSquare size={12} />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          /* STANDARD USER ACTIONABLE CARTABLE TASKS VIEW */
                          <div className="space-y-3">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                              <h4 className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                                <Check size={14} />
                                <span>{isRtl ? 'وظایف در انتظار اقدام شما' : 'My Pending Action Items'}</span>
                              </h4>
                              <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/20 font-bold">
                                {myWorkflowCartableTasks.length} {isRtl ? 'مورد' : 'items'}
                              </span>
                            </div>

                            {myWorkflowCartableTasks.length === 0 ? (
                              <div className="py-8 text-center text-zinc-500 text-xs italic bg-black/20 border border-dashed border-zinc-800 rounded-2xl">
                                {isRtl ? 'هیچ وظیفه‌ای در انتظار تایید نقش شما وجود ندارد.' : 'No pending approvals assigned to your role.'}
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {myWorkflowCartableTasks.map(task => (
                                  <div key={task.id} className="bg-[#18181c] border border-amber-500/30 hover:border-amber-500/60 rounded-2xl p-4 shadow-lg space-y-3">
                                    {/* Header */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 font-extrabold text-[9.5px] rounded-lg border border-amber-500/20">
                                          {task.documentType}
                                        </span>
                                        {task.clauseId && (
                                          <span className="px-2 py-0.5 bg-zinc-900 text-zinc-400 font-mono text-[9px] rounded-lg border border-zinc-800">
                                            IATF {task.clauseId}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[9px] font-mono text-zinc-500">ID: {task.documentId}</span>
                                    </div>

                                    {/* Title Clickable Link & Step info */}
                                    <div>
                                      <button
                                        type="button"
                                        onClick={() => setSelectedDocPreview({ docId: task.documentId, docTitle: task.documentTitle, docType: task.documentType, clauseId: task.clauseId, task })}
                                        className="text-xs font-black text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1.5 leading-snug mb-1 text-right cursor-pointer"
                                      >
                                        <ExternalLink size={13} className="shrink-0" />
                                        <span>{task.documentTitle}</span>
                                      </button>
                                      
                                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-400 pt-1">
                                        <span className="flex items-center gap-1 font-bold text-amber-400">
                                          <span>📌 {isRtl ? `گام ${task.stepNumber} از ${task.totalSteps}:` : `Step ${task.stepNumber}/${task.totalSteps}:`}</span>
                                          <span className="text-white">{task.stepNameFa || task.stepName}</span>
                                        </span>
                                        <span className="text-zinc-500">•</span>
                                        <span className="text-zinc-400">
                                          {isRtl ? 'نقش مسئول:' : 'Role:'} <strong className="text-zinc-200">{task.approverRoleNameFa || 'کمیته کیفی'}</strong>
                                        </span>
                                      </div>
                                    </div>

                                    {/* Comments & Tags preview on task card */}
                                    {(task.comments && task.comments.length > 0) || (task.tags && task.tags.length > 0) ? (
                                      <div className="bg-[#121216] p-2.5 rounded-xl border border-zinc-800/80 space-y-2 text-[10px]">
                                        {task.tags && task.tags.length > 0 && (
                                          <div className="flex flex-wrap items-center gap-1">
                                            <Tag size={10} className="text-amber-500 shrink-0" />
                                            {task.tags.map((tag, idx) => (
                                              <span key={idx} className="bg-amber-500/10 text-amber-400 px-1.5 py-0.2 rounded font-mono text-[8.5px] border border-amber-500/20">
                                                #{tag}
                                              </span>
                                            ))}
                                          </div>
                                        )}

                                        {task.comments && task.comments.length > 0 && (
                                          <div className="space-y-1">
                                            <span className="text-zinc-500 text-[9px] block font-bold flex items-center gap-1">
                                              <MessageSquare size={10} className="text-amber-500" />
                                              <span>آخرین نظرات و یادداشت‌ها:</span>
                                            </span>
                                            {task.comments.slice(-2).map(c => (
                                              <div key={c.id} className="text-zinc-300 bg-zinc-900/60 p-1.5 rounded border border-zinc-800 text-[9.5px]">
                                                <strong className="text-amber-400">{c.userName}: </strong>
                                                <span>{c.comment}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ) : null}

                                    {/* Action buttons */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-[9.5px]">
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center gap-1 text-amber-400 font-extrabold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                                          <RefreshCw size={10} className="animate-spin" />
                                          <span>{isRtl ? 'منتظر تایید و امضای شما' : 'Pending Your Approval'}</span>
                                        </span>
                                        {currentUser.digitalSignature ? (
                                          <span className="text-emerald-400 font-bold bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 text-[9px]">
                                            {isRtl ? '✍️ امضای دیجیتال پرسنلی آماده' : '✍️ Signature Ready'}
                                          </span>
                                        ) : (
                                          <span className="text-amber-400 font-bold bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10 text-[9px]">
                                            {isRtl ? '⚠️ فاقد امضای دیجیتال ثبت‌شده' : '⚠️ No Signature Saved'}
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setCommentingTask(task)}
                                          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                        >
                                          <MessageSquare size={11} />
                                          <span>{isRtl ? 'کامنت / تگ' : 'Comment'}</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            setRejectionReasonInput('عدم انطباق با الزامات استاندارد');
                                            setRejectingTask(task);
                                          }}
                                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center gap-1"
                                        >
                                          <RotateCcw size={11} />
                                          <span>{isRtl ? 'رد و عودت' : 'Reject & Revert'}</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            const res = approveWorkflowCartableTask(
                                              task.id, 
                                              currentUser, 
                                              'تایید شده با امضای دیجیتال پرسنلی', 
                                              currentUser.digitalSignature, 
                                              roles, 
                                              workflows
                                            );
                                            if (res.success) {
                                              loadWorkflowCartableTasks();
                                              if (res.isFinalApproval) {
                                                alert(isRtl ? '🎉 تصویب نهایی مدرک انجام شد و وضعیت آن در پایگاه داده QMS به ثبت رسید.' : 'Final approval completed.');
                                              } else {
                                                alert(isRtl ? `✅ مرحله تصویب گردید و مدرک به گام بعدی ("${res.nextStepName}") منتقل شد.` : 'Approved and advanced to next step.');
                                              }
                                            }
                                          }}
                                          className="bg-amber-500 hover:bg-amber-600 text-black px-4 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer shadow-md shadow-amber-500/10 flex items-center gap-1"
                                        >
                                          <Check size={12} />
                                          <span>{isRtl ? 'تصویب و امضای دیجیتال' : 'Approve & Sign'}</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Section 2: End-to-End Workflow Maps for All Users */}
                        <div className="space-y-4 pt-4 border-t border-white/5">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <h4 className="text-xs font-black text-white flex items-center gap-2">
                              <Compass size={14} className="text-amber-500" />
                              <span>{isRtl ? 'نقشه کامل گردش کار همه مدارک (نمایش عمومی برای تمامی پرسنل)' : 'End-to-End Workflow Process Map (Visible to All)'}</span>
                            </h4>
                            <span className="text-[10px] text-zinc-500 italic">
                              {isRtl ? 'مشاهده مسیر و وضعیت لحظه‌ای از ابتدا تا انتها' : 'Transparent end-to-end status'}
                            </span>
                          </div>

                          {workflows.length === 0 ? (
                            <div className="py-12 text-center text-zinc-500 text-xs italic border border-dashed border-zinc-850 rounded-2xl">
                              {isRtl ? 'هیچ گردش کاری در سیستم تعریف نشده است. ابتدا در تب "طراحی گردش کار" فرآیند جدید ایجاد کنید.' : 'No workflows configured yet.'}
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {workflows.map(wf => {
                                const docTasks = rawWorkflowTasks.filter(t => t.workflowId === wf.id || t.documentType === wf.documentType);
                                
                                return (
                                  <div key={wf.id} className="bg-black/30 border border-zinc-800 rounded-2xl p-4 space-y-3">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-white">{wf.documentType}</span>
                                        <span className="text-[9px] bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-800 font-mono">
                                          {wf.steps.length} {isRtl ? 'گام تصویب' : 'Steps'}
                                        </span>
                                      </div>
                                      <span className="text-[9px] text-zinc-500 font-mono">ID: {wf.id}</span>
                                    </div>

                                    {/* Step Map Pipeline */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
                                      {wf.steps.map((step, idx) => {
                                        const stepNum = idx + 1;
                                        const matchedTask = docTasks.find(t => t.stepNumber === stepNum);
                                        const role = roles.find(r => r.id === step.approverRoleId);
                                        const isMyTask = matchedTask ? isUserAuthorizedForWorkflowTask(currentUser, matchedTask, roles) : false;

                                        let stepStatus: 'approved' | 'rejected' | 'pending' | 'upcoming' = 'upcoming';
                                        if (matchedTask) {
                                          stepStatus = matchedTask.status;
                                        }

                                        return (
                                          <div 
                                            key={step.id || idx} 
                                            className={`p-3 rounded-xl border space-y-2 relative transition-all ${
                                              stepStatus === 'approved'
                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                                : stepStatus === 'rejected'
                                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                                : stepStatus === 'pending'
                                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-200 shadow-md ring-1 ring-amber-500/20'
                                                : 'bg-zinc-900/40 border-zinc-800/60 text-zinc-500'
                                            }`}
                                          >
                                            <div className="flex items-center justify-between text-[10px]">
                                              <span className="font-extrabold font-mono">
                                                {isRtl ? `گام ${stepNum}` : `Step ${stepNum}`}
                                              </span>
                                              {stepStatus === 'approved' && (
                                                <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-bold text-[9px] flex items-center gap-1">
                                                  <Check size={10} />
                                                  <span>{isRtl ? 'تایید شده' : 'Approved'}</span>
                                                </span>
                                              )}
                                              {stepStatus === 'rejected' && (
                                                <span className="bg-rose-500/20 text-rose-400 px-1.5 py-0.2 rounded font-bold text-[9px] flex items-center gap-1">
                                                  <X size={10} />
                                                  <span>{isRtl ? 'رد شده' : 'Rejected'}</span>
                                                </span>
                                              )}
                                              {stepStatus === 'pending' && (
                                                <span className="bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded font-bold text-[9px] animate-pulse flex items-center gap-1">
                                                  <RefreshCw size={9} className="animate-spin" />
                                                  <span>{isRtl ? 'در حال بررسی' : 'Pending'}</span>
                                                </span>
                                              )}
                                              {stepStatus === 'upcoming' && (
                                                <span className="text-zinc-600 font-mono text-[9px]">
                                                  {isRtl ? 'معلق / بعدی' : 'Upcoming'}
                                                </span>
                                              )}
                                            </div>

                                            <div>
                                              <div className="text-xs font-bold text-white truncate">{step.nameFa || step.name}</div>
                                              <div className="text-[9.5px] text-zinc-400 truncate mt-0.5">
                                                {isRtl ? 'نقش مسئول:' : 'Role:'} <strong className="text-zinc-200">{role?.nameFa || 'کمیته کیفی'}</strong>
                                              </div>
                                            </div>

                                            {/* Approved signature or Access Notice */}
                                            {stepStatus === 'approved' && matchedTask?.approvedByUserName && (
                                              <div className="text-[8.5px] text-emerald-400 border-t border-emerald-500/20 pt-1.5 flex items-center justify-between">
                                                <span>✍️ {matchedTask.approvedByUserName}</span>
                                                <span className="font-mono text-zinc-500">{new Date(matchedTask.updatedAt).toLocaleDateString('fa-IR')}</span>
                                              </div>
                                            )}

                                            {stepStatus === 'pending' && !isMyTask && (
                                              <div className="text-[8.5px] text-amber-400/80 border-t border-amber-500/20 pt-1.5 flex items-center gap-1">
                                                <Shield size={10} />
                                                <span>{isRtl ? `در انتظار اقدام نقش: ${role?.nameFa || 'مسئول'}` : 'Action restricted to role'}</span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* CONTENT TAB 2: Personal Tasks */}
                    {cartableSubTab === 'personal' && (
                      <div className="space-y-4">
                        {myTasks.length === 0 ? (
                          <div className="py-12 text-center text-zinc-500 text-xs italic border border-dashed border-zinc-850 rounded-2xl">
                            {isRtl ? 'کارتابل وظایف شخصی شما خالی است.' : 'No personal duties assigned.'}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                            {myTasks.map(task => (
                              <div key={task.id} className="bg-black/25 border border-zinc-900 p-4 rounded-xl space-y-2 relative">
                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                  <span className="font-extrabold text-white text-xs">{task.title}</span>
                                  <span className="text-[9px] font-mono text-amber-500">{task.dueDate}</span>
                                </div>
                                <p className="text-xs text-zinc-400 leading-relaxed">{task.description}</p>
                                <div className="flex justify-between items-center pt-2">
                                  <span className="text-[9px] uppercase text-zinc-500 font-mono">STATUS: {task.status}</span>
                                  {task.status !== 'done' && (
                                    <button
                                      onClick={() => onUpdateTaskStatus(task.id, 'done', 'Completed via portal')}
                                      className="bg-emerald-500 hover:bg-emerald-600 text-black text-[9px] font-black px-3 py-1 rounded-lg transition-all cursor-pointer"
                                    >
                                      {isRtl ? 'علامت اتمام' : 'Complete'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-150">
                {/* Identity form card */}
                <div className="md:col-span-2 bg-[#121215] border border-[#232326] rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-xs font-black text-white flex items-center gap-2 border-b border-white/5 pb-3">
                    <span className="text-amber-500">👤</span>
                    <span>{isRtl ? 'مشخصات پرسنلی و اطلاعات کاربری' : 'Profile Identity details'}</span>
                  </h3>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!profileFullName.trim()) {
                        alert(isRtl ? 'لطفاً نام کامل خود را وارد کنید.' : 'Please enter your full name.');
                        return;
                      }
                      if (!profileUsername.trim()) {
                        alert(isRtl ? 'لطفاً نام کاربری خود را وارد کنید.' : 'Please enter your username.');
                        return;
                      }
                      if (profilePassword && profilePassword !== profileConfirmPassword) {
                        alert(isRtl ? 'تکرار کلمه عبور با کلمه عبور جدید مطابقت ندارد.' : 'Passwords do not match.');
                        return;
                      }

                      // Check if username is already taken by another user
                      const usernameLower = profileUsername.trim().toLowerCase();
                      const taken = users.some(u => u.id !== currentUser.id && u.username.toLowerCase() === usernameLower);
                      if (taken) {
                        alert(isRtl ? 'این نام کاربری قبلاً توسط کاربر دیگری انتخاب شده است.' : 'Username is already taken.');
                        return;
                      }

                      const updatedUser = {
                        ...currentUser,
                        fullName: profileFullName.trim(),
                        username: usernameLower,
                        jobPosition: profileJobPosition.trim(),
                        ...(profilePassword ? { password: profilePassword } : {})
                      };

                      if (onUpdateUser) {
                        onUpdateUser(updatedUser);
                      }
                      
                      logSystemActivity(
                        updatedUser.username,
                        updatedUser.fullName,
                        'UPDATE_PROFILE',
                        'ویرایش مشخصات کاربری توسط خود پرسنل',
                        `تغییر نام کامل، سمت یا کلمه عبور در صفحه تنظیمات شخصی`,
                        'identity',
                        updatedUser.id
                      );

                      setProfilePassword('');
                      setProfileConfirmPassword('');
                      alert(isRtl ? 'مشخصات کاربری شما با موفقیت بروزرسانی شد.' : 'Profile updated successfully.');
                    }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Full Name */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-zinc-400">
                          {isRtl ? 'نام و نام خانوادگی' : 'Full Name'}
                        </label>
                        <input
                          type="text"
                          value={profileFullName}
                          onChange={(e) => setProfileFullName(e.target.value)}
                          className="w-full bg-black/40 border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none transition-all"
                        />
                      </div>

                      {/* Username */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-zinc-400">
                          {isRtl ? 'نام کاربری (جهت ورود)' : 'Username (for login)'}
                        </label>
                        <input
                          type="text"
                          value={profileUsername}
                          onChange={(e) => setProfileUsername(e.target.value)}
                          className="w-full bg-black/40 border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none transition-all font-mono"
                        />
                      </div>

                      {/* Job Position */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-zinc-400">
                          {isRtl ? 'سمت سازمانی' : 'Job Position'}
                        </label>
                        <input
                          type="text"
                          value={profileJobPosition}
                          onChange={(e) => setProfileJobPosition(e.target.value)}
                          className="w-full bg-black/40 border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none transition-all"
                        />
                      </div>

                      {/* User Role ID (View only) */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-zinc-500">
                          {isRtl ? 'سطح دسترسی اصلی (غیر قابل تغییر در اینجا)' : 'Role (View only)'}
                        </label>
                        <div className="w-full bg-zinc-900/50 border border-zinc-850 rounded-xl px-3.5 py-2.5 text-xs text-zinc-400">
                          {currentUser.role === 'admin' 
                            ? (isRtl ? 'مدیر سیستم (ادمین کل)' : 'System Administrator')
                            : (isRtl ? 'کاربر عادی سیستم تضمین کیفیت' : 'Process Owner / QMS Staff')}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-zinc-900/80 pt-4 space-y-4">
                      <div className="bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl flex items-start gap-2.5 text-[10px] text-zinc-400 leading-relaxed">
                        <span className="text-amber-500 font-extrabold font-mono shrink-0">ℹ️</span>
                        <span>
                          {isRtl 
                            ? 'برای تغییر کلمه عبور، رمز عبور جدید را در زیر بنویسید. در غیر این صورت فیلدهای مربوط به رمز عبور را خالی بگذارید.'
                            : 'To change your password, fill in the fields below. Otherwise, leave them blank to keep your current password.'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Password */}
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-zinc-400">
                            {isRtl ? 'کلمه عبور جدید (اختیاری)' : 'New Password (optional)'}
                          </label>
                          <input
                            type="password"
                            placeholder="••••••••"
                            value={profilePassword}
                            onChange={(e) => setProfilePassword(e.target.value)}
                            className="w-full bg-black/40 border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none transition-all"
                          />
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-zinc-400">
                            {isRtl ? 'تکرار کلمه عبور جدید' : 'Confirm New Password'}
                          </label>
                          <input
                            type="password"
                            placeholder="••••••••"
                            value={profileConfirmPassword}
                            onChange={(e) => setProfileConfirmPassword(e.target.value)}
                            className="w-full bg-black/40 border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        className="bg-amber-500 hover:bg-amber-600 text-black px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md shadow-amber-500/5"
                      >
                        {isRtl ? 'ذخیره مشخصات کاربری' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Left Panel: Profile Picture and Digital Signature card */}
                <div className="bg-[#121215] border border-[#232326] rounded-2xl p-5 shadow-xl space-y-5 flex flex-col justify-between">
                  <div className="space-y-5">
                    
                    {/* PROFILE PHOTO SECTION (Drag-and-Drop and Manual Click support) */}
                    <div className="space-y-3 pb-5 border-b border-white/5">
                      <h3 className="text-xs font-black text-white flex items-center gap-2">
                        <span className="text-amber-500">📸</span>
                        <span>{isRtl ? 'تصویر پروفایل کاربری' : 'Profile Picture'}</span>
                      </h3>
                      
                      <div 
                        className="w-full flex flex-col items-center gap-3.5 bg-black/20 p-4 rounded-xl border border-zinc-900 border-dashed hover:border-amber-500/35 transition-colors cursor-pointer"
                        onDragOver={(e) => {
                          e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          if (file && file.type.startsWith('image/')) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const base64Str = event.target?.result as string;
                              if (onUpdateUser) {
                                onUpdateUser({ ...currentUser, avatar: base64Str });
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      >
                        {currentUser.avatar ? (
                          <div className="relative group w-20 h-20 rounded-full overflow-hidden border-2 border-amber-500/50 shadow-lg shrink-0">
                            <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmModal({
                                  isOpen: true,
                                  title: isRtl ? '👤 حذف تصویر پروفایل' : '👤 Delete Profile Picture',
                                  message: isRtl ? 'آیا مایل به حذف تصویر پروفایل خود هستید؟' : 'Are you sure you want to delete your profile picture?',
                                  confirmLabel: isRtl ? 'بله، حذف شود' : 'Delete',
                                  confirmClass: 'bg-red-500 hover:bg-red-650',
                                  onConfirm: () => {
                                    if (onUpdateUser) {
                                      onUpdateUser({ ...currentUser, avatar: undefined });
                                    }
                                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                  }
                                });
                              }}
                              className="absolute inset-0 bg-black/85 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-500 transition-opacity cursor-pointer text-[9px] font-bold"
                            >
                              {isRtl ? 'حذف تصویر' : 'Delete'}
                            </button>
                          </div>
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-[#1A1A1D] border border-dashed border-[#3E3E43] flex items-center justify-center text-zinc-600 font-black text-2xl shrink-0 uppercase select-none">
                            {currentUser.fullName ? currentUser.fullName.substring(0, 1) : '?'}
                          </div>
                        )}

                        <div className="w-full text-center">
                          <label className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none text-center">
                            <span>{isRtl ? '📸 انتخاب تصویر جدید' : '📸 Upload Photo'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    const base64Str = event.target?.result as string;
                                    if (onUpdateUser) {
                                      onUpdateUser({ ...currentUser, avatar: base64Str });
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                          <p className="text-[8px] text-zinc-500 mt-2">
                            {isRtl ? 'تصویر را به اینجا بکشید یا برای انتخاب کلیک کنید' : 'Drag and drop image here or click to browse'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <h3 className="text-xs font-black text-white flex items-center gap-2 border-b border-white/5 pb-3">
                      <span className="text-amber-500">✍️</span>
                      <span>{isRtl ? 'نمونه امضای دیجیتال ممیز' : 'My Digital Signature'}</span>
                    </h3>

                    {/* Signature pad section */}
                    <div className="space-y-3">
                      <p className="text-[9.5px] text-zinc-400 leading-relaxed">
                        {isRtl 
                          ? 'این نمونه امضا جهت ثبت مصوبات، فرم‌های اثربخشی، چک‌لیست‌های ممیزی داخلی IATF و تاییده‌های اسنادی در پورتال سیستم کیفیت بکار می‌رود.'
                          : 'This signature is used to approve audits, documentation approvals, and system QMS forms.'}
                      </p>

                      {currentUser.digitalSignature || savedSignatureData ? (
                        <div className="bg-[#141418] border border-emerald-500/20 p-4 rounded-xl flex flex-col items-center justify-center gap-3">
                          <img src={currentUser.digitalSignature || savedSignatureData} alt="signature" className="max-h-24 object-contain filter invert opacity-90" />
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmModal({
                                isOpen: true,
                                title: isRtl ? '✍️ حذف امضا' : '✍️ Delete Signature',
                                message: isRtl ? 'آیا مایل به حذف و امضای مجدد هستید؟' : 'Are you sure you want to delete and redraw your signature?',
                                confirmLabel: isRtl ? 'بله، حذف شود' : 'Delete',
                                confirmClass: 'bg-red-500 hover:bg-red-650',
                                onConfirm: () => {
                                  setSavedSignatureData('');
                                  currentUser.digitalSignature = undefined;
                                  if (onUpdateUser) {
                                    onUpdateUser({ ...currentUser, digitalSignature: undefined });
                                  }
                                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                }
                              });
                            }}
                            className="text-[9px] text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                          >
                            {isRtl ? 'حذف و امضای مجدد' : 'Clear & Redraw'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <canvas
                            ref={signatureCanvasRef}
                            width={280}
                            height={120}
                            onMouseDown={startDrawingSignature}
                            onMouseMove={drawSignature}
                            onMouseUp={() => setIsDrawingSignature(false)}
                            onMouseLeave={() => setIsDrawingSignature(false)}
                            onTouchStart={startDrawingSignatureTouch}
                            onTouchMove={drawSignatureTouch}
                            onTouchEnd={() => setIsDrawingSignature(false)}
                            className="bg-black/30 border border-zinc-850 hover:border-zinc-700 rounded-xl cursor-crosshair w-full block touch-none"
                          />
                          <div className="flex justify-between items-center text-[10px]">
                            <button
                              type="button"
                              onClick={clearSignatureCanvas}
                              className="text-zinc-500 hover:text-white cursor-pointer font-bold"
                            >
                              {isRtl ? 'پاک کردن صفحه' : 'Clear canvas'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const canvas = signatureCanvasRef.current;
                                if (!canvas) return;
                                const base64Url = canvas.toDataURL('image/png');
                                setSavedSignatureData(base64Url);
                                if (onUpdateUser) {
                                  onUpdateUser({ ...currentUser, digitalSignature: base64Url });
                                } else {
                                  currentUser.digitalSignature = base64Url;
                                }
                                alert(isRtl ? 'امضای دیجیتال با موفقیت ثبت شد.' : 'Digital signature captured.');
                              }}
                              className="bg-amber-500 hover:bg-amber-600 text-black px-3.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer"
                            >
                              {isRtl ? 'تأیید و ذخیره امضا' : 'Capture Signature'}
                            </button>
                          </div>
                          <div className="mt-2.5 pt-2.5 border-t border-zinc-900/60 flex flex-col gap-1.5">
                            <span className="text-[9px] text-zinc-500 font-bold">{isRtl ? 'یا بارگذاری تصویر آماده امضا (PNG):' : 'Or upload ready signature image (PNG):'}</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleSignatureUpload} 
                              className="text-[9px] text-zinc-400 file:bg-zinc-800 file:text-zinc-300 file:border-0 file:py-1 file:px-2.5 file:rounded file:mr-2 file:cursor-pointer hover:file:bg-zinc-700 cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Account Metadata stats */}
                  <div className="bg-black/10 p-3.5 rounded-xl border border-zinc-900/80 text-[10px] text-zinc-500 space-y-1.5 mt-4">
                    <div className="flex justify-between">
                      <span>{isRtl ? 'شناسه کاربری:' : 'User ID:'}</span>
                      <span className="font-mono text-zinc-400">{currentUser.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{isRtl ? 'آخرین ورود:' : 'Last Login:'}</span>
                      <span className="font-mono text-zinc-400">
                        {currentUser.lastLoginAt ? new Date(currentUser.lastLoginAt).toLocaleString(isRtl ? 'fa-IR' : 'en-US') : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'admin_users' && currentUser.role === 'admin' && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-in fade-in duration-150">
                
                {/* Users List Grid */}
                <div className="lg:col-span-3 bg-[#121215] border border-[#232326] rounded-2xl p-5 shadow-xl">
                  <h3 className="text-xs font-black text-white flex items-center gap-2 border-b border-white/5 pb-3.5 mb-4">
                    <Users size={14} className="text-amber-500" />
                    <span>{isRtl ? 'لیست پرسنل و کاربران پورتال کیفیت' : 'User Security Accounts Directory'}</span>
                  </h3>

                  <div className="space-y-3 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
                    {users.map(u => {
                      const userRolesList = roles.filter(r => u.roleIds?.includes(r.id));
                      return (
                        <div key={u.id} className="bg-black/25 border border-zinc-900 hover:border-zinc-800 p-4 rounded-2xl flex flex-col gap-3 transition-all">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {/* User Profile Photo / Avatar inside the administrator directory */}
                              {u.avatar ? (
                                <img src={u.avatar} alt="Avatar" className="w-10 h-10 rounded-full border border-amber-500/25 shrink-0 object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-zinc-850 border border-zinc-800 flex items-center justify-center font-bold text-xs text-zinc-400 shrink-0 uppercase select-none">
                                  {u.fullName.substring(0, 1)}
                                </div>
                              )}

                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-extrabold text-white text-xs">{u.fullName}</span>
                                  <span className="text-[9.5px] font-mono text-zinc-500">@{u.username}</span>
                                  {u.isOnline && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  )}
                                </div>
                                <p className="text-[10px] text-zinc-500">
                                  {u.companyName || 'Corporate'} • {u.jobPosition || 'N/A'}
                                </p>
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {userRolesList.map(r => (
                                    <span key={r.id} className="bg-amber-500/5 border border-amber-500/10 px-2 py-0.5 rounded-lg text-[8.5px] font-bold text-amber-500">
                                      🛡️ {isRtl ? r.nameFa : r.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {u.username !== 'sysadmin' && (
                                <button
                                  onClick={() => {
                                    setConfirmModal({
                                      isOpen: true,
                                      title: isRtl ? '⚠️ حذف حساب کاربری' : '⚠️ Delete Account',
                                      message: isRtl ? `آیا از حذف حساب کاربری "${u.fullName}" مطمئن هستید؟` : `Are you sure you want to delete the user account for "${u.fullName}"?`,
                                      onConfirm: () => {
                                        onDeleteUser(u.id);
                                        logSystemActivity(
                                          currentUser.username,
                                          currentUser.fullName,
                                          'DELETE_USER',
                                          'حذف دائم حساب کاربری پرسنل',
                                          `حذف کاربر "${u.fullName}" با نام کاربری @${u.username}`,
                                          'identity',
                                          u.id
                                        );
                                        setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                      }
                                    });
                                  }}
                                  className="p-1.5 hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 rounded-xl transition-all cursor-pointer"
                                  title={isRtl ? 'حذف کاربر' : 'Delete'}
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Display Allowed Products Tags */}
                          {u.allowedProducts && u.allowedProducts.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/[0.04] text-[9px]">
                              <span className="text-zinc-500 font-bold shrink-0">
                                📂 {isRtl ? 'محصولات مجاز:' : 'Products Scope:'}
                              </span>
                              {products.filter(p => u.allowedProducts?.includes(p.id)).map(p => (
                                <span key={p.id} className="bg-zinc-800 border border-zinc-750 text-zinc-300 px-2 py-0.5 rounded text-[8.5px] font-semibold">
                                  {p.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/[0.04] text-[9px]">
                              <span className="text-zinc-500 font-bold shrink-0">
                                📂 {isRtl ? 'دسترسی همگانی (کل محصولات)' : 'Universal Access (All Products)'}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Add User Form */}
                <div className="lg:col-span-2 bg-[#121215] border border-[#232326] rounded-2xl p-5 shadow-xl self-start">
                  <h3 className="text-xs font-black text-white flex items-center gap-2 border-b border-white/5 pb-3.5 mb-4">
                    <UserPlus size={14} className="text-amber-500" />
                    <span>{isRtl ? 'ثبت و تعریف حساب کاربری پرسنل' : 'Provision User Credentials'}</span>
                  </h3>

                  <form onSubmit={handleCreateUserSubmit} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1">{isRtl ? 'نام و نام خانوادگی پرسنل' : 'Employee Full Name'}</label>
                      <input
                        type="text"
                        value={newFullName}
                        onChange={(e) => setNewFullName(e.target.value)}
                        required
                        placeholder={isRtl ? 'مثال: مهندس علی حسینی' : 'Example: John Doe'}
                        className="w-full bg-[#141418] border border-[#252529] focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 mb-1">{isRtl ? 'نام کاربری (لاتین)' : 'Username'}</label>
                        <input
                          type="text"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          required
                          placeholder="Example: a_hosseini"
                          className="w-full bg-[#141418] border border-[#252529] focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 mb-1">{isRtl ? 'رمز عبور اولیه' : 'Temporary Password'}</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-[#141418] border border-[#252529] focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 mb-1">{isRtl ? 'واحد دپارتمان سازمانی' : 'Organizational Dept'}</label>
                        <select
                          value={newUserDept}
                          onChange={(e) => setNewUserDept(e.target.value)}
                          className="w-full bg-[#141418] border border-[#252529] focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                        >
                          {orgUnits.filter(ou => ou.type === 'department').map(ou => (
                            <option key={ou.id} value={ou.id}>{isRtl ? ou.nameFa : ou.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 mb-1">{isRtl ? 'پست سازمانی' : 'Job Position'}</label>
                        <input
                          type="text"
                          value={newUserPosition}
                          onChange={(e) => setNewUserPosition(e.target.value)}
                          required
                          placeholder={isRtl ? 'مثال: سرپرست کنترل کیفیت' : 'QA Supervisor'}
                          className="w-full bg-[#141418] border border-[#252529] focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1">{isRtl ? 'تخصیص نقش سازمانی (مبنای دسترسی)' : 'Assign Security Role'}</label>
                      <select
                        multiple
                        value={newUserRoleIds}
                        onChange={(e) => {
                          const options = Array.from(e.target.selectedOptions).map((o: any) => o.value);
                          setNewUserRoleIds(options);
                        }}
                        className="w-full bg-[#141418] border border-[#252529] focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white outline-none min-h-[90px] cursor-pointer"
                      >
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>
                            [{r.name}] {isRtl ? r.nameFa : r.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-[9px] text-zinc-500 mt-1 leading-snug">
                        {isRtl ? 'برای تخصیص همزمان چند نقش دسترسی، کلید Ctrl یا Command را نگه دارید.' : 'Hold Ctrl or Command key to map multiple roles.'}
                      </p>
                    </div>

                    {products.length > 0 && (
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 mb-1">
                          {isRtl ? 'محدوده دسترسی به محصولات (Enterprise Scope)' : 'Allowed Workspace Products Scope'}
                        </label>
                        <select
                          multiple
                          value={newAllowedProductIds}
                          onChange={(e) => {
                            const options = Array.from(e.target.selectedOptions).map((o: any) => o.value);
                            setNewAllowedProductIds(options);
                          }}
                          className="w-full bg-[#141418] border border-[#252529] focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white outline-none min-h-[90px] cursor-pointer font-sans"
                        >
                          {products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.technicalNumber})
                            </option>
                          ))}
                        </select>
                        <p className="text-[9px] text-zinc-500 mt-1 leading-snug">
                          {isRtl ? 'در صورت عدم انتخاب، کاربر به تمام محصولات تعریف شده دسترسی خواهد داشت.' : 'If none selected, user will have access to all registered products.'}
                        </p>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-amber-500 hover:bg-amber-600 text-black py-2.5 rounded-xl text-xs font-black transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                    >
                      <Plus size={14} className="stroke-[3]" />
                      <span>{isRtl ? 'ثبت و صدور کارت پرسنلی هوشمند' : 'Commit New Account Credentials'}</span>
                    </button>
                  </form>
                </div>

              </div>
            )}

            {activeTab === 'admin_roles' && currentUser.role === 'admin' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* Switcher at the top of Roles & Permissions tab */}
                <div className="flex bg-[#121215]/80 backdrop-blur border border-[#232326] p-1 rounded-2xl max-w-md">
                  <button
                    type="button"
                    onClick={() => setRolesSubTab('roles')}
                    className={`flex-1 py-1.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      rolesSubTab === 'roles'
                        ? 'bg-amber-500 text-black shadow-lg font-black'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Shield size={14} />
                    <span>{isRtl ? 'نقش‌ها و دسترسی‌ها' : 'Roles & Permissions'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRolesSubTab('products')}
                    className={`flex-1 py-1.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      rolesSubTab === 'products'
                        ? 'bg-amber-500 text-black shadow-lg font-black'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Settings size={14} />
                    <span>{isRtl ? 'تنظیم دسترسی به محصولات' : 'Products Access'}</span>
                  </button>
                </div>

                {rolesSubTab === 'roles' ? (
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Roles list */}
                    <div className="lg:col-span-2 bg-[#121215] border border-[#232326] rounded-2xl p-5 shadow-xl">
                      <div className="flex justify-between items-center border-b border-white/5 pb-3.5 mb-4">
                        <h3 className="text-xs font-black text-white flex items-center gap-2">
                          <Shield size={14} className="text-amber-500" />
                          <span>{isRtl ? 'نقش‌های کاربری تعریف شده' : 'Organizational Access Roles'}</span>
                        </h3>
                      </div>

                      <div className="space-y-3.5">
                        {roles.map(r => (
                          <div key={r.id} className="bg-black/20 hover:bg-black/40 border border-zinc-900 p-4 rounded-xl flex items-center justify-between gap-4 transition-colors">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-zinc-200">{isRtl ? r.nameFa : r.name}</span>
                                {r.isSystem && (
                                  <span className="text-[8px] uppercase font-black text-zinc-500 bg-zinc-900 border border-zinc-850 px-1.5 rounded">SYSTEM</span>
                                )}
                              </div>
                              <span className="text-[9.5px] font-mono text-zinc-500">ID: {r.id}</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedRoleToEdit(r);
                                  setEditingRolePermissions(JSON.parse(JSON.stringify(r.permissions)));
                                }}
                                className="p-1.5 bg-amber-500/5 hover:bg-amber-500/20 text-amber-400 border border-amber-500/10 hover:border-amber-500/25 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                title={isRtl ? 'ویرایش بندها و مجوزهای نقش' : 'Edit role permissions'}
                              >
                                <Settings size={12} />
                                <span>{isRtl ? 'تنظیم دسترسی‌ها' : 'Perms'}</span>
                              </button>
                              <button
                                onClick={() => handleCopyRole(r)}
                                className="p-1.5 bg-zinc-900 border border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-all cursor-pointer"
                                title={isRtl ? 'شبیه‌سازی و تکثیر نقش' : 'Clone Role'}
                              >
                                <Copy size={11} />
                              </button>
                              {!r.isSystem && (
                                <button
                                  onClick={() => handleDeleteRole(r.id, r.nameFa)}
                                  className="p-1.5 hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 rounded-xl transition-all cursor-pointer"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Role Mini Form */}
                      <form onSubmit={handleCreateRole} className="border-t border-white/5 mt-5 pt-4 space-y-3">
                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block">{isRtl ? 'ایجاد نقش امنیتی جدید' : 'CREATE NEW SECURITY ROLE'}</span>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            required
                            value={newRoleNameFa}
                            onChange={(e) => setNewRoleNameFa(e.target.value)}
                            placeholder={isRtl ? 'نام فارسی (مثال: کارشناس ارشد ممیزی)' : 'Persian Name'}
                            className="w-full bg-[#141418] border border-[#252529] focus:border-amber-500 rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                          />
                          <input
                            type="text"
                            required
                            value={newRoleName}
                            onChange={(e) => setNewRoleName(e.target.value)}
                            placeholder="English Name (e.g. Lead Auditor)"
                            className="w-full bg-[#141418] border border-[#252529] focus:border-amber-500 rounded-xl px-3 py-1.5 text-xs text-white outline-none font-mono"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-amber-500 hover:bg-amber-600 text-black py-2 rounded-xl text-xs font-black transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Plus size={13} className="stroke-[3]" />
                          <span>{isRtl ? 'ثبت و ذخیره نقش' : 'Save Access Role'}</span>
                        </button>
                      </form>
                    </div>

                    {/* Permissions selector for selected role */}
                    <div className="lg:col-span-3 bg-[#121215] border border-[#232326] rounded-2xl p-5 shadow-xl">
                      {selectedRoleToEdit && editingRolePermissions ? (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center border-b border-white/5 pb-3.5 mb-3">
                            <div className="flex flex-col">
                              <h4 className="text-xs font-black text-white">{isRtl ? `ویرایش سطوح دسترسی نقش: ${selectedRoleToEdit.nameFa}` : `Edit Role: ${selectedRoleToEdit.name}`}</h4>
                              <span className="text-[9px] text-zinc-500 font-mono">Role ID: {selectedRoleToEdit.id}</span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedRoleToEdit(null)}
                                className="bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-white px-3.5 py-1.5 rounded-xl text-[10px] font-black cursor-pointer"
                              >
                                {isRtl ? 'انصراف' : 'Cancel'}
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveRolePermissions}
                                className="bg-emerald-500 hover:bg-emerald-600 text-black px-4 py-1.5 rounded-xl text-[10px] font-black cursor-pointer shadow-lg shadow-emerald-500/10"
                              >
                                {isRtl ? 'ذخیره تغییرات نقش' : 'Save Changes'}
                              </button>
                            </div>
                          </div>

                          {/* Double tree tab switcher */}
                          <div className="flex border-b border-zinc-850 pb-2.5 mb-3.5 gap-2.5">
                            <button
                              type="button"
                              onClick={() => setPermsViewMode('standard')}
                              className={`flex-1 py-2 px-3 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                                permsViewMode === 'standard'
                                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-md shadow-amber-500/5'
                                  : 'bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border-transparent'
                              }`}
                            >
                              <BookOpen size={14} />
                              <span>{isRtl ? '۱. ساختار درختی استاندارد (بندها)' : '1. Standard Clauses Tree'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPermsViewMode('project')}
                              className={`flex-1 py-2 px-3 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                                permsViewMode === 'project'
                                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-md shadow-amber-500/5'
                                  : 'bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border-transparent'
                              }`}
                            >
                              <Layers size={14} />
                              <span>{isRtl ? '۲. ساختار درختی کل پروژه (ریز به ریز)' : '2. Project Structure Tree'}</span>
                            </button>
                          </div>

                          {permsViewMode === 'standard' ? (
                            /* Standard clauses granular checklist tree */
                            <div className="space-y-2">
                              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block">{isRtl ? 'ماتریس دسترسی جزئی بندها و زیربندهای استاندارد (IATF 16949 / ISO 9001)' : 'STANDARDS CLAUSES HIERARCHICAL PERMISSION MATRIX'}</span>
                              
                              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 bg-black/10 p-3.5 rounded-xl border border-[#2c2c31] custom-scrollbar">
                                {iatfData.map(clause => (
                                  <ClausePermissionNode 
                                    key={clause.id} 
                                    clause={clause} 
                                    rolePermissions={editingRolePermissions.clauses || {}} 
                                    onToggle={handleToggleClausePermission}
                                    isRtl={isRtl}
                                  />
                                ))}
                              </div>
                            </div>
                          ) : (
                            /* Granular Project Structure Tree checklist */
                            <div className="space-y-2">
                              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block">{isRtl ? 'ساختار درختی تفصیلی پروژه و بخش‌های نرم‌افزار (جز به جز)' : 'GRANULAR APP MODULES & SECTIONS HIERARCHY TREE'}</span>
                              
                              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 bg-black/10 p-3.5 rounded-xl border border-[#2c2c31] custom-scrollbar">
                                {PROJECT_TREE_DATA.map(node => (
                                  <ProjectPermissionNode 
                                    key={node.id} 
                                    node={node} 
                                    projectPermissions={editingRolePermissions.projectTree || {}} 
                                    onToggle={handleToggleProjectPermission}
                                    isRtl={isRtl}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-12 text-zinc-500 gap-3 border border-dashed border-[#232326] rounded-2xl">
                          <Shield size={36} className="text-zinc-700 stroke-[1]" />
                          <p className="text-xs font-black text-zinc-400">{isRtl ? 'هیچ نقشی جهت ویرایش انتخاب نشده است' : 'No role selected'}</p>
                          <p className="text-[10px] text-zinc-650 max-w-xs leading-relaxed">{isRtl ? 'لطفاً از لیست روبرو روی دکمه «تنظیم دسترسی‌ها» یکی از نقش‌های کاربری کلیک کنید تا جدول بندهای استاندارد لود شود.' : 'Click on "Perms" of any role to customize standard clauses permissions.'}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#121215] border border-[#232326] rounded-2xl p-6 shadow-xl space-y-6">
                    <div>
                      <h3 className="text-xs font-black text-white flex items-center gap-2 border-b border-white/5 pb-3.5 mb-2">
                        <Settings size={14} className="text-amber-500" />
                        <span>{isRtl ? 'پیکربندی و تخصیص دسترسی کاربران به قطعات و محصولات مجاز' : 'User Products Scope Configuration'}</span>
                      </h3>
                      <p className="text-[10px] text-zinc-500 leading-relaxed">
                        {isRtl 
                          ? 'در این بخش می‌توانید مشخص کنید هر کدام از کاربران پورتال مجاز به مشاهده اطلاعات و فرآیندهای کدام یک از محصولات سازمان در کارتابل‌ها و مانیتورینگ‌ها هستند. در صورت خالی بودن دسترسی یک کاربر، او به تمام محصولات دسترسی خواهد داشت.' 
                          : 'Define which products each user is authorized to access. Users with no specific products assigned will have universal access.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                      {users.map(u => {
                        const isEditing = editingUserProductsId === u.id;
                        return (
                          <div key={u.id} className="bg-black/25 border border-zinc-900 hover:border-zinc-850 p-4 rounded-2xl flex flex-col gap-3.5 transition-all">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {u.avatar ? (
                                  <img src={u.avatar} alt="Avatar" className="w-8 h-8 rounded-full border border-amber-500/25 shrink-0 object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-zinc-850 border border-zinc-800 flex items-center justify-center font-bold text-[10px] text-zinc-400 shrink-0 uppercase select-none">
                                    {u.fullName.substring(0, 1)}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-[11px] font-black text-white truncate">{u.fullName}</p>
                                  <p className="text-[9px] text-zinc-500 font-mono">@{u.username}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setEditingUserProductsId(isEditing ? null : u.id);
                                  setEditingUserProductsList(u.allowedProducts || []);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[9.5px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                                  isEditing 
                                    ? 'bg-amber-500 text-black shadow-md' 
                                    : 'bg-amber-500/5 hover:bg-amber-500/15 border border-amber-500/15 text-amber-400'
                                }`}
                              >
                                <Settings size={11} />
                                <span>{isRtl ? 'تغییر دسترسی' : 'Configure'}</span>
                              </button>
                            </div>

                            {/* Tags */}
                            <div className="flex flex-wrap items-center gap-1 text-[8.5px] border-t border-white/[0.03] pt-2">
                              <span className="text-zinc-500 font-bold shrink-0">{isRtl ? 'محصولات مجاز:' : 'Scope:'}</span>
                              {u.allowedProducts && u.allowedProducts.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {products.filter(p => u.allowedProducts?.includes(p.id)).map(p => (
                                    <span key={p.id} className="bg-zinc-800 border border-zinc-750 text-zinc-300 px-1.5 py-0.5 rounded-[4px] font-semibold">
                                      {p.name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-zinc-400 italic bg-amber-500/5 border border-amber-500/10 px-1.5 py-0.5 rounded-[4px]">
                                  {isRtl ? 'همگانی (کل کارتابل)' : 'Universal Access'}
                                </span>
                              )}
                            </div>

                            {isEditing && (
                              <div className="p-3 bg-[#0d0d0f]/65 border border-amber-500/10 rounded-xl space-y-2 animate-in fade-in duration-150">
                                <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider block">
                                  {isRtl ? 'انتخاب محصولات مجاز این کاربر:' : 'Select authorized products:'}
                                </span>
                                <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                                  {products.map(p => {
                                    const isChecked = editingUserProductsList.includes(p.id);
                                    return (
                                      <label key={p.id} className="flex items-center gap-2 text-[9.5px] text-zinc-300 hover:text-white cursor-pointer select-none py-0.5">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setEditingUserProductsList([...editingUserProductsList, p.id]);
                                            } else {
                                              setEditingUserProductsList(editingUserProductsList.filter(id => id !== p.id));
                                            }
                                          }}
                                          className="accent-amber-500 rounded cursor-pointer w-3 h-3 border-zinc-800"
                                        />
                                        <span>{p.name} <span className="text-zinc-500 font-mono text-[8px]">({p.technicalNumber})</span></span>
                                      </label>
                                    );
                                  })}
                                </div>
                                <div className="flex gap-1.5 justify-end pt-1.5 border-t border-white/5">
                                  <button
                                    type="button"
                                    onClick={() => setEditingUserProductsId(null)}
                                    className="text-[9px] font-bold text-zinc-500 hover:text-white px-2 py-1 rounded"
                                  >
                                    {isRtl ? 'انصراف' : 'Cancel'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onUpdateUser) {
                                        onUpdateUser({
                                          ...u,
                                          allowedProducts: editingUserProductsList
                                        });
                                        logSystemActivity(
                                          currentUser.username,
                                          currentUser.fullName,
                                          'UPDATE_USER_PRODUCTS',
                                          'ویرایش محدوده محصولات مجاز کاربر',
                                          `تغییر محصولات مجاز کاربر "${u.fullName}" در سیستم امنیتی`,
                                          'identity',
                                          u.id
                                        );
                                      }
                                      setEditingUserProductsId(null);
                                    }}
                                    className="bg-amber-500 hover:bg-amber-600 text-black font-black text-[9px] px-2.5 py-1 rounded-md transition-all"
                                  >
                                    {isRtl ? 'ذخیره' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'org_units' && currentUser.role === 'admin' && (
              <TeamManagementOrgStructure
                lang={lang}
                orgUnits={orgUnits}
                onAddUnit={(unit) => {
                  const newUnit: OrgUnit = { ...unit, id: 'org-' + Date.now() };
                  setOrgUnits(prev => [...prev, newUnit]);
                }}
                onUpdateUnit={(id, name, nameFa) => {
                  setOrgUnits(prev => prev.map(ou => ou.id === id ? { ...ou, name, nameFa } : ou));
                }}
                onDeleteUnit={(id) => {
                  setOrgUnits(prev => prev.filter(ou => ou.id !== id && ou.parentId !== id));
                }}
                isRtl={isRtl}
              />
            )}

            {activeTab === 'process_owners' && currentUser.role === 'admin' && (
              <TeamManagementProcessOwners
                lang={lang}
                users={users}
                processOwners={processOwners}
                onAddOwner={(owner) => {
                  const newOwner: ProcessOwner = { ...owner, id: 'po-' + Date.now() };
                  setProcessOwners(prev => [...prev, newOwner]);
                }}
                onDeleteOwner={(id) => {
                  setProcessOwners(prev => prev.filter(po => po.id !== id));
                }}
                isRtl={isRtl}
              />
            )}

            {activeTab === 'workflows' && currentUser.role === 'admin' && (
              <TeamManagementWorkflows
                lang={lang}
                roles={roles}
                workflows={workflows}
                onAddWorkflow={(wf) => {
                  const newWf: Workflow = { ...wf, id: 'wf-' + Date.now() };
                  setWorkflows(prev => [...prev, newWf]);
                }}
                onDeleteWorkflow={(id) => {
                  setWorkflows(prev => prev.filter(w => w.id !== id));
                }}
                isRtl={isRtl}
              />
            )}

            {activeTab === 'audit_logs' && currentUser.role === 'admin' && (
              <TeamManagementAuditLogs
                lang={lang}
                auditLogs={auditLogs}
                isRtl={isRtl}
              />
            )}

          </div>
        </>
      ) : (
        /* Dynamic Login Portal Frame */
        <div className="max-w-md mx-auto bg-[#121215] border border-[#232326] p-6 rounded-3xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600"></div>
          
          <div className="text-center space-y-2 pb-5 border-b border-white/5 mb-5">
            <span className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl inline-block shadow-inner">
              <ShieldCheck size={26} />
            </span>
            <h3 className="text-sm font-black text-white">{isRtl ? 'پورتال یکپارچه هویت و امنیت QMS مبتنی بر IATF 16949' : 'Integrated QMS Access Gateway'}</h3>
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              {isRtl 
                ? 'جهت ویرایش بندها، تغییر مصوبات و اقدامات اصلاحی، لطفاً نام کاربری و کلمه عبور ایمن خود را وارد کنید.' 
                : 'Enter your credentials to manage clauses and commit quality documents.'}
            </p>
          </div>

          <form onSubmit={handleFormLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 mb-1">{isRtl ? 'نام کاربری پرسنل' : 'Username'}</label>
              <input
                type="text"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder={isRtl ? 'مثال: sysadmin' : 'sysadmin'}
                className="w-full bg-[#141418] border border-[#252529] focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 mb-1">{isRtl ? 'کلمه عبور امن پرسنل' : 'Password'}</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#141418] border border-[#252529] focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none font-mono"
              />
            </div>

            {loginError && (
              <div className="bg-rose-500/5 border border-rose-500/15 p-3 rounded-xl text-rose-400 text-[10px] leading-relaxed flex items-start gap-1.5">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-black py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-amber-500/15 flex items-center justify-center gap-1.5"
            >
              <Key size={13} className="stroke-[3]" />
              <span>{isRtl ? 'تأیید هویت و ورود به سیستم' : 'Authenticate & Open Portal'}</span>
            </button>
          </form>

          {/* Secure Seed info for fresh deployments */}
          {users.length === 0 && (
            <div className="mt-5 pt-4 border-t border-white/5 bg-amber-500/[0.02] p-3 rounded-xl border border-amber-500/10 text-center">
              <span className="text-[10px] text-amber-500 font-bold leading-relaxed block">
                💡 {isRtl ? 'اولین ورود به سیستم؟' : 'First deployment?'}
              </span>
              <span className="text-[9px] text-zinc-400 leading-relaxed block mt-0.5">
                {isRtl 
                  ? 'کافی است با نام کاربری "sysadmin" و کلمه عبور "admin" لاگین کنید تا ادمین ارشد به صورت خودکار رجیستر و لود شود.'
                  : 'Simply log in as "sysadmin" with password "admin" to auto-seed the Super Administrator account.'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Custom Confirmation Dialog Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 text-right" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#0F0F12] border border-[#27272C] rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-white/5 pb-2.5">
              <span className="text-red-500">{confirmModal.title}</span>
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed font-medium">
              {confirmModal.message}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                {isRtl ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`${confirmModal.confirmClass || 'bg-red-500 hover:bg-red-650 text-white'} px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg`}
              >
                {confirmModal.confirmLabel || (isRtl ? 'تأیید' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Inspection & Link Preview Modal */}
      {selectedDocPreview && (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 text-right overflow-y-auto" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#111115] border border-[#2d2d35] rounded-3xl p-6 max-w-2xl w-full shadow-2xl flex flex-col gap-5 my-8 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-amber-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase">
                      {selectedDocPreview.docType || 'سند کیفی'}
                    </span>
                    {selectedDocPreview.clauseId && (
                      <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                        IATF {selectedDocPreview.clauseId}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-black text-white mt-1">
                    {selectedDocPreview.docTitle || selectedDocPreview.docId}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDocPreview(null)}
                className="p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Document Details & Attributes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#18181e] p-4 rounded-2xl border border-white/5">
              <div className="space-y-1">
                <span className="text-zinc-500 text-[10px] block font-bold">{isRtl ? 'شناسه و کد سند:' : 'Document ID:'}</span>
                <span className="text-zinc-200 font-mono font-bold">{selectedDocPreview.docId}</span>
              </div>
              <div className="space-y-1">
                <span className="text-zinc-500 text-[10px] block font-bold">{isRtl ? 'نوع مدرک کیفی:' : 'Document Type:'}</span>
                <span className="text-zinc-200 font-bold">{selectedDocPreview.docType || 'دستورالعمل / روش اجرایی'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-zinc-500 text-[10px] block font-bold">{isRtl ? 'بند استاندارد IATF 16949:' : 'Clause:'}</span>
                <span className="text-zinc-200 font-mono font-bold">{selectedDocPreview.clauseId ? `بند ${selectedDocPreview.clauseId}` : 'عمومی'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-zinc-500 text-[10px] block font-bold">{isRtl ? 'وضعیت پرونده:' : 'Status:'}</span>
                <span className="inline-flex items-center gap-1 text-amber-400 font-extrabold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[10px]">
                  <CheckCircle2 size={12} />
                  <span>{selectedDocPreview.task?.status === 'approved' ? 'تصویب شده' : selectedDocPreview.task?.status === 'rejected' ? 'رد شده / مرجوع' : 'در جریان گردش کار'}</span>
                </span>
              </div>
            </div>

            {/* Workflow Progress Steps Bar */}
            {selectedDocPreview.task && (
              <div className="space-y-2">
                <h4 className="text-xs font-black text-zinc-300 flex items-center gap-1.5">
                  <Activity size={14} className="text-amber-500" />
                  <span>{isRtl ? 'وضعیت مراحل گردش کار سند:' : 'Workflow Step Status:'}</span>
                </h4>
                <div className="p-3 bg-[#15151a] rounded-2xl border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-400">
                    <span>گام فعلی: {selectedDocPreview.task.stepNameFa || selectedDocPreview.task.stepName}</span>
                    <span className="font-mono text-zinc-400">{selectedDocPreview.task.stepNumber} / {selectedDocPreview.task.totalSteps}</span>
                  </div>
                  <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden flex gap-1 p-0.5 border border-zinc-800">
                    {Array.from({ length: selectedDocPreview.task.totalSteps }).map((_, idx) => {
                      const stepNum = idx + 1;
                      const isPast = stepNum < selectedDocPreview.task!.stepNumber;
                      const isCurrent = stepNum === selectedDocPreview.task!.stepNumber;
                      return (
                        <div
                          key={stepNum}
                          className={`h-full flex-1 rounded-full transition-all ${
                            isPast 
                              ? 'bg-emerald-500' 
                              : isCurrent 
                                ? selectedDocPreview.task!.status === 'rejected' ? 'bg-rose-500' : 'bg-amber-500 animate-pulse'
                                : 'bg-zinc-800'
                          }`}
                          title={`گام ${stepNum}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Comments & Audit Trail for Document */}
            {selectedDocPreview.task?.comments && selectedDocPreview.task.comments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-black text-zinc-300 flex items-center gap-1.5">
                  <MessageSquare size={14} className="text-amber-500" />
                  <span>{isRtl ? 'تاریخچه نظرات، دلایل رد و یادداشت‌های ثبت‌شده:' : 'Comments & Tag History:'}</span>
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-2 custom-scrollbar p-1">
                  {selectedDocPreview.task.comments.map(c => (
                    <div key={c.id} className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-amber-400">{c.userName}</span>
                        <span className="text-zinc-500 font-mono">{new Date(c.createdAt).toLocaleDateString('fa-IR')}</span>
                      </div>
                      <p className="text-zinc-200 font-medium text-[11px] leading-relaxed">{c.comment}</p>
                      {c.tag && (
                        <span className="inline-block text-[9px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 font-mono">
                          #{c.tag}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  alert(isRtl ? `در حال دانلود سند کیفی "${selectedDocPreview.docTitle || selectedDocPreview.docId}"...` : 'Downloading file...');
                }}
                className="bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
              >
                <Download size={14} />
                <span>{isRtl ? 'مشاهده و دانلود نسخه کامل سند' : 'Download Document File'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDocPreview(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {isRtl ? 'بستن پنجره' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal with Comment & Tag Input */}
      {rejectingTask && (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 text-right" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#111115] border border-rose-500/30 rounded-3xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-rose-500/20 pb-3">
              <h3 className="text-sm font-black text-rose-400 flex items-center gap-2">
                <RotateCcw size={18} />
                <span>{isRtl ? 'عدم تایید و عودت به مرحله قبل' : 'Reject & Revert Task'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setRejectingTask(null)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-rose-500/5 p-3 rounded-2xl border border-rose-500/10 text-xs text-zinc-300 space-y-1">
              <p className="font-bold text-white">{rejectingTask.documentTitle}</p>
              <p className="text-[10px] text-zinc-400">
                با رد این مدرک در گام {rejectingTask.stepNumber}، وظیفه جهت اصلاح به گام قبلی مرجوع می‌گردد.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 font-bold mb-1">
                  {isRtl ? 'علت عدم پذیرش و نظر کارشناسی (الزامی):' : 'Rejection Reason (Required):'}
                </label>
                <textarea
                  value={rejectionReasonInput}
                  onChange={e => setRejectionReasonInput(e.target.value)}
                  rows={3}
                  className="w-full bg-[#18181e] border border-zinc-800 focus:border-rose-500 rounded-xl p-3 text-white text-xs outline-none transition-all"
                  placeholder="دلیل عدم انطباق را با جزئیات بنویسید..."
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-bold mb-1">
                  {isRtl ? 'تگ دسته بندی علت رد:' : 'Rejection Tag:'}
                </label>
                <select
                  value={rejectionTagInput}
                  onChange={e => setRejectionTagInput(e.target.value)}
                  className="w-full bg-[#18181e] border border-zinc-800 focus:border-rose-500 rounded-xl p-2.5 text-white text-xs outline-none transition-all"
                >
                  <option value="عدم پذیرش و عودت به گام قبل">عدم پذیرش و عودت به گام قبل</option>
                  <option value="نیاز به اصلاح محتوای فنی">نیاز به اصلاح محتوای فنی</option>
                  <option value="عدم انطباق با بندهای IATF">عدم انطباق با بندهای IATF</option>
                  <option value="ایراد نگارشی و فرمت">ایراد نگارشی و فرمت</option>
                  <option value="نیاز به تایید ممیز کیفی">نیاز به تایید ممیز کیفی</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setRejectingTask(null)}
                className="px-4 py-2 bg-zinc-900 text-zinc-400 hover:text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {isRtl ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!rejectionReasonInput.trim()) {
                    alert(isRtl ? 'لطفاً علت عدم تایید را وارد کنید.' : 'Please enter rejection reason.');
                    return;
                  }
                  const res = rejectWorkflowCartableTask(
                    rejectingTask.id,
                    currentUser,
                    rejectionReasonInput.trim(),
                    roles,
                    workflows,
                    rejectionTagInput
                  );
                  if (res.success) {
                    loadWorkflowCartableTasks();
                    alert(isRtl ? `مدرک با موفقیت رد شد و به مرحله قبل ("${res.revertedToStepName}") مرجوع گردید.` : 'Rejected and reverted.');
                    setRejectingTask(null);
                  }
                }}
                className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black cursor-pointer shadow-lg shadow-rose-500/20"
              >
                {isRtl ? 'ثبت رد و عودت وظیفه' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Comment Modal */}
      {commentingTask && (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 text-right" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#111115] border border-amber-500/30 rounded-3xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
              <h3 className="text-sm font-black text-amber-400 flex items-center gap-2">
                <MessageSquare size={18} />
                <span>{isRtl ? 'درج نظر، یادداشت یا تگ روی مدرک' : 'Add Comment & Tag'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setCommentingTask(null)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs font-bold text-white">{commentingTask.documentTitle}</p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 font-bold mb-1">
                  {isRtl ? 'متن نظر / یادداشت کاربری:' : 'Comment text:'}
                </label>
                <textarea
                  value={newCommentInput}
                  onChange={e => setNewCommentInput(e.target.value)}
                  rows={3}
                  className="w-full bg-[#18181e] border border-zinc-800 focus:border-amber-500 rounded-xl p-3 text-white text-xs outline-none transition-all"
                  placeholder="نظر یا توضیحات خود را بنویسید..."
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-bold mb-1">
                  {isRtl ? 'برچسب / تگ:' : 'Tag:'}
                </label>
                <input
                  type="text"
                  value={newCommentTagInput}
                  onChange={e => setNewCommentTagInput(e.target.value)}
                  className="w-full bg-[#18181e] border border-zinc-800 focus:border-amber-500 rounded-xl p-2.5 text-white text-xs outline-none transition-all"
                  placeholder="مثلاً: #یادداشت_فنی، #پیگیری_امضا"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setCommentingTask(null)}
                className="px-4 py-2 bg-zinc-900 text-zinc-400 hover:text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {isRtl ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newCommentInput.trim()) {
                    alert(isRtl ? 'لطفاً متن نظر را وارد کنید.' : 'Please enter comment.');
                    return;
                  }
                  const ok = addTaskComment(commentingTask.id, currentUser, newCommentInput, newCommentTagInput);
                  if (ok) {
                    loadWorkflowCartableTasks();
                    alert(isRtl ? 'نظر و تگ شما با موفقیت به مدرک اضافه شد.' : 'Comment saved.');
                    setCommentingTask(null);
                    setNewCommentInput('');
                  }
                }}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-black cursor-pointer shadow-lg shadow-amber-500/20"
              >
                {isRtl ? 'ثبت نظر' : 'Save Comment'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
