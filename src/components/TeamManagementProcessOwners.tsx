import React, { useState, useMemo } from 'react';
import { 
  Briefcase, Plus, Trash2, Check, X, AlertCircle, RefreshCw, 
  UserCheck, Sliders, ShieldAlert, BadgeAlert
} from 'lucide-react';
import { User, ProcessOwner } from './TeamManagementTypes';
import { generateProcessRequirementsMatrix } from '../lib/matrixGenerator';

interface TeamManagementProcessOwnersProps {
  lang: 'fa' | 'en';
  users: User[];
  processOwners: ProcessOwner[];
  onAddOwner: (owner: Omit<ProcessOwner, 'id'>) => void;
  onDeleteOwner: (id: string) => void;
  isRtl: boolean;
}

export function TeamManagementProcessOwners({
  lang,
  users,
  processOwners,
  onAddOwner,
  onDeleteOwner,
  isRtl
}: TeamManagementProcessOwnersProps) {

  // Load processes dynamically from standard Turtle Diagrams
  const activeProcesses = useMemo(() => {
    try {
      const matrix = generateProcessRequirementsMatrix() || [];
      return matrix.map(item => ({
        key: item.id || item.field1,
        name: (item.field1 || '').trim(),
        type: item.field2 || 'COPs',
        clauseId: item.clauseId || '4.4'
      }));
    } catch (e) {
      console.warn('Could not read matrix generator for process owners:', e);
      return [];
    }
  }, []);

  // UI state
  const [selectedProcessKey, setSelectedProcessKey] = useState('');
  const [selectedOwnerUserId, setSelectedOwnerUserId] = useState('');
  const [selectedBackupUserId, setSelectedBackupUserId] = useState('');

  const handleAddOwnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProcessKey || !selectedOwnerUserId) return;

    // Find process
    const proc = activeProcesses.find(p => p.key === selectedProcessKey);
    const procName = proc ? proc.name : selectedProcessKey;

    // Find owner user
    const ownerUser = users.find(u => u.id === selectedOwnerUserId);
    if (!ownerUser) return;

    // Find backup user
    const backupUser = users.find(u => u.id === selectedBackupUserId);

    onAddOwner({
      processKey: selectedProcessKey,
      processName: procName,
      ownerUserId: selectedOwnerUserId,
      ownerFullName: ownerUser.fullName,
      backupUserId: selectedBackupUserId || undefined,
      backupFullName: backupUser ? backupUser.fullName : undefined,
      companyId: ownerUser.companyId || 'company-primary'
    });

    setSelectedProcessKey('');
    setSelectedOwnerUserId('');
    setSelectedBackupUserId('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Middle: Process Owners Table */}
        <div className="lg:col-span-2 bg-[#121215] border border-[#232326] rounded-2xl p-5 shadow-xl">
          <div className="flex justify-between items-center border-b border-white/5 pb-3.5 mb-4">
            <h3 className="text-xs font-black text-white flex items-center gap-2">
              <UserCheck size={14} className="text-amber-500" />
              <span>{isRtl ? 'جدول مسئولیت و مالکین فرآیندها (Process Owners)' : 'Process Owners & Process Card Responsibility Matrix'}</span>
            </h3>
            <span className="text-[9px] font-black text-zinc-500 font-mono bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
              {isRtl ? 'بند ۴.۴ استاندارد' : 'IATF 4.4'}
            </span>
          </div>

          <p className="text-[10px] text-zinc-500 mb-4 leading-relaxed">
            {isRtl 
              ? 'در این جدول، فرآیندهای کسب و کار تعریف شده در «شناسنامه فرآیندها (کارت لاک‌پشتی)» به طور خودکار بارگذاری می‌شوند و شما مسئول اجرای فرآیند و همکار جانشین او را مشخص می‌کنید.'
              : 'Dynamic processes loaded from turtle diagrams. Assign process owners and alternative backups.'}
          </p>

          <div className="overflow-x-auto custom-scrollbar -mx-5 sm:mx-0">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#202023] bg-[#121215]/80 text-[#FAFAFA] font-black">
                  <th className="p-3">{isRtl ? 'فرآیند مربوطه' : 'Business Process'}</th>
                  <th className="p-3">{isRtl ? 'مالک فرآیند (اصلی)' : 'Process Owner'}</th>
                  <th className="p-3">{isRtl ? 'همکار جانشین (قائم‌مقام)' : 'Backup Owner'}</th>
                  <th className="p-3 text-center w-16">{isRtl ? 'حذف' : 'Delete'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {processOwners.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-xs text-zinc-500 italic">
                      {isRtl ? 'هیچ مالکی برای فرآیندها در سیستم ست نشده است.' : 'No process owners assigned.'}
                    </td>
                  </tr>
                ) : (
                  processOwners.map((po) => (
                    <tr key={po.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="font-extrabold text-zinc-200">{po.processName}</span>
                          <span className="text-[9px] text-zinc-500 font-mono">Key: {po.processKey}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 font-bold">
                          👤 {po.ownerFullName}
                        </span>
                      </td>
                      <td className="p-3 text-zinc-400 font-medium">
                        {po.backupFullName ? (
                          <span className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300">
                            👥 {po.backupFullName}
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-600 italic">{isRtl ? 'تعیین نشده' : 'None Assigned'}</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => onDeleteOwner(po.id)}
                          className="p-1 hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 rounded transition-all cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Assign Process Owner Form */}
        <div className="bg-[#121215] border border-[#232326] rounded-2xl p-5 shadow-xl self-start">
          <h3 className="text-xs font-black text-white flex items-center gap-2 border-b border-white/5 pb-3.5 mb-4">
            <Plus size={14} className="text-amber-500" />
            <span>{isRtl ? 'تخصیص مالک فرآیند جدید' : 'Assign New Process Owner'}</span>
          </h3>

          {activeProcesses.length === 0 ? (
            <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl text-amber-400 text-xs leading-relaxed flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p>
                {isRtl 
                  ? 'هیچ فرآیندی در شناسنامه فرآیندها (لاک‌پشتی) یافت نشد. لطفاً ابتدا فرآیندها را تعریف کنید تا تخصیص مالکین فعال شود.'
                  : 'Please define processes first in Turtle Diagrams to unlock owner assignments.'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleAddOwnerSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1">{isRtl ? 'فرآیند کار به روش لاک‌پشتی' : 'Select Process'}</label>
                <select
                  value={selectedProcessKey}
                  onChange={(e) => setSelectedProcessKey(e.target.value)}
                  required
                  className="w-full bg-[#141418] border border-[#252529] focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs text-white outline-none cursor-pointer"
                >
                  <option value="">{isRtl ? '-- فرآیند سازمان را انتخاب کنید --' : '-- Choose Process --'}</option>
                  {activeProcesses.map(p => (
                    <option key={p.key} value={p.key}>
                      [{p.type}] {p.name} ({p.clauseId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1">{isRtl ? 'مالک فرآیند (مسئول اصلی فرآیند)' : 'Process Owner (Primary)'}</label>
                <select
                  value={selectedOwnerUserId}
                  onChange={(e) => setSelectedOwnerUserId(e.target.value)}
                  required
                  className="w-full bg-[#141418] border border-[#252529] focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs text-white outline-none cursor-pointer"
                >
                  <option value="">{isRtl ? '-- انتخاب کاربر مسئول --' : '-- Choose User --'}</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} (@{u.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1">{isRtl ? 'همکار قائم‌مقام / جانشین (اختیاری)' : 'Backup Owner (Optional)'}</label>
                <select
                  value={selectedBackupUserId}
                  onChange={(e) => setSelectedBackupUserId(e.target.value)}
                  className="w-full bg-[#141418] border border-[#252529] focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs text-white outline-none cursor-pointer"
                >
                  <option value="">{isRtl ? '-- جانشین را انتخاب کنید --' : '-- Choose Backup --'}</option>
                  {users.filter(u => u.id !== selectedOwnerUserId).map(u => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} (@{u.username})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-black py-2.5 rounded-xl text-xs font-black transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-1.5 cursor-pointer mt-2"
              >
                <UserCheck size={14} />
                <span>{isRtl ? 'ثبت و تخصیص مالک فرآیند' : 'Assign Process Ownership'}</span>
              </button>
            </form>
          )}

        </div>

      </div>
    </div>
  );
}
