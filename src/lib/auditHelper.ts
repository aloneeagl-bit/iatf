/**
 * QMS Quality Audit & Incomplete Records Registry
 * Scans all tables, LocalStorage keys, and document schemas to detect blank or uncompleted fields/items.
 */

export interface AuditResults {
  strategicCount: number;
  riskCount: number;
  caCount: number; // Corrective actions
  processCount: number;
  total: number;
}

export function calculateIncompleteRecords(): AuditResults {
  let strategicCount = 0;
  let riskCount = 0;
  let caCount = 0;
  let processCount = 0;

  // 1. Audit Strategic Management Module
  try {
    const savedStratEval = localStorage.getItem('qms_strategic_evaluations');
    const rows = savedStratEval ? JSON.parse(savedStratEval) : [];
    
    // If the Strategic Deploys/Evaluations table is completely empty, there are no active strategic works requiring attention. 
    // Thus strategicCount should be 0, avoiding false-alarm warning badges.
    if (Array.isArray(rows) && rows.length > 0) {
      // Audit Strategic Evaluation Table rows for missing title or description
      for (const row of rows) {
        if (!row.title || row.title.trim() === '' || !row.desc || row.desc.trim() === '') {
          strategicCount++;
        }
      }

      // Only audit submenu links if there are active evaluations in progress
      const savedStratSubmenu = localStorage.getItem('iatf_strategic_submenu_items');
      if (savedStratSubmenu) {
        const submenuItems = JSON.parse(savedStratSubmenu);
        if (Array.isArray(submenuItems)) {
          for (const item of submenuItems) {
            // Optional/Unlinked submenu pages shouldn't trigger critical blocking alarms unless they are required.
            // Let's only count if the user customized/added custom submenu paths that lack linked documents.
            const isDefaultItem = ['1', '2', '3', '4', '5'].includes(item.id);
            if (!isDefaultItem && (!item.linkedDoc || item.linkedDoc.trim() === '')) {
              strategicCount++;
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error auditing strategic evaluations:', e);
  }

  // 2. Audit Risk & Opportunity Management Module
  try {
    const rawRisks = localStorage.getItem('iatf_draft_items_مدیریت ریسک و فرصت‌ها');
    if (rawRisks) {
      const items = JSON.parse(rawRisks);
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item.type === 'strategic_risk') {
            const isReplicated = item.id && item.id.startsWith('strat-eval-replicated-');
            if (isReplicated) {
              const isRiskPending = item.field1 && item.field1.trim() !== '' && (!item.field2 || item.field2.includes('[نیاز به') || item.field2.trim() === '');
              const isOppPending = item.field3 && item.field3.trim() !== '' && (!item.field4 || item.field4.includes('[نیاز به') || item.field4.trim() === '');
              if (isRiskPending || isOppPending) {
                riskCount++;
              }
            } else {
              if ((!item.field1 || item.field1.trim() === '') && (!item.field3 || item.field3.trim() === '')) {
                riskCount++;
              }
            }
          } else if (item.type === 'risk_and_opp') {
            // FMEA Process risk row
            if (!item.field1 || item.field1.trim() === '' || !item.field2 || item.field2.trim() === '') {
              riskCount++;
            }
          } else if (item.type === 'context') {
            // Process context/position board row
            if (!item.field1 || item.field1.trim() === '' || !item.field2 || item.field2.trim() === '') {
              riskCount++;
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error auditing risk module:', e);
  }

  // 3. Audit Corrective Action Plan CAPA (10.2.1)
  try {
    const storedNc = localStorage.getItem('qmsdb_v3_nc_items');
    if (storedNc) {
      const ncItems = JSON.parse(storedNc);
      if (Array.isArray(ncItems)) {
        for (const item of ncItems) {
          if (item && typeof item === 'object') {
            // OPEN corrective actions are flagged as needing completion (RCA or Permanent action)
            if (item.status === 'OPEN_CA' || item.status === 'OPEN_RCA') {
              caCount++;
            } else if (!item.description || item.description.trim() === '') {
              caCount++;
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error auditing corrective actions:', e);
  }

  // 4. Audit Business Processes (Turtle Cards)
  try {
    const rawProcesses = localStorage.getItem('iatf_draft_items_شناسنامه فرآیندها (Process Cards - Turtle)') ||
                         localStorage.getItem('iatf_draft_items_شناسنامه فرآیندها') ||
                         localStorage.getItem('iatf_draft_items_لاک‌پشتی فرایندها (Turtle Diagrams)');
    if (rawProcesses) {
      const processes = JSON.parse(rawProcesses);
      if (Array.isArray(processes)) {
        for (const p of processes) {
          if (p && typeof p === 'object') {
            // If a process lacks a name or standard clauses mapping
            if (!p.field1 || p.field1.trim() === '' || !p.clauseId || p.clauseId.trim() === '') {
              processCount++;
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error auditing processes:', e);
  }

  return {
    strategicCount,
    riskCount,
    caCount,
    processCount,
    total: strategicCount + riskCount + caCount + processCount
  };
}
