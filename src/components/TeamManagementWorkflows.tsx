import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Check, X, Shield, ChevronRight, Settings, Info, Play, Compass, RefreshCw, Inbox
} from 'lucide-react';
import { Role, Workflow, WorkflowStep } from './TeamManagementTypes';
import { documentTemplates } from '../data/documentTemplates';
import { AIRouteOverlay } from './AIRouteOverlay';
import { classifyEvent, calculateWorkflowRoutes } from '../lib/aiWorkflowNavigator';
import { EventClassification, WorkflowRoute, RouteStep } from '../types/aiNavigator';
import { syncConfiguredWorkflowsToCartable, getStoredWorkflowCartableTasks } from '../lib/workflowCartableSync';

interface TeamManagementWorkflowsProps {
  lang: 'fa' | 'en';
  roles: Role[];
  workflows: Workflow[];
  onAddWorkflow: (wf: Omit<Workflow, 'id'>) => void;
  onDeleteWorkflow: (id: string) => void;
  isRtl: boolean;
}

export function TeamManagementWorkflows({
  lang,
  roles,
  workflows,
  onAddWorkflow,
  onDeleteWorkflow,
  isRtl
}: TeamManagementWorkflowsProps) {

  // List of unique document types available in the system
  const documentTypes = Object.keys(documentTemplates);

  // Form State
  const [selectedDocType, setSelectedDocType] = useState('');
  const [steps, setSteps] = useState<WorkflowStep[]>([
    { stepNumber: 1, name: 'Initial Verification', nameFa: 'کمیته بازبینی اولیه', approverRoleId: '' }
  ]);

  // AI Workflow Navigator State
  const [aiClassification, setAiClassification] = useState<EventClassification>(() => classifyEvent('', lang));
  const [aiRoutes, setAiRoutes] = useState<WorkflowRoute[]>(() => calculateWorkflowRoutes('', [], roles, lang));
  const [activeRouteId, setActiveRouteId] = useState<string>('route-primary');
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);

  // Automatic AI Recalculation Effect (Triggers on Event, Steps, or Roles change)
  useEffect(() => {
    setIsRecalculating(true);
    const timer = setTimeout(() => {
      const classification = classifyEvent(selectedDocType, lang);
      const computedRoutes = calculateWorkflowRoutes(selectedDocType, steps, roles, lang);
      setAiClassification(classification);
      setAiRoutes(computedRoutes);
      setIsRecalculating(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [selectedDocType, steps, roles, lang]);

  // Sync workflows to task cartable in real time
  useEffect(() => {
    if (workflows.length > 0) {
      syncConfiguredWorkflowsToCartable(workflows, roles);
    }
  }, [workflows, roles]);

  const handleAdoptStep = (step: RouteStep) => {
    setSteps(prev => [
      ...prev,
      {
        stepNumber: prev.length + 1,
        name: step.name,
        nameFa: step.nameFa,
        approverRoleId: step.proposedRoleId || (roles[0]?.id || '')
      }
    ]);
  };

  const handleAddStep = () => {
    setSteps(prev => [
      ...prev,
      {
        stepNumber: prev.length + 1,
        name: `Step ${prev.length + 1}`,
        nameFa: `مرحله ${prev.length + 1}`,
        approverRoleId: ''
      }
    ]);
  };

  const handleRemoveStep = (idx: number) => {
    const updated = steps.filter((_, i) => i !== idx).map((s, i) => ({
      ...s,
      stepNumber: i + 1
    }));
    setSteps(updated);
  };

  const handleStepChange = (idx: number, field: keyof WorkflowStep, val: any) => {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocType || steps.some(s => !s.nameFa || !s.approverRoleId)) {
      alert(isRtl ? 'لطفاً تمامی فیلدهای مراحل و نقش تأییدکننده را کامل کنید.' : 'Please select document type and complete all steps.');
      return;
    }

    onAddWorkflow({
      documentType: selectedDocType,
      steps,
      companyId: 'company-primary'
    });

    // Reset Form
    setSelectedDocType('');
    setSteps([{ stepNumber: 1, name: 'Initial Verification', nameFa: 'کمیته بازبینی اولیه', approverRoleId: '' }]);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      
      {/* AI WORKFLOW NAVIGATOR EMBEDDED INTELLIGENCE LAYER */}
      <AIRouteOverlay
        classification={aiClassification}
        routes={aiRoutes}
        activeRouteId={activeRouteId}
        onSelectRoute={setActiveRouteId}
        roles={roles}
        onAdoptStep={handleAdoptStep}
        isRecalculating={isRecalculating}
        isRtl={isRtl}
        selectedEventName={selectedDocType || (isRtl ? 'تمام اسناد و رویدادهای کیفی' : 'All Quality Documents & Events')}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Left/Middle: Active Workflows */}
        <div className="lg:col-span-3 bg-[#121215] border border-[#232326] rounded-2xl p-5 shadow-xl">
          <div className="flex justify-between items-center border-b border-white/5 pb-3.5 mb-4">
            <h3 className="text-xs font-black text-white flex items-center gap-2">
              <Settings size={14} className="text-amber-500" />
              <span>{isRtl ? 'گردش کارهای فعال مدارک و الزامات سیستمی' : 'Configured Document Verification Workflows'}</span>
            </h3>
            <span className="text-[9px] font-black text-zinc-500 font-mono bg-[#1c1c20] px-2 py-0.5 rounded border border-zinc-800">{isRtl ? 'سیستمی' : 'WORKFLOWS'}</span>
          </div>

          <p className="text-[10px] text-zinc-500 mb-4 leading-relaxed">
            {isRtl 
              ? 'در این بخش مسیر چرخه تاییدات کیفی و تایید مدارک و اسناد ممیزی را بر مبنای نقش‌های سازمان تعریف می‌کنید. تغییر مدارک ابتدا به کارتابل این نقش‌ها رفته و پس از تصویب نهایی بر روی پایگاه داده اعمال می‌گردند.'
              : 'Configure custom multilevel workflow steps. Approvals route through role cartables before commit.'}
          </p>

          <div className="space-y-4 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
            {workflows.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 text-xs italic border border-dashed border-[#232326] rounded-2xl">
                {isRtl ? 'هیچ گردش کار اختصاصی در پورتال تنظیم نشده است (تاییدات پیش‌فرض فعال است).' : 'No active workflows configured. Default instant-approvals are active.'}
              </div>
            ) : (
              workflows.map((wf) => (
                <div key={wf.id} className="bg-[#18181c]/60 hover:bg-[#18181c]/90 border border-[#2c2c31] rounded-2xl p-4 transition-all flex flex-col justify-between gap-4 relative overflow-hidden">
                  
                  {/* Title Bar */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white">{wf.documentType}</span>
                        <span className="text-[9px] bg-amber-500/10 text-amber-400 font-extrabold px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
                          <Inbox size={10} />
                          <span>{isRtl ? 'هماهنگ با کارتابل' : 'Cartable Synced'}</span>
                        </span>
                      </div>
                      <span className="text-[9px] text-zinc-500 font-mono">ID: {wf.id}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          syncConfiguredWorkflowsToCartable([wf], roles);
                          alert(isRtl ? 'مراحل این گردش کار به صورت آنی به کارتابل نقش‌های مسئول ارسال شد.' : 'Workflow steps synced to Cartable.');
                        }}
                        className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-[9px] font-bold"
                        title={isRtl ? 'ارسال به کارتابل وظایف' : 'Sync to Cartable'}
                      >
                        <RefreshCw size={11} />
                        <span>{isRtl ? 'همگام‌سازی کارتابل' : 'Sync Cartable'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteWorkflow(wf.id)}
                        className="p-1.5 bg-rose-500/5 hover:bg-rose-500/15 text-rose-400 border border-rose-500/10 hover:border-rose-500/20 rounded-xl transition-all cursor-pointer"
                        title={isRtl ? 'حذف گردش کار' : 'Delete'}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Flow Map Visual representation */}
                  <div className="flex flex-wrap items-center gap-2 pt-1.5" dir="ltr">
                    <div className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[9.5px] font-bold text-zinc-400 shrink-0">
                      Draft
                    </div>
                    {wf.steps.map((step, sIdx) => {
                      const r = roles.find(role => role.id === step.approverRoleId);
                      const roleName = r ? (isRtl ? r.nameFa : r.name) : 'Unknown Role';
                      return (
                        <React.Fragment key={step.stepNumber}>
                          <ChevronRight size={12} className="text-zinc-650 shrink-0" />
                          <div className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[9.5px] font-bold text-amber-400 flex flex-col items-center shrink-0">
                            <span className="font-sans text-[10px] font-black text-zinc-200">{isRtl ? step.nameFa : step.name}</span>
                            <span className="text-[8.5px] text-zinc-500 font-mono">{roleName}</span>
                          </div>
                        </React.Fragment>
                      );
                    })}
                    <ChevronRight size={12} className="text-zinc-650 shrink-0" />
                    <div className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[9.5px] font-bold text-emerald-400 shrink-0">
                      Approved & Committed
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Add Workflow Form */}
        <div className="lg:col-span-2 bg-[#121215] border border-[#232326] rounded-2xl p-5 shadow-xl self-start">
          <h3 className="text-xs font-black text-white flex items-center gap-2 border-b border-white/5 pb-3.5 mb-4">
            <Plus size={14} className="text-amber-500" />
            <span>{isRtl ? 'طراحی گردش کار جدید مدارک' : 'Build Custom Verification Flow'}</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 mb-1">{isRtl ? 'انتخاب سند هدف ممیزی یا بند' : 'Select Target Document'}</label>
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
                required
                className="w-full bg-[#141418] border border-[#252529] focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
              >
                <option value="">{isRtl ? '-- انتخاب کنید --' : '-- Choose Type --'}</option>
                {documentTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Dynamic steps fields list */}
            <div className="space-y-3.5 border-t border-white/5 pt-3.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">{isRtl ? 'تعریف مراحل تاییدات' : 'FLOW APPROVAL STEPS'}</span>
                <button
                  type="button"
                  onClick={handleAddStep}
                  className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded text-[9px] font-bold border border-amber-500/20 cursor-pointer"
                >
                  + افزودن مرحله تصویب
                </button>
              </div>

              <div className="space-y-3 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                {steps.map((step, idx) => (
                  <div key={idx} className="bg-black/20 border border-zinc-900 p-3 rounded-xl space-y-2 relative">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-zinc-500 font-mono">STEP {step.stepNumber}</span>
                      {steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(idx)}
                          className="text-rose-400 hover:text-rose-300 text-[9px] font-bold cursor-pointer"
                        >
                          حذف مرحله
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <input
                          type="text"
                          required
                          value={step.nameFa}
                          onChange={(e) => handleStepChange(idx, 'nameFa', e.target.value)}
                          placeholder={isRtl ? 'عنوان فارسی مرحله تایید' : 'Persian Title'}
                          className="w-full bg-[#141418] border border-zinc-850 focus:border-amber-500 rounded-lg px-2.5 py-1 text-[10.5px] text-white outline-none"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          required
                          value={step.name}
                          onChange={(e) => handleStepChange(idx, 'name', e.target.value)}
                          placeholder="English Step Title"
                          className="w-full bg-[#141418] border border-zinc-850 focus:border-amber-500 rounded-lg px-2.5 py-1 text-[10.5px] text-white outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <select
                        required
                        value={step.approverRoleId}
                        onChange={(e) => handleStepChange(idx, 'approverRoleId', e.target.value)}
                        className="w-full bg-[#141418] border border-zinc-850 focus:border-amber-500 rounded-lg px-2.5 py-1 text-[10px] text-white outline-none cursor-pointer"
                      >
                        <option value="">{isRtl ? '-- انتخاب نقش تاییدکننده نهایی این مرحله --' : '-- Choose Approver Role --'}</option>
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>{isRtl ? r.nameFa : r.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-black py-2.5 rounded-xl text-xs font-black transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              <Check size={14} className="stroke-[3]" />
              <span>{isRtl ? 'ثبت و پیاده‌سازی نهایی گردش کار' : 'Activate Document Verification Flow'}</span>
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
