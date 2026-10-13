import React, { useState, useMemo } from 'react';
import { 
  Network, Plus, Trash2, Edit2, Check, X, Shield, ChevronDown, 
  ChevronRight, Building, MapPin, Layers, Briefcase, Award, Folder
} from 'lucide-react';
import { OrgUnit } from './TeamManagementTypes';

interface TeamManagementOrgStructureProps {
  lang: 'fa' | 'en';
  orgUnits: OrgUnit[];
  onAddUnit: (unit: Omit<OrgUnit, 'id'>) => void;
  onUpdateUnit: (id: string, name: string, nameFa: string) => void;
  onDeleteUnit: (id: string) => void;
  isRtl: boolean;
}

export function TeamManagementOrgStructure({
  lang,
  orgUnits,
  onAddUnit,
  onUpdateUnit,
  onDeleteUnit,
  isRtl
}: TeamManagementOrgStructureProps) {

  // --- UI State ---
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [newName, setNewName] = useState('');
  const [newNameFa, setNewNameFa] = useState('');
  const [newType, setNewType] = useState<OrgUnit['type']>('site');
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameFa, setEditNameFa] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'org-root': true // Root is expanded by default
  });

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  // Organize nested structures based on parentId
  const nestedStructure = useMemo(() => {
    const rootNodes: OrgUnit[] = orgUnits.filter(u => !u.parentId || u.parentId === 'org-root');
    const getChildrenOf = (parentId: string): any[] => {
      return orgUnits
        .filter(u => u.parentId === parentId)
        .map(u => ({
          ...u,
          children: getChildrenOf(u.id)
        }));
    };

    return rootNodes.map(r => ({
      ...r,
      children: getChildrenOf(r.id)
    }));
  }, [orgUnits]);

  const handleAddUnitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newNameFa) return;

    onAddUnit({
      type: newType,
      name: newName.trim(),
      nameFa: newNameFa.trim(),
      parentId: selectedParentId || 'org-root',
      companyId: 'company-primary'
    });

    setNewName('');
    setNewNameFa('');
    setSelectedParentId('');
  };

  const handleStartEdit = (unit: OrgUnit) => {
    setEditingUnitId(unit.id);
    setEditName(unit.name);
    setEditNameFa(unit.nameFa);
  };

  const handleSaveEdit = (id: string) => {
    if (!editName || !editNameFa) return;
    onUpdateUnit(id, editName, editNameFa);
    setEditingUnitId(null);
  };

  // Icon Helper for Org Unit Types
  const getUnitIcon = (type: OrgUnit['type']) => {
    switch (type) {
      case 'company': return <Building size={14} className="text-amber-500" />;
      case 'site': return <MapPin size={14} className="text-teal-400" />;
      case 'plant': return <Folder size={14} className="text-blue-400" />;
      case 'department': return <Layers size={14} className="text-purple-400" />;
      case 'team': return <Award size={14} className="text-indigo-400" />;
      case 'position': return <Briefcase size={14} className="text-orange-400" />;
      default: return <Folder size={14} className="text-zinc-400" />;
    }
  };

  // Recursive Tree Node Renderer
  const renderTreeNode = (node: any, level: number = 0) => {
    const isExpanded = expandedNodes[node.id];
    const hasChildren = node.children && node.children.length > 0;
    const isEditing = editingUnitId === node.id;

    return (
      <div key={node.id} className="space-y-1">
        
        {/* Node Label Row */}
        <div 
          style={{ paddingRight: isRtl ? `${level * 18 + 12}px` : undefined, paddingLeft: !isRtl ? `${level * 18 + 12}px` : undefined }}
          className="group flex items-center justify-between py-2 px-3 hover:bg-white/[0.02] rounded-xl transition-all border border-transparent hover:border-zinc-800/40"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Collapse Toggle Arrow */}
            {hasChildren ? (
              <button 
                type="button"
                onClick={() => toggleNode(node.id)}
                className="text-zinc-500 hover:text-white p-0.5 rounded cursor-pointer"
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            ) : (
              <span className="w-4.5" />
            )}

            {/* Type Icon */}
            <span className="p-1 bg-zinc-900 border border-zinc-850 rounded-lg shrink-0">
              {getUnitIcon(node.type)}
            </span>

            {/* Title / Form */}
            {isEditing ? (
              <div className="flex gap-2 items-center flex-1 max-w-md">
                <input
                  type="text"
                  value={editNameFa}
                  onChange={(e) => setEditNameFa(e.target.value)}
                  className="bg-[#141418] border border-amber-500/30 text-xs px-2 py-1 rounded text-white w-1/2 outline-none"
                  placeholder="نام فارسی"
                />
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-[#141418] border border-amber-500/30 text-xs px-2 py-1 rounded text-white w-1/2 outline-none font-mono"
                  placeholder="English name"
                />
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs truncate">
                <span className="font-extrabold text-zinc-200">{isRtl ? node.nameFa : node.name}</span>
                {node.name !== node.nameFa && (
                  <span className="text-[10px] text-zinc-500 font-mono">({isRtl ? node.name : node.nameFa})</span>
                )}
                <span className="text-[8px] uppercase font-black text-zinc-600 bg-zinc-900 border border-zinc-850 px-1.5 py-0.2 rounded">
                  {node.type}
                </span>
              </div>
            )}
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => handleSaveEdit(node.id)}
                  className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded cursor-pointer"
                >
                  <Check size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUnitId(null)}
                  className="p-1 text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer"
                >
                  <X size={12} />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setNewType(
                      node.type === 'site' ? 'plant' :
                      node.type === 'plant' ? 'department' :
                      node.type === 'department' ? 'team' : 'position'
                    );
                    setSelectedParentId(node.id);
                  }}
                  className="p-1 text-amber-500 hover:bg-amber-500/10 rounded cursor-pointer"
                  title={isRtl ? 'افزودن زیرمجموعه' : 'Add Child Node'}
                >
                  <Plus size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => handleStartEdit(node)}
                  className="p-1 text-zinc-400 hover:text-white hover:bg-white/5 rounded cursor-pointer"
                  title={isRtl ? 'ویرایش بند' : 'Edit Node'}
                >
                  <Edit2 size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmModal({
                      isOpen: true,
                      title: isRtl ? '🗑️ حذف بخش سازمانی' : '🗑️ Delete Org Unit',
                      message: isRtl ? `آیا از حذف "${node.nameFa}" و تمام زیربخش‌های آن مطمئن هستید؟` : `Are you sure you want to delete "${node.name}" and all its sub-units?`,
                      onConfirm: () => {
                        onDeleteUnit(node.id);
                        setConfirmModal(prev => ({ ...prev, isOpen: false }));
                      }
                    });
                  }}
                  className="p-1 text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer"
                  title={isRtl ? 'حذف بند' : 'Delete Node'}
                >
                  <Trash2 size={11} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Children Render Block */}
        {hasChildren && isExpanded && (
          <div className="border-r border-zinc-800/60 mr-4 ml-0 rtl:border-r ltr:border-l ltr:ml-4 ltr:mr-0 pl-1.5 pr-0.5 space-y-1">
            {node.children.map((child: any) => renderTreeNode(child, level + 1))}
          </div>
        )}

      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Left/Middle Column: Org Chart Hierarchy Tree View */}
        <div className="lg:col-span-3 bg-[#121215] border border-[#232326] rounded-2xl p-5 shadow-xl">
          <div className="flex justify-between items-center border-b border-white/5 pb-3.5 mb-4">
            <h3 className="text-xs font-black text-white flex items-center gap-2">
              <Network size={14} className="text-amber-500" />
              <span>{isRtl ? 'نمودار درختی ساختار سازمانی' : 'Corporate Org Structure Tree'}</span>
            </h3>
            <span className="text-[9px] font-black text-[#555] font-mono uppercase tracking-widest">{isRtl ? 'تعاملی' : 'INTERACTIVE'}</span>
          </div>

          <p className="text-[10px] text-zinc-500 mb-4 leading-relaxed">
            {isRtl 
              ? 'با کلیک بر روی نماد مثبت هر گره، می‌توانید به راحتی ساختار سازمانی را گسترش دهید. تمامی تغییرات ثبت‌شده فوراً در فرم‌های تخصیص کاربر در دسترس خواهند بود.'
              : 'Add, structure, and edit corporate divisions. Changes propagate globally into user profiles.'}
          </p>

          <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar pr-1 bg-black/10 p-3 rounded-xl border border-zinc-900">
            {nestedStructure.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 text-xs italic">
                {isRtl ? 'ساختار سازمانی خالی است! لطفاً اولین دپارتمان را از فرم روبرو بسازید.' : 'Organization chart is empty.'}
              </div>
            ) : (
              nestedStructure.map(rootNode => renderTreeNode(rootNode))
            )}
          </div>
        </div>

        {/* Right Column: Add Org Node Form */}
        <div className="lg:col-span-2 bg-[#121215] border border-[#232326] rounded-2xl p-5 shadow-xl self-start">
          <h3 className="text-xs font-black text-white flex items-center gap-2 border-b border-white/5 pb-3.5 mb-4">
            <Plus size={14} className="text-amber-500" />
            <span>{isRtl ? 'ثبت گره سازمانی جدید' : 'Register New Organizational Unit'}</span>
          </h3>

          <form onSubmit={handleAddUnitSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 mb-1">{isRtl ? 'عنوان فارسی گره' : 'Persian Title'}</label>
              <input
                type="text"
                value={newNameFa}
                onChange={(e) => setNewNameFa(e.target.value)}
                required
                placeholder={isRtl ? 'مثال: معاونت کیفیت، کارخانه شماره ۲' : 'Example: Quality Dept'}
                className="w-full bg-[#141418] border border-[#252529] focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 mb-1">{isRtl ? 'عنوان انگلیسی گrep' : 'English Title (System Identifier)'}</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                placeholder="Example: Quality Management Dept"
                className="w-full bg-[#141418] border border-[#252529] focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1">{isRtl ? 'نوع واحد سازمانی' : 'Unit Type'}</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full bg-[#141418] border border-[#252529] focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                >
                  <option value="site">{isRtl ? 'سایت اصلی' : 'Site'}</option>
                  <option value="plant">{isRtl ? 'کارخانه (Plant)' : 'Plant'}</option>
                  <option value="department">{isRtl ? 'دپارتمان / واحد' : 'Department'}</option>
                  <option value="team">{isRtl ? 'تیم کاری / بخش' : 'Team / Unit'}</option>
                  <option value="position">{isRtl ? 'پست سازمانی' : 'Job Position'}</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1">{isRtl ? 'والد (بخش بالاسری)' : 'Parent Unit'}</label>
                <select
                  value={selectedParentId}
                  onChange={(e) => setSelectedParentId(e.target.value)}
                  className="w-full bg-[#141418] border border-[#252529] focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                >
                  <option value="">{isRtl ? 'ریشه اصلی (بدون والد)' : 'Root (No parent)'}</option>
                  {orgUnits.map(unit => (
                    <option key={unit.id} value={unit.id}>
                      [{unit.type.toUpperCase()}] {isRtl ? unit.nameFa : unit.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-black py-2.5 rounded-xl text-xs font-black transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              <Plus size={14} className="stroke-[3]" />
              <span>{isRtl ? 'افزودن گره به چارت سازمانی' : 'Commit Node to Corporate Chart'}</span>
            </button>
          </form>

        </div>

      </div>

      {/* Custom Confirmation Dialog Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 text-right" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#0F0F12] border border-[#27272C] rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150 font-sans">
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
                className="bg-red-500 hover:bg-red-650 text-white px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg"
              >
                {isRtl ? 'تأیید' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
