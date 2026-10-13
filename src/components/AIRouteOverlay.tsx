import React, { useState } from 'react';
import {
  Sparkles,
  Compass,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  Layers,
  ArrowRight,
  ShieldAlert,
  Plus,
  Check,
  Zap,
  RefreshCw,
  GitBranch,
  X,
  BookOpen,
  FileText,
  UserCheck
} from 'lucide-react';
import { RouteStep, WorkflowRoute, EventClassification } from '../types/aiNavigator';
import { Role } from './TeamManagementTypes';

interface AIRouteOverlayProps {
  classification: EventClassification;
  routes: WorkflowRoute[];
  activeRouteId: string;
  onSelectRoute: (routeId: string) => void;
  roles: Role[];
  onAdoptStep: (step: RouteStep) => void;
  isRecalculating?: boolean;
  isRtl: boolean;
  selectedEventName: string;
}

export function AIRouteOverlay({
  classification,
  routes,
  activeRouteId,
  onSelectRoute,
  roles,
  onAdoptStep,
  isRecalculating = false,
  isRtl,
  selectedEventName
}: AIRouteOverlayProps) {
  const [inspectedStep, setInspectedStep] = useState<RouteStep | null>(null);

  const activeRoute = routes.find(r => r.id === activeRouteId) || routes[0];

  if (!activeRoute) return null;

  return (
    <div className="bg-[#121216] border border-[#27272f] rounded-2xl p-4 shadow-2xl space-y-4 relative overflow-hidden">
      
      {/* Top Header & Event Auto-Classification Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#18181f] border border-[#2d2d38] p-3.5 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 shrink-0 mt-0.5">
            <Compass size={18} className="animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest font-mono">
                {isRtl ? 'راهبر هوشمند گردش کار (AI WORKFLOW NAVIGATOR)' : 'AI WORKFLOW NAVIGATOR'}
              </span>
              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[9px] font-bold font-mono">
                {classification.confidence}% {isRtl ? 'اطمینان' : 'Confidence'}
              </span>
              {classification.primaryClauseId && (
                <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded text-[9px] font-bold font-mono">
                  IATF {classification.primaryClauseId}
                </span>
              )}
            </div>
            
            <h4 className="text-xs font-black text-white mt-1 flex items-center gap-1.5">
              <span>{isRtl ? 'نوع رویداد موشکافی‌شده:' : 'Detected Event Type:'}</span>
              <span className="text-amber-300 underline underline-offset-4 decoration-amber-500/40">
                {isRtl ? classification.titleFa : classification.titleEn}
              </span>
            </h4>
            
            <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
              {isRtl ? classification.reasonFa : classification.reasonEn}
            </p>
          </div>
        </div>

        {/* Non-blocking recalculation indicator */}
        <div className="flex items-center gap-2 self-start ml-auto">
          {isRecalculating ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[9px] font-bold text-amber-400 animate-pulse">
              <RefreshCw size={11} className="animate-spin" />
              <span>{isRtl ? 'در حال بازپردازش هوشمند مسیر...' : 'Recalculating Route...'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[9px] font-bold text-emerald-400 font-mono">
              <Sparkles size={11} />
              <span>{isRtl ? 'مسیر بهینه‌سازی شد' : 'Optimal Route Live'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Google-Maps Style Route Presets Switcher */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
            <GitBranch size={13} className="text-amber-500" />
            <span>{isRtl ? 'انتخاب مسیر پیشنهادی (مشابه نقشه راه هوشمند)' : 'Select Route Strategy'}</span>
          </span>
          <span className="text-[9px] font-mono text-zinc-500">
            {activeRoute.existingCount}/{activeRoute.totalSteps} {isRtl ? 'مرحله موجود' : 'steps present'} ({activeRoute.coverageScore}% {isRtl ? 'پوشش' : 'coverage'})
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {routes.map((route) => {
            const isSelected = route.id === activeRouteId;
            return (
              <button
                key={route.id}
                type="button"
                onClick={() => onSelectRoute(route.id)}
                className={`p-3 rounded-xl border transition-all text-right cursor-pointer flex flex-col justify-between gap-2 relative overflow-hidden ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/40 text-white shadow-lg shadow-amber-500/5'
                    : 'bg-[#16161b] hover:bg-[#1c1c23] border-[#292933] text-zinc-400'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-[9.5px] font-black font-mono px-1.5 py-0.5 rounded ${
                      route.type === 'PRIMARY' 
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : route.type === 'ALTERNATIVE'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}>
                      {route.type === 'PRIMARY' ? (isRtl ? 'اصلی IATF' : 'Primary') : route.type === 'ALTERNATIVE' ? (isRtl ? 'مهار سریع' : 'Fast-Track') : (isRtl ? 'مینیمال' : 'Minimal')}
                    </span>
                    {route.missingCount > 0 && (
                      <span className="text-[8.5px] font-extrabold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded">
                        {route.missingCount} {isRtl ? 'گپ' : 'gap(s)'}
                      </span>
                    )}
                  </div>
                  <h5 className="text-[11px] font-black text-white leading-tight">
                    {isRtl ? route.titleFa : route.titleEn}
                  </h5>
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[9px] font-mono text-zinc-400">
                  <span>{route.totalSteps} {isRtl ? 'گام زنجیره' : 'steps'}</span>
                  <span className="text-amber-400 font-bold">{route.coverageScore}% {isRtl ? 'تکمیل' : 'covered'}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual Canvas Route Overlay Map */}
      <div className="bg-[#0b0b0e] border border-[#212128] rounded-xl p-4 space-y-3 relative overflow-hidden" dir="ltr">
        <div className="flex justify-between items-center border-b border-white/5 pb-2 text-[10px] font-bold text-zinc-400">
          <span className="flex items-center gap-1.5 text-amber-400 font-mono">
            <Layers size={13} />
            <span>AI RECOMMENDED ROUTE MAP ON CANVAS</span>
          </span>
          <span className="text-[9px] text-zinc-500 font-mono">Click step node to inspect why & adopt</span>
        </div>

        {/* Route Flow Node Chain */}
        <div className="flex flex-wrap items-center gap-2.5 py-2">
          
          {/* START NODE: Event Entity */}
          <div className="px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-300 font-black text-[10px] flex items-center gap-1.5 shrink-0 shadow-md">
            <Zap size={12} className="text-amber-400 shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-[8px] text-amber-500 uppercase font-mono font-normal">EVENT START</span>
              <span className="font-bold truncate max-w-[120px]">{selectedEventName || 'Selected Event'}</span>
            </div>
          </div>

          {/* ROUTE STEP NODES */}
          {activeRoute.steps.map((step, sIdx) => {
            const isInspected = inspectedStep?.id === step.id;
            const role = roles.find(r => r.id === step.proposedRoleId);
            const roleLabel = role ? (isRtl ? role.nameFa : role.name) : 'Authorized Role';

            return (
              <React.Fragment key={step.id}>
                <ChevronRight size={14} className="text-zinc-650 shrink-0" />
                
                <button
                  type="button"
                  onClick={() => setInspectedStep(step)}
                  className={`px-3 py-2 rounded-xl border transition-all cursor-pointer flex flex-col items-start text-left shrink-0 relative group shadow-sm ${
                    isInspected
                      ? 'bg-amber-500/20 border-amber-400 text-white ring-2 ring-amber-500/30 scale-105'
                      : step.status === 'Existing'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/20'
                      : step.status === 'Missing'
                      ? 'bg-rose-500/10 border-rose-500/30 border-dashed text-rose-200 hover:bg-rose-500/20'
                      : 'bg-[#181820] border-[#31313d] text-zinc-200 hover:bg-[#20202a]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 w-full justify-between mb-0.5">
                    <span className="text-[8px] font-mono font-black px-1 rounded bg-black/40 text-zinc-400">
                      #{step.stepNumber}
                    </span>
                    <span className={`text-[8px] font-black font-mono px-1.5 py-0.2 rounded ${
                      step.status === 'Existing'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : step.status === 'Missing'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {step.status}
                    </span>
                  </div>

                  <span className="text-[10px] font-black text-zinc-100 max-w-[130px] truncate">
                    {isRtl ? step.nameFa : step.name}
                  </span>
                  
                  <span className="text-[8.5px] font-mono text-zinc-400 max-w-[120px] truncate">
                    {roleLabel}
                  </span>

                  {step.clauseId && (
                    <span className="text-[7.5px] font-mono font-bold text-amber-400 mt-0.5">
                      IATF {step.clauseId}
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}

          {/* DESTINATION GOAL NODE */}
          <ChevronRight size={14} className="text-zinc-650 shrink-0" />
          <div className="px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 font-black text-[10px] flex items-center gap-1.5 shrink-0 shadow-md">
            <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-[8px] text-emerald-500 uppercase font-mono font-normal">GOAL DESTINATION</span>
              <span className="font-bold">{isRtl ? 'بستن کامل پرونده کیفی' : 'Zero Recurrence Sign-off'}</span>
            </div>
          </div>

        </div>

        {/* Identified Gaps Alert inside canvas */}
        {activeRoute.gapsFa.length > 0 && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg text-[10px] text-rose-300 flex items-start gap-2" dir={isRtl ? 'rtl' : 'ltr'}>
            <ShieldAlert size={14} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-rose-200">
                {isRtl ? 'گپ‌های شناسایی شده در گردش کار فعلی:' : 'Workflow Gaps Identified:'}
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-rose-300/90 text-[9.5px]">
                {isRtl ? activeRoute.gapsFa.map((g, i) => <li key={i}>{g}</li>) : activeRoute.gapsEn.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Step Inspection Contextual Popover / Side Drawer */}
      {inspectedStep && (
        <div className="bg-[#181820] border border-amber-500/30 rounded-xl p-4 space-y-3.5 animate-in fade-in duration-150 relative">
          <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black font-mono rounded">
                STEP #{inspectedStep.stepNumber} INSPECTION
              </span>
              <h5 className="text-xs font-black text-white">
                {isRtl ? inspectedStep.nameFa : inspectedStep.name}
              </h5>
            </div>
            <button
              type="button"
              onClick={() => setInspectedStep(null)}
              className="p-1 hover:bg-white/10 text-zinc-400 rounded-lg cursor-pointer transition-all"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10.5px]">
            <div className="bg-[#121217] p-3 rounded-xl border border-zinc-800 space-y-2">
              <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider block">
                {isRtl ? 'علت پیشنهاد AI (چرا این گام؟):' : 'AI Recommendation Rationale:'}
              </span>
              <p className="text-zinc-300 leading-relaxed">
                {isRtl ? inspectedStep.whyFa : inspectedStep.whyEn}
              </p>
              {inspectedStep.clauseId && (
                <div className="pt-1 flex items-center gap-1.5 text-amber-400 font-mono text-[9.5px] font-bold">
                  <BookOpen size={12} />
                  <span>{isRtl ? `بند مرجع استاندارد: IATF ${inspectedStep.clauseId}` : `Reference: IATF Clause ${inspectedStep.clauseId}`}</span>
                </div>
              )}
            </div>

            <div className="bg-[#121217] p-3 rounded-xl border border-zinc-800 space-y-2">
              <div className="flex justify-between items-center text-[9.5px]">
                <span className="text-zinc-500">{isRtl ? 'موجودیت تحت‌تاثیر:' : 'Affected Entity:'}</span>
                <span className="font-bold text-zinc-200">{isRtl ? inspectedStep.affectedEntityFa : inspectedStep.affectedEntity}</span>
              </div>
              <div className="flex justify-between items-center text-[9.5px]">
                <span className="text-zinc-500">{isRtl ? 'نقش پیشنهادی تصویب:' : 'Proposed Role:'}</span>
                <span className="font-bold text-amber-400 font-mono">
                  {roles.find(r => r.id === inspectedStep.proposedRoleId)?.nameFa || inspectedStep.proposedRoleId}
                </span>
              </div>
              <div className="border-t border-zinc-800/80 pt-2 text-[9.5px] space-y-1">
                <div className="flex justify-between text-zinc-400">
                  <span>{isRtl ? 'ورودی انتظار می‌رود:' : 'Expected Input:'}</span>
                  <span className="text-zinc-300">{inspectedStep.expectedInputFa}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>{isRtl ? 'خروجی تولید می‌شود:' : 'Expected Output:'}</span>
                  <span className="text-zinc-300">{inspectedStep.expectedOutputFa}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action to adopt this step into actual user workflow */}
          <div className="flex justify-end gap-2 pt-1 border-t border-white/5">
            {inspectedStep.status === 'Existing' ? (
              <div className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <Check size={14} className="stroke-[3]" />
                <span>{isRtl ? 'این مرحله قبلاً در گردش کار شما گنجانده شده است' : 'Step Already Included in Workflow'}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onAdoptStep(inspectedStep);
                  setInspectedStep(null);
                }}
                className="bg-amber-500 hover:bg-amber-600 text-black font-black px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/10"
              >
                <Plus size={14} className="stroke-[3]" />
                <span>{isRtl ? 'افزودن این گام پیشنهادی به گردش کار من' : 'Adopt Recommended Step into Workflow'}</span>
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
