import { Role, User, Workflow, WorkflowStep } from '../components/TeamManagementTypes';
import { logSystemActivity } from '../components/TeamManagement';
import { QmsDatabase, TaskWorkflowObserver } from './qmsDatabase';

export interface TaskComment {
  id: string;
  userId: string;
  userName: string;
  userRole?: string;
  comment: string;
  tag?: string;
  createdAt: string;
}

export interface WorkflowCartableTask {
  id: string;
  workflowId: string;
  documentType: string;
  documentId: string;
  documentTitle: string;
  stepNumber: number;
  totalSteps: number;
  stepName: string;
  stepNameFa: string;
  approverRoleId: string;
  approverRoleNameFa?: string;
  approverUserId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'reverted';
  createdAt: string;
  updatedAt: string;
  approvedByUserId?: string;
  approvedByUserName?: string;
  rejectionComment?: string;
  signatureData?: string;
  clauseId?: string;
  companyId?: string;
  comments?: TaskComment[];
  tags?: string[];
  revertedFromStep?: number;
}

const STORAGE_KEY_WORKFLOW_TASKS = 'qms_workflow_cartable_tasks';
const STORAGE_KEY_WORKFLOW_HISTORIES = 'qms_workflow_histories';

/**
 * Get all stored workflow cartable tasks from localStorage with robust deduplication and fake seed purging
 */
export function getStoredWorkflowCartableTasks(): WorkflowCartableTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WORKFLOW_TASKS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const seenIds = new Set<string>();
        const seenKeys = new Set<string>();
        const uniqueTasks: WorkflowCartableTask[] = [];

        for (const task of parsed) {
          if (!task || !task.id) continue;
          // Purge legacy fake sample seeds
          if (task.id === 'wf-task-101' || task.id === 'wf-task-102') continue;
          if (seenIds.has(task.id)) continue;

          // Composite key to detect semantic duplicates: (workflowId or docType) + docId + stepNumber
          const keyDomain = task.workflowId || task.documentType || 'generic';
          const keyDoc = task.documentId || 'doc';
          const compositeKey = `${keyDomain}_${keyDoc}_step${task.stepNumber}_${task.status}`;

          if (seenKeys.has(compositeKey)) continue;

          seenIds.add(task.id);
          seenKeys.add(compositeKey);
          uniqueTasks.push(task);
        }

        // Save clean state if fake seeds or duplicates were purged
        if (uniqueTasks.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY_WORKFLOW_TASKS, JSON.stringify(uniqueTasks));
        }

        return uniqueTasks;
      }
    }
  } catch (e) {
    console.error('Error reading workflow cartable tasks:', e);
  }
  return [];
}

/**
 * Save workflow cartable tasks and dispatch reactive events
 */
export function saveWorkflowCartableTasks(tasks: WorkflowCartableTask[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_WORKFLOW_TASKS, JSON.stringify(tasks));
    // Dispatch reactive events for instant UI synchronization
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('qms-workflow-sync', { detail: { tasks } }));
  } catch (e) {
    console.error('Error saving workflow cartable tasks:', e);
  }
}

/**
 * Ensures cartable loads real user data only - no fake sample seeds
 */
export function seedInitialWorkflowCartableTasks(roles: Role[]): WorkflowCartableTask[] {
  return getStoredWorkflowCartableTasks();
}

/**
 * Synchronize workflows configured in TeamManagementWorkflows with Cartable tasks.
 * Strictly idempotent: prevents duplicate task creation and purges orphan tasks when workflows are deleted.
 */
export function syncConfiguredWorkflowsToCartable(workflows: Workflow[], roles: Role[]): void {
  const tasks = getStoredWorkflowCartableTasks();

  // If no workflows are configured, purge all orphan workflow tasks
  if (!workflows || workflows.length === 0) {
    if (tasks.length > 0) {
      saveWorkflowCartableTasks([]);
    }
    return;
  }

  const activeWfIds = new Set(workflows.map(w => w.id));
  const activeDocTypes = new Set(workflows.map(w => w.documentType));

  // Purge orphan tasks whose parent workflow or documentType no longer exists
  const filteredTasks = tasks.filter(t => 
    (t.workflowId && activeWfIds.has(t.workflowId)) || 
    (t.documentType && activeDocTypes.has(t.documentType))
  );

  let updated = filteredTasks.length !== tasks.length;

  workflows.forEach(wf => {
    if (!wf.steps || wf.steps.length === 0) return;

    // Check if a task for this workflow already exists in ANY status for step 1
    const existingTask = filteredTasks.find(t => 
      (t.workflowId === wf.id || t.documentType === wf.documentType) && t.stepNumber === 1
    );

    if (!existingTask) {
      // Create ONE single task for step 1 with a deterministic task ID
      const firstStep = wf.steps[0];
      const role = roles.find(r => r.id === firstStep.approverRoleId);
      const taskId = `wf-task-${wf.id || Math.random().toString(36).substring(2, 6)}-step1`;
      
      const newTask: WorkflowCartableTask = {
        id: taskId,
        workflowId: wf.id,
        documentType: wf.documentType,
        documentId: `DOC-${(wf.id || 'WF').slice(-4)}`,
        documentTitle: `بررسی و تصویب مدرک ${wf.documentType} (مطابق گردش کار جدید)`,
        stepNumber: 1,
        totalSteps: wf.steps.length,
        stepName: firstStep.name,
        stepNameFa: firstStep.nameFa,
        approverRoleId: firstStep.approverRoleId || roles[0]?.id || 'role-qa',
        approverRoleNameFa: role ? role.nameFa : 'تاییدکننده مجاز',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clauseId: '7.5.3',
        companyId: wf.companyId || 'company-primary'
      };

      filteredTasks.unshift(newTask);
      updated = true;
    } else {
      // If task already exists and is pending, update role names and steps if changed
      if (existingTask.status === 'pending') {
        const firstStep = wf.steps[0];
        const role = roles.find(r => r.id === firstStep.approverRoleId);
        let changed = false;

        if (existingTask.workflowId !== wf.id) { existingTask.workflowId = wf.id; changed = true; }
        if (existingTask.stepNameFa !== firstStep.nameFa) { existingTask.stepNameFa = firstStep.nameFa; changed = true; }
        if (existingTask.approverRoleId !== firstStep.approverRoleId) { 
          existingTask.approverRoleId = firstStep.approverRoleId; 
          changed = true; 
        }
        if (role && existingTask.approverRoleNameFa !== role.nameFa) { 
          existingTask.approverRoleNameFa = role.nameFa; 
          changed = true; 
        }
        if (existingTask.totalSteps !== wf.steps.length) { 
          existingTask.totalSteps = wf.steps.length; 
          changed = true; 
        }

        if (changed) {
          existingTask.updatedAt = new Date().toISOString();
          updated = true;
        }
      }
    }
  });

  if (updated) {
    saveWorkflowCartableTasks(filteredTasks);
  }
}

/**
 * Check if a specific user is authorized to approve/reject a given workflow task step
 */
export function isUserAuthorizedForWorkflowTask(
  user: User | null,
  task: WorkflowCartableTask,
  roles: Role[] = []
): boolean {
  if (!user) return false;

  // 1. Direct user ID match
  if (task.approverUserId && task.approverUserId === user.id) return true;

  // 2. Role ID match in user's assigned roleIds
  const userRoleIds = user.roleIds || [];
  if (userRoleIds.includes(task.approverRoleId)) return true;

  // 3. Match user role by name or system role match
  const taskRole = roles.find(r => r.id === task.approverRoleId);
  if (taskRole) {
    if (user.role && taskRole.name.toLowerCase().includes(user.role.toLowerCase())) return true;
  }

  // 4. Admin fallback override
  if (user.role === 'admin') return true;

  return false;
}

/**
 * Filter pending workflow tasks that belong to the current user (strictly assigned to their role or user ID)
 */
export function getCartableWorkflowTasksForUser(
  user: User | null,
  roles: Role[]
): WorkflowCartableTask[] {
  if (!user) return [];
  const allTasks = getStoredWorkflowCartableTasks();

  return allTasks.filter(task => {
    // Only pending tasks belong in active action cartable
    if (task.status !== 'pending') return false;
    return isUserAuthorizedForWorkflowTask(user, task, roles);
  });
}

/**
 * Approve a Workflow Step Task in Cartable -> Instantly Syncs with Document Workflow
 */
export function approveWorkflowCartableTask(
  taskId: string,
  currentUser: User,
  comment: string = 'مورد تایید است',
  signatureData?: string,
  roles: Role[] = [],
  workflows: Workflow[] = []
): { success: boolean; isFinalApproval: boolean; nextStepName?: string } {
  const tasks = getStoredWorkflowCartableTasks();
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) return { success: false, isFinalApproval: false };

  const currentTask = tasks[taskIndex];
  const userSig = signatureData || currentUser.digitalSignature || '';

  // Mark current step task as approved
  currentTask.status = 'approved';
  currentTask.approvedByUserId = currentUser.id;
  currentTask.approvedByUserName = currentUser.fullName;
  currentTask.signatureData = userSig;
  currentTask.updatedAt = new Date().toISOString();

  let isFinalApproval = false;
  let nextStepName = '';

  // Check if there are subsequent workflow steps
  const matchedWorkflow = workflows.find(w => w.documentType === currentTask.documentType || w.id === currentTask.workflowId);
  const nextStepNumber = currentTask.stepNumber + 1;

  if (matchedWorkflow && matchedWorkflow.steps && nextStepNumber <= matchedWorkflow.steps.length) {
    // Generate task for NEXT workflow step if not already present
    const alreadyHasNext = tasks.some(t => 
      (t.workflowId === currentTask.workflowId || t.documentType === currentTask.documentType) && 
      t.documentId === currentTask.documentId && 
      t.stepNumber === nextStepNumber
    );

    if (!alreadyHasNext) {
      const nextStepSpec = matchedWorkflow.steps[nextStepNumber - 1];
      const role = roles.find(r => r.id === nextStepSpec.approverRoleId);
      const nextTaskId = `wf-task-${currentTask.workflowId}-${currentTask.documentId}-step${nextStepNumber}`;
      
      const nextTask: WorkflowCartableTask = {
        id: nextTaskId,
        workflowId: currentTask.workflowId,
        documentType: currentTask.documentType,
        documentId: currentTask.documentId,
        documentTitle: currentTask.documentTitle,
        stepNumber: nextStepNumber,
        totalSteps: matchedWorkflow.steps.length,
        stepName: nextStepSpec.name,
        stepNameFa: nextStepSpec.nameFa,
        approverRoleId: nextStepSpec.approverRoleId || currentTask.approverRoleId,
        approverRoleNameFa: role ? role.nameFa : 'مرحله بعدی تصویب',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clauseId: currentTask.clauseId,
        companyId: currentTask.companyId
      };

      tasks.unshift(nextTask);
    }
    const nextStepSpec = matchedWorkflow.steps[nextStepNumber - 1];
    nextStepName = nextStepSpec?.nameFa || `گام ${nextStepNumber}`;
  } else {
    isFinalApproval = true;
    
    // Update Document Control record in QmsDatabase to APPROVED
    try {
      const docControlDb = QmsDatabase.selectAll(QmsDatabase.TABLES.DOCUMENT_CONTROL) || {};
      const docKeys = Object.keys(docControlDb);
      const matchedKey = docKeys.find(k => k === currentTask.documentId || docControlDb[k]?.docCode === currentTask.documentId);
      if (matchedKey) {
        const existingDoc = docControlDb[matchedKey];
        existingDoc.status = 'APPROVED';
        existingDoc.approvedBy = currentUser.fullName;
        existingDoc.approvedAt = new Date().toISOString();
        existingDoc.digitalSignature = userSig;
        QmsDatabase.writeRow(QmsDatabase.TABLES.DOCUMENT_CONTROL, matchedKey, existingDoc);
      }
    } catch (e) {
      console.error('Error updating document status in QmsDatabase:', e);
    }
  }

  saveWorkflowCartableTasks(tasks);

  // Notify Task-Workflow Observer of state update
  TaskWorkflowObserver.notify({
    taskId: currentTask.id,
    workflowId: currentTask.workflowId,
    documentType: currentTask.documentType,
    documentId: currentTask.documentId,
    documentTitle: currentTask.documentTitle,
    stepNumber: currentTask.stepNumber,
    totalSteps: currentTask.totalSteps,
    status: 'approved',
    approverUserId: currentUser.id,
    approverUserName: currentUser.fullName,
    comment,
    signatureData: userSig,
    updatedAt: currentTask.updatedAt
  });

  // Write Immutable Audit Log
  logSystemActivity(
    currentUser.username,
    currentUser.fullName,
    'WORKFLOW_STEP_APPROVE',
    `تصویب مرحله ${currentTask.stepNumber} مدرک کیفی`,
    `تایید و امضای دیجیتال مدرک "${currentTask.documentTitle}" (گام ${currentTask.stepNumber} از ${currentTask.totalSteps}) - نظر: ${comment}`,
    'iso9001_docs',
    currentTask.documentId,
    { status: 'pending', step: currentTask.stepNumber },
    { status: isFinalApproval ? 'APPROVED' : 'STEP_ADVANCED', step: currentTask.stepNumber }
  );

  return { success: true, isFinalApproval, nextStepName };
}

/**
 * Add a comment or tag to a Workflow Cartable Task
 */
export function addTaskComment(
  taskId: string,
  currentUser: User,
  comment: string,
  tag?: string
): boolean {
  if (!comment.trim()) return false;
  const tasks = getStoredWorkflowCartableTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return false;

  if (!task.comments) task.comments = [];
  task.comments.push({
    id: 'cmt-' + Date.now(),
    userId: currentUser.id,
    userName: currentUser.fullName,
    comment: comment.trim(),
    tag: tag || 'یادداشت کاربری',
    createdAt: new Date().toISOString()
  });

  if (tag && (!task.tags || !task.tags.includes(tag))) {
    if (!task.tags) task.tags = [];
    task.tags.push(tag);
  }

  task.updatedAt = new Date().toISOString();
  saveWorkflowCartableTasks(tasks);

  TaskWorkflowObserver.notify({
    taskId: task.id,
    workflowId: task.workflowId,
    documentType: task.documentType,
    documentId: task.documentId,
    documentTitle: task.documentTitle,
    stepNumber: task.stepNumber,
    totalSteps: task.totalSteps,
    status: task.status as any,
    comment: comment,
    updatedAt: task.updatedAt
  });

  return true;
}

/**
 * Reject a Workflow Step Task in Cartable -> Reverts to previous step or author with comments & tags
 */
export function rejectWorkflowCartableTask(
  taskId: string,
  currentUser: User,
  rejectionReason: string = 'عدم انطباق با الزامات استاندارد',
  roles: Role[] = [],
  workflows: Workflow[] = [],
  userTag?: string
): { success: boolean; revertedToStepName?: string } {
  const tasks = getStoredWorkflowCartableTasks();
  const currentTask = tasks.find(t => t.id === taskId);
  if (!currentTask) return { success: false };

  currentTask.status = 'rejected';
  currentTask.rejectionComment = rejectionReason;
  currentTask.approvedByUserId = currentUser.id;
  currentTask.approvedByUserName = currentUser.fullName;
  currentTask.updatedAt = new Date().toISOString();

  if (!currentTask.comments) currentTask.comments = [];
  currentTask.comments.push({
    id: 'cmt-' + Date.now(),
    userId: currentUser.id,
    userName: currentUser.fullName,
    comment: rejectionReason,
    tag: userTag || 'عدم پذیرش و عودت به گام قبل',
    createdAt: new Date().toISOString()
  });

  if (userTag) {
    if (!currentTask.tags) currentTask.tags = [];
    if (!currentTask.tags.includes(userTag)) currentTask.tags.push(userTag);
  }

  let revertedToStepName = 'ایجادکننده / گام اول';

  // If stepNumber > 1, revert to stepNumber - 1 and create or activate pending task for previous step
  if (currentTask.stepNumber > 1) {
    const prevStepNum = currentTask.stepNumber - 1;
    const parentWf = workflows.find(w => w.id === currentTask.workflowId || w.documentType === currentTask.documentType);
    const prevStepSpec = parentWf?.steps?.find(s => s.stepNumber === prevStepNum) || parentWf?.steps?.[prevStepNum - 1];
    const prevRoleId = prevStepSpec?.approverRoleId || currentTask.approverRoleId;
    const prevRole = roles.find(r => r.id === prevRoleId);

    revertedToStepName = prevStepSpec?.nameFa || prevStepSpec?.name || `گام ${prevStepNum}`;

    const prevTaskId = QmsDatabase.enforceUniqueTaskAssignmentKey({
      workflowId: currentTask.workflowId,
      documentType: currentTask.documentType,
      documentId: currentTask.documentId,
      stepNumber: prevStepNum,
      approverRoleId: prevRoleId
    });

    const existingPrevTask = tasks.find(t => t.id === prevTaskId);
    if (existingPrevTask) {
      existingPrevTask.status = 'pending';
      existingPrevTask.rejectionComment = `مرجوع شده از گام ${currentTask.stepNumber}: ${rejectionReason}`;
      existingPrevTask.updatedAt = new Date().toISOString();
      if (!existingPrevTask.comments) existingPrevTask.comments = [];
      existingPrevTask.comments.push({
        id: 'cmt-' + Date.now(),
        userId: currentUser.id,
        userName: currentUser.fullName,
        comment: `عودت داده شده از گام ${currentTask.stepNumber} جهت اصلاح: ${rejectionReason}`,
        tag: 'عودت جهت اصلاح',
        createdAt: new Date().toISOString()
      });
    } else {
      const newPrevTask: WorkflowCartableTask = {
        id: prevTaskId,
        workflowId: currentTask.workflowId,
        documentType: currentTask.documentType,
        documentId: currentTask.documentId,
        documentTitle: currentTask.documentTitle,
        stepNumber: prevStepNum,
        totalSteps: currentTask.totalSteps,
        stepName: prevStepSpec?.name || `Step ${prevStepNum}`,
        stepNameFa: prevStepSpec?.nameFa || `گام ${prevStepNum}`,
        approverRoleId: prevRoleId,
        approverRoleNameFa: prevRole?.nameFa || prevRole?.name || 'کمیته کیفی',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rejectionComment: `مرجوع شده از گام ${currentTask.stepNumber}: ${rejectionReason}`,
        clauseId: currentTask.clauseId,
        companyId: currentTask.companyId,
        comments: [{
          id: 'cmt-' + Date.now(),
          userId: currentUser.id,
          userName: currentUser.fullName,
          comment: `عودت داده شده از گام ${currentTask.stepNumber} جهت اصلاح: ${rejectionReason}`,
          tag: 'عودت جهت اصلاح',
          createdAt: new Date().toISOString()
        }],
        tags: userTag ? [userTag, 'مرجوعی'] : ['مرجوعی'],
        revertedFromStep: currentTask.stepNumber
      };
      tasks.unshift(newPrevTask);
    }
  }

  // Update Document Control record in QmsDatabase to REJECTED
  try {
    const docControlDb = QmsDatabase.selectAll(QmsDatabase.TABLES.DOCUMENT_CONTROL) || {};
    const docKeys = Object.keys(docControlDb);
    const matchedKey = docKeys.find(k => k === currentTask.documentId || docControlDb[k]?.docCode === currentTask.documentId);
    if (matchedKey) {
      const existingDoc = docControlDb[matchedKey];
      existingDoc.status = 'REJECTED';
      existingDoc.rejectionReason = rejectionReason;
      existingDoc.rejectedBy = currentUser.fullName;
      existingDoc.rejectedAt = new Date().toISOString();
      QmsDatabase.writeRow(QmsDatabase.TABLES.DOCUMENT_CONTROL, matchedKey, existingDoc);
    }
  } catch (e) {
    console.error('Error rejecting document status in QmsDatabase:', e);
  }

  saveWorkflowCartableTasks(tasks);

  // Notify Task-Workflow Observer of state update
  TaskWorkflowObserver.notify({
    taskId: currentTask.id,
    workflowId: currentTask.workflowId,
    documentType: currentTask.documentType,
    documentId: currentTask.documentId,
    documentTitle: currentTask.documentTitle,
    stepNumber: currentTask.stepNumber,
    totalSteps: currentTask.totalSteps,
    status: 'rejected',
    approverUserId: currentUser.id,
    approverUserName: currentUser.fullName,
    comment: rejectionReason,
    updatedAt: currentTask.updatedAt
  });

  // Write Immutable Audit Log
  logSystemActivity(
    currentUser.username,
    currentUser.fullName,
    'WORKFLOW_STEP_REJECT',
    `رد مدرک و درخواست اصلاح (عودت به ${revertedToStepName})`,
    `عدم تایید و عودت مدرک "${currentTask.documentTitle}" به ${revertedToStepName} - علت رد: ${rejectionReason}`,
    'iso9001_docs',
    currentTask.documentId,
    { status: 'pending', step: currentTask.stepNumber },
    { status: 'REJECTED', step: currentTask.stepNumber, revertedTo: revertedToStepName, comment: rejectionReason }
  );

  return { success: true, revertedToStepName };
}
