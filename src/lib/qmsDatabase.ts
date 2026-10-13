/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { documentTemplates } from '../data/documentTemplates';

// Simple structured Client-Side Database Engine Emulator conforming to ISO 9001 control workflows
// Provides direct CRUD transactions, detailed logging, backing up, seeding, and real-time schema tracking.

export interface DbTransaction {
  id: string;
  timestamp: string;
  type: 'INSERT' | 'UPDATE' | 'DELETE' | 'SELECT' | 'BACKUP' | 'RESTORE' | 'SCHEMA_MIGRATION' | 'SEED_DATABASE';
  tableName: 'documents_table' | 'document_control_table' | 'indicators_table' | 'clause_links_table' | 'records_table' | 'csr_mappings_table' | 'process_mappings_table' | 'kpi_vars_table' | 'db_system' | 'strategic_items_table' | 'strategic_evaluations_table' | 'strategic_threshold_matrix_table';
  rowId: string;
  outcome: 'SUCCESS' | 'WARNING' | 'FAILED';
  details: string;
}

export interface DatabaseRelation {
  foreignKey: string;
  referencedTable: string;
  referencedKey: string;
  descriptionFa: string;
  descriptionEn: string;
}

export interface DatabaseSchema {
  tableName: string;
  primaryKey: string;
  recordCount: number;
  descriptionFa: string;
  descriptionEn: string;
  columns: string[];
  relations?: DatabaseRelation[];
}

export class QmsDatabase {
  private static STORAGE_PREFIX = 'qmsdb_v3_';
  
  private static currentOrgId: string = '';
  private static currentProductId: string = '';

  /**
   * Sets the active tenant for subsequent database operations
   */
  public static setTenant(orgId: string, prodId: string) {
    this.currentOrgId = orgId;
    this.currentProductId = prodId;
  }

  /**
   * Archives a specific tenant's data before deletion
   */
  public static archiveTenantData(orgId: string, prodId: string, metadata: any) {
    try {
      const backup = this.exportFullSchemaJson(orgId, prodId);
      const archiveItem = {
        id: `archive_${Date.now()}`,
        orgId,
        prodId,
        metadata,
        timestamp: new Date().toISOString(),
        backupJson: backup
      };
      
      const archives = this.selectAll(this.TABLES.TENANT_ARCHIVE);
      archives[archiveItem.id] = archiveItem;
      this.writeAll(this.TABLES.TENANT_ARCHIVE, archives);
      
      this.logTransaction('BACKUP', 'db_system', 'ARCHIVE', 'SUCCESS', `Archived data for tenant: ${orgId}/${prodId}`);
      return archiveItem.id;
    } catch (e) {
      console.error('Archiving failed:', e);
      return null;
    }
  }

  /**
   * Restores a tenant from the archive
   */
  public static restoreFromArchive(archiveId: string) {
    try {
      const archives = this.selectAll(this.TABLES.TENANT_ARCHIVE);
      const item = archives[archiveId];
      if (!item || !item.backupJson) return false;
      
      return this.restoreFullSchemaJson(item.backupJson, item.orgId, item.prodId);
    } catch (e) {
      console.error('Restore from archive failed:', e);
      return false;
    }
  }

  /**
   * Retrieves the current active tenant
   */
  public static getTenant() {
    return {
      orgId: this.currentOrgId,
      prodId: this.currentProductId
    };
  }

  // Available tables configuration
  public static TABLES = {
    DOCUMENTS: 'documents_table',               // Keeps the content lists (DocItem[]) of edited template forms on the fly
    DOCUMENT_CONTROL: 'document_control_table', // Keeps ISO 9001 metadata profiles (Revision, Author, Releaser, Status)
    INDICATORS: 'indicators_table',             // Keeps KPI indicator metrics & period evaluation trends
    CLAUSE_LINKS: 'clause_links_table',         // Keeps lists of linked documents inside Standard Clauses
    RECORDS: 'records_table',                    // Keeps snapshot copies/archives of documents
    CSR_MAPPINGS: 'csr_mappings_table',         // Keeps CSR comparisons & mappings
    PROCESS_MAPPINGS: 'process_mappings_table', // Keeps Process-to-Clause manual reference mappings
    KPI_VARS: 'kpi_vars_table',                 // Keeps KPI global evaluation variables
    STRATEGIC_ITEMS: 'strategic_items_table',         // Keeps lists of strategic cards in table format
    STRATEGIC_EVALUATIONS: 'strategic_evaluations_table', // Keeps SWOT and other strategic evaluation rows
    STRATEGIC_THRESHOLD: 'strategic_threshold_matrix_table', // Keeps the 5x5 threshold matrix settings
    CORRECTIVE_ACTIONS: 'nc_items_table',        // Cape corrective actions and CAPA non-conformances
    WORKSTATIONS: 'workstations_db',             // Master Workstations & Operational Instructions DB
    TENANT_ARCHIVE: 'qms_tenant_archive'        // Store backups of deleted orgs/products
  } as const;

  /**
   * Translates virtual database table name into physical localStorage key name
   * Supports partitioning by organization and product.
   */
  public static getDbKey(tableName: string, orgId?: string, prodId?: string): string {
    const activeOrgId = orgId || this.currentOrgId;
    const activeProdId = prodId || this.currentProductId;

    // Certain tables are system-wide and should not be partitioned
    const isSystemTable = 
      tableName === 'system_logs' || 
      tableName === 'qmsdb_sync_config' || 
      tableName === 'qms_organizations' || 
      tableName === 'qms_products' || 
      tableName === 'qms_users' ||
      tableName === 'qms_tasks' ||
      tableName === 'qms_proposals' ||
      tableName === 'qms_tenant_archive';

    // Build the physical key with optional tenant scoping
    let keyName = tableName;

    // Special mappings for legacy or uniquely named tables
    if (tableName === 'nc_items_table' || tableName === 'qmsdb_v3_nc_items') {
      keyName = 'nc_items';
    } else if (tableName === 'strategic_evaluations_table' || tableName === 'qms_strategic_evaluations') {
      keyName = 'strategic_evaluations_table';
    } else if (tableName === 'strategic_items_table' || tableName === 'iatf_strategic_submenu_items') {
      keyName = 'strategic_items_table';
    }

    if (activeOrgId && activeProdId && !isSystemTable) {
      return `${this.STORAGE_PREFIX}${activeOrgId}_${activeProdId}_${keyName}`;
    }

    return `${this.STORAGE_PREFIX}${keyName}`;
  }

  /**
   * Converts our internal dictionary-style Record format to SQL standards: a flat Table Array of row objects.
   */
  public static serializeToSqlTable(tableName: string, recordSet: Record<string, any>): any[] {
    if (!recordSet || typeof recordSet !== 'object') return [];
    
    // Special handling for documents_table: format maps { "DocTitle": Item[] | QmsDocumentRecord } to list of { id, document_name, items, sections, lastUpdatedTime }
    if (tableName === this.TABLES.DOCUMENTS) {
      return Object.entries(recordSet).map(([docName, data]) => {
        const isLegacy = Array.isArray(data);
        return {
          id: docName,
          document_name: docName,
          items: isLegacy ? data : (data.items || []),
          sections: !isLegacy ? (data.sections || []) : [],
          lastUpdatedTime: !isLegacy && data.lastUpdatedTime ? data.lastUpdatedTime : Date.now()
        };
      });
    }
    
    // For other tables, they are dictionaries typically storing row objects.
    // E.g. { "row_id_1": { id: "row_id_1", field1: "val", ... } }
    return Object.entries(recordSet).map(([key, val]) => {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const idVal = val.id || val.row_id || val.rowId || val.indicator_id || val.clause_id || val.record_id || val.process_key || val.var_key || key;
        return {
          ...val,
          id: String(idVal)
        };
      } else {
        return {
          id: key,
          value: val
        };
      }
    });
  }

  /**
   * Converts a flat SQL Row-Array format back to our internal dictionary Record layout.
   */
  public static deserializeFromSqlTable(tableName: string, rowArray: any[]): Record<string, any> {
    const recordSet: Record<string, any> = {};
    if (!Array.isArray(rowArray)) {
      if (rowArray && typeof rowArray === 'object') return rowArray;
      return {};
    }
    
    if (tableName === this.TABLES.DOCUMENTS) {
      rowArray.forEach((row: any) => {
        if (row && typeof row === 'object') {
          const docName = row.document_name || row.id || '';
          if (docName) {
            // If it has sections, store the whole row object. 
            // If it only has items, store the items array for legacy compatibility.
            if (row.sections && row.sections.length > 0) {
              recordSet[docName] = row;
            } else {
              recordSet[docName] = Array.isArray(row.items) ? row.items : [];
            }
          }
        }
      });
      return recordSet;
    }
    
    rowArray.forEach((row: any) => {
      if (row && typeof row === 'object') {
        const key = row.id || row.row_id || row.rowId || row.indicator_id || row.clause_id || row.record_id || row.process_key || row.var_key || '';
        if (key) {
          if (row.value !== undefined && Object.keys(row).length === 2 && row.id !== undefined) {
            recordSet[key] = row.value;
          } else {
            recordSet[key] = row;
          }
        }
      }
    });
    return recordSet;
  }

  /**
   * Sync Configuration tools for cloud/local hosting and data centers
   */
  public static getSyncConfig() {
    try {
      const raw = localStorage.getItem('qmsdb_sync_config');
      if (raw) {
        const parsed = JSON.parse(raw);
        // Ensure cloud presets are initialized
        if (!parsed.gdrive) {
          parsed.gdrive = { accessToken: '', fileId: '', fileName: 'qms_database_store.json', clientId: '' };
        }
        if (!parsed.onedrive) {
          parsed.onedrive = { accessToken: '', fileId: '', fileName: 'qms_database_store.json', clientId: '' };
        }
        return parsed;
      }
    } catch {}
    
    let defaultUrl = '';
    try {
      defaultUrl = window.location.origin + '/api/qms-db-sync';
    } catch {
      defaultUrl = 'http://localhost:3000/api/qms-db-sync';
    }

    return {
      mode: 'integrated', // 'local' | 'integrated' | 'custom' | 'gdrive' | 'onedrive'
      url: defaultUrl,
      liveShell: true,
      gdrive: { accessToken: '', fileId: '', fileName: 'qms_database_store.json', clientId: '' },
      onedrive: { accessToken: '', fileId: '', fileName: 'qms_database_store.json', clientId: '' }
    };
  }

  public static saveSyncConfig(config: any) {
    try {
      localStorage.setItem('qmsdb_sync_config', JSON.stringify(config));
      this.logTransaction('SCHEMA_MIGRATION', 'db_system', 'SYNC_CONFIG', 'SUCCESS', `Updated data center link config: mode=${config.mode}, liveShell=${config.liveShell}`);
    } catch {}
  }

  public static triggerAutoPushIfLiveShell() {
    try {
      const config = this.getSyncConfig();
      
      // Dispatch browser custom event so the React component can handle real-time background cloud sync
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('qms-db-mutated', { detail: config }));
      }

      if (config.url) {
        const dumpStr = this.exportFullSchemaJson();
        const payload = { data: JSON.parse(dumpStr) };
        fetch(config.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(res => {
          if (res && res.success) {
            console.log('[QmsDatabase Sync Push] Database updated on host successfully');
          } else {
            console.warn('[QmsDatabase Sync Push] Server response status:', res ? res.error : 'Unknown status');
          }
        })
        .catch(err => {
          console.warn('[QmsDatabase Sync Push Error]', err);
        });
      }
    } catch (e) {
      console.warn('[QmsDatabase Sync exception]', e);
    }
  }

  /**
   * Safe execution callback to write transactions to log table
   */
  private static logTransaction(
    type: DbTransaction['type'],
    tableName: DbTransaction['tableName'],
    rowId: string,
    outcome: DbTransaction['outcome'],
    details: string
  ) {
    try {
      const logsKey = `${this.STORAGE_PREFIX}system_logs`;
      const curRaw = localStorage.getItem(logsKey);
      const logs: DbTransaction[] = curRaw ? JSON.parse(curRaw) : [];
      
      const newLog: DbTransaction = {
        id: `TX-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        timestamp: new Date().toISOString(),
        type,
        tableName,
        rowId,
        outcome,
        details
      };
      
      // Cap log entries to the latest 150 records to prevent LocalStorage overflows
      const nextLogs = [newLog, ...logs].slice(0, 150);
      localStorage.setItem(logsKey, JSON.stringify(nextLogs));
    } catch (e) {
      console.warn('DB Log writing failed:', e);
    }
  }

  /**
   * Retrieves all system logs
   */
  public static getSystemLogs(): DbTransaction[] {
    try {
      const logsKey = `${this.STORAGE_PREFIX}system_logs`;
      const raw = localStorage.getItem(logsKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Drops transactional logs safely
   */
  public static clearLogs() {
    try {
      localStorage.setItem(`${this.STORAGE_PREFIX}system_logs`, JSON.stringify([]));
    } catch {}
  }

  /**
   * Initializes the DB structure and migrates existing legacy app data if detected
   */
  public static initAndSynchronize(orgId?: string, prodId?: string) {
    const activeOrgId = orgId || this.currentOrgId;
    const activeProdId = prodId || this.currentProductId;

    this.logTransaction('SCHEMA_MIGRATION', 'db_system', 'INIT', 'SUCCESS', `Initializing Relational QMS-DB database (Tenant: ${activeOrgId || 'Global'}/${activeProdId || 'Global'})`);

    // Only run legacy migrations for the global tenant to avoid duplication
    if (!activeOrgId || !activeProdId) {
      // 1. Migrate custom documents (legacy iatf_docs -> documents_table)
      try {
        const legacyDocs = localStorage.getItem('iatf_docs');
        const dbDocs = localStorage.getItem(`${this.STORAGE_PREFIX}${this.TABLES.DOCUMENTS}`);
        if (legacyDocs && !dbDocs) {
          localStorage.setItem(`${this.STORAGE_PREFIX}${this.TABLES.DOCUMENTS}`, legacyDocs);
          this.logTransaction('SEED_DATABASE', 'documents_table', 'ALL', 'SUCCESS', 'Migrated legacy document content files safely to documents_table.');
        }
      } catch (e) {
        this.logTransaction('SCHEMA_MIGRATION', 'documents_table', 'ALL', 'FAILED', 'Failed migrating legacy documents.');
      }
      
      // ... (rest of legacy migrations)
    }

    // Ensure all defined QmsDatabase.TABLES keys are initialized as database tables (at least as JSON "[]" representing a clean empty SQL table), even if empty!
    try {
      Object.keys(this.TABLES).forEach((key) => {
        const tableName = this.TABLES[key as keyof typeof this.TABLES];
        const dbKey = this.getDbKey(tableName, activeOrgId, activeProdId);
        const existingVal = localStorage.getItem(dbKey);
        
        if (!existingVal) {
          localStorage.setItem(dbKey, JSON.stringify([]));
        }
      });
    } catch (e) {
      this.logTransaction('SCHEMA_MIGRATION', 'db_system', 'INIT_EMPTY_TABLES', 'FAILED', `Failed initializing empty tables: ${e}`);
    }

    // Ensure all standard and custom templates exist in the documents_table, empty or filled
    try {
      const dbKey = this.getDbKey(this.TABLES.DOCUMENTS, activeOrgId, activeProdId);
      const dbDocsRaw = localStorage.getItem(dbKey);
      let dbDocs: Record<string, any> = {};
      if (dbDocsRaw) {
        try {
          const parsed = JSON.parse(dbDocsRaw);
          dbDocs = Array.isArray(parsed) ? this.deserializeFromSqlTable(this.TABLES.DOCUMENTS, parsed) : parsed;
        } catch {}
      }
      
      // Seed all templates defined in standard documentTemplates
      Object.keys(documentTemplates).forEach((title) => {
        const cleanTitle = title.replace(/\s*\(ارجاع به بند.*\)/, '').trim();
        if (!dbDocs[cleanTitle]) {
          dbDocs[cleanTitle] = [];
        }
      });
      
      const sqlDocsArray = this.serializeToSqlTable(this.TABLES.DOCUMENTS, dbDocs);
      localStorage.setItem(dbKey, JSON.stringify(sqlDocsArray));
    } catch (e) {
      console.error('[QmsDatabase Seeding Custom/Standard Docs Exception]', e);
    }

    // Save factory restore points for all initialized tables if they don't already exist!
    try {
      Object.keys(this.TABLES).forEach((key) => {
        const tableName = this.TABLES[key as keyof typeof this.TABLES];
        const restoreTableKey = `factory_restore_table_${tableName}`;
        if (!localStorage.getItem(restoreTableKey)) {
          const currentData = this.selectAll(tableName, activeOrgId, activeProdId);
          if (currentData && Object.keys(currentData).length > 0) {
            localStorage.setItem(restoreTableKey, JSON.stringify(currentData));
          }
        }
      });
    } catch (err) {
      console.warn('Failed saving factory restore points for tables', err);
    }
  }

  /**
   * Retrieves all rows of a table as a Record or List helper
   */
  public static selectAll<T = any>(tableName: string, orgId?: string, prodId?: string): Record<string, T> {
    try {
      if (tableName.startsWith('doc_')) {
        const targetDoc = tableName.substring(4);
        const dbKey = this.getDbKey(this.TABLES.DOCUMENTS, orgId, prodId);
        const dbDocsRaw = localStorage.getItem(dbKey);
        if (dbDocsRaw) {
          const parsed = JSON.parse(dbDocsRaw);
          const dbDocs = Array.isArray(parsed) ? this.deserializeFromSqlTable(this.TABLES.DOCUMENTS, parsed) : parsed;
          const docRows = dbDocs[targetDoc] || [];
          const wrapped: Record<string, T> = {};
          docRows.forEach((item: any, index: number) => {
            if (item && typeof item === 'object') {
              const key = item.id || item.code || item.title || String(index);
              wrapped[key] = item;
            } else {
              wrapped[String(index)] = item as any;
            }
          });
          return wrapped;
        }
        return {};
      }

      const dbKey = this.getDbKey(tableName, orgId, prodId);
      let raw = localStorage.getItem(dbKey);
      
      let data = raw ? JSON.parse(raw) : [];
      
      // Auto-wrap SQL standard table array into internal dictionary records
      if (Array.isArray(data)) {
        return this.deserializeFromSqlTable(tableName, data) as Record<string, T>;
      }
      
      return data;
    } catch (e) {
      this.logTransaction('SELECT', tableName as any, 'ALL', 'FAILED', `Error reviewing database table columns: ${e}`);
      return {};
    }
  }

  /**
   * Retrieves a specific row/object key from a table
   */
  public static selectRow<T = any>(tableName: string, rowId: string, orgId?: string, prodId?: string): T | null {
    try {
      if (tableName.startsWith('doc_')) {
        const all = this.selectAll(tableName, orgId, prodId);
        if (all && all[rowId] !== undefined) {
          return all[rowId] as T;
        }
        return null;
      }

      let finalRowId = rowId;
      if (tableName === this.TABLES.DOCUMENTS) {
        const clean = rowId.replace(/\s*\(ارجاع به بند.*\)/, '').trim();
        if (
          clean === 'Risk and Opportunity Management' ||
          clean === 'Risk & Opportunity FMEA' ||
          clean === 'مدیریت ریسک‌ها و فرصت‌ها' ||
          clean === 'مدیریت ریسک و فرصت‌ها'
        ) {
          finalRowId = 'مدیریت ریسک و فرصت‌ها';
        } else {
          finalRowId = clean;
        }
      }
      const all = this.selectAll(tableName, orgId, prodId);
      if (all && all[finalRowId] !== undefined) {
        return all[finalRowId] as T;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Write or alter a row value inside a target table
   */
  public static writeRow(
    tableName: string,
    rowId: string,
    value: any,
    orgId?: string,
    prodId?: string
  ): boolean {
    try {
      if (tableName.startsWith('doc_')) {
        const targetDoc = tableName.substring(4);
        const dbKey = this.getDbKey(this.TABLES.DOCUMENTS, orgId, prodId);
        const dbDocsRaw = localStorage.getItem(dbKey);
        let dbDocs: Record<string, any> = {};
        if (dbDocsRaw) {
          const parsed = JSON.parse(dbDocsRaw);
          dbDocs = Array.isArray(parsed) ? this.deserializeFromSqlTable(this.TABLES.DOCUMENTS, parsed) : parsed;
        }
        const docRows = dbDocs[targetDoc] || [];
        
        const existingIdx = docRows.findIndex((r: any) => String(r.id || r.code || '') === String(rowId));
        const isNew = existingIdx === -1;
        if (!isNew) {
          docRows[existingIdx] = value;
        } else {
          docRows.push(value);
        }
        dbDocs[targetDoc] = docRows;
        
        const sqlDocsArray = this.serializeToSqlTable(this.TABLES.DOCUMENTS, dbDocs);
        localStorage.setItem(dbKey, JSON.stringify(sqlDocsArray));
        this.logTransaction(isNew ? 'INSERT' : 'UPDATE', tableName as any, rowId, 'SUCCESS', `Modified row ${rowId} inside quality doc "${targetDoc}"`);
        
        // Also sync back to dynamic draft keys to maintain background compatibility
        // Scoped draft keys also possible but standard for now
        localStorage.setItem(`iatf_draft_items_${targetDoc}`, JSON.stringify(docRows));
        
        window.dispatchEvent(new CustomEvent('qms-db-mutated'));
        this.triggerAutoPushIfLiveShell();
        
        // Propagate cascading updates instantly to any dependent view cells
        this.autoSyncCascade(tableName);
        this.autoSyncCascade(targetDoc);
        return true;
      }

      let finalRowId = rowId;
      if (tableName === this.TABLES.DOCUMENTS) {
        const clean = rowId.replace(/\s*\(ارجاع به بند.*\)/, '').trim();
        if (
          clean === 'Risk and Opportunity Management' ||
          clean === 'Risk & Opportunity FMEA' ||
          clean === 'مدیریت ریسک‌ها و فرصت‌ها' ||
          clean === 'مدیریت ریسک و فرصت‌ها'
        ) {
          finalRowId = 'مدیریت ریسک و فرصت‌ها';
        } else {
          finalRowId = clean;
        }
      }
      const dbKey = this.getDbKey(tableName, orgId, prodId);
      const all = this.selectAll(tableName, orgId, prodId);
      const isNew = all[finalRowId] === undefined;
      
      all[finalRowId] = value;
      const sqlArr = this.serializeToSqlTable(tableName, all);
      localStorage.setItem(dbKey, JSON.stringify(sqlArr));
      
      const payloadBrief = typeof value === 'object' ? `${Object.keys(value || {}).length} variables` : String(value);
      this.logTransaction(
        isNew ? 'INSERT' : 'UPDATE',
        tableName as any,
        finalRowId,
        'SUCCESS',
        `${isNew ? 'Inserted new record' : 'Updated existing record'} details (${payloadBrief})`
      );
      
      // Also write back to legacy storage keys to maintain background compatibility with parts of the app that look directly behind
      this.syncLegacyKeys(tableName as any, all);
      
      this.triggerAutoPushIfLiveShell();

      // Trigger automatic cascading sync if a document or generic reference table was updated
      this.autoSyncCascade(tableName);
      if (tableName === this.TABLES.DOCUMENTS) {
        this.autoSyncCascade(finalRowId);
      }
      return true;
    } catch (e) {
      this.logTransaction(
        'INSERT',
        tableName as any,
        rowId,
        'FAILED',
        `Failed executing transaction on table: ${e}`
      );
      return false;
    }
  }

  /**
   * Updates multiple keys/records in a single transaction
   */
  public static writeAll(
    tableName: string,
    fullRecordSet: any,
    orgId?: string,
    prodId?: string
  ): boolean {
    try {
      const dbKey = this.getDbKey(tableName, orgId, prodId);
      const sqlArr = this.serializeToSqlTable(tableName, fullRecordSet);
      localStorage.setItem(dbKey, JSON.stringify(sqlArr));
      
      this.logTransaction(
        'UPDATE',
        tableName as any,
        'ALL',
        'SUCCESS',
        `Batch synchronized ${Object.keys(fullRecordSet || {}).length} rows in the table.`
      );
      
      this.syncLegacyKeys(tableName as any, fullRecordSet);
      this.triggerAutoPushIfLiveShell();

      // Trigger automatic cascading sync for the modified table/documents
      this.autoSyncCascade(tableName);
      if (tableName === this.TABLES.DOCUMENTS && fullRecordSet) {
        Object.keys(fullRecordSet).forEach(docTitle => {
          this.autoSyncCascade(docTitle);
        });
      }
      return true;
    } catch (e) {
      this.logTransaction('UPDATE', tableName as any, 'ALL', 'FAILED', `Batch synchronization failed: ${e}`);
      return false;
    }
  }

  /**
   * Delete a row from the database
   */
  public static deleteRow(
    tableName: string,
    rowId: string,
    orgId?: string,
    prodId?: string
  ): boolean {
    try {
      if (tableName.startsWith('doc_')) {
        const targetDoc = tableName.substring(4);
        const dbKey = this.getDbKey(this.TABLES.DOCUMENTS, orgId, prodId);
        const dbDocsRaw = localStorage.getItem(dbKey);
        if (dbDocsRaw) {
          const parsed = JSON.parse(dbDocsRaw);
          const dbDocs = Array.isArray(parsed) ? this.deserializeFromSqlTable(this.TABLES.DOCUMENTS, parsed) : parsed;
          let docRows = dbDocs[targetDoc] || [];
          const originalLen = docRows.length;
          docRows = docRows.filter((r: any) => String(r.id || r.code || r.title || '') !== String(rowId));
          if (docRows.length < originalLen) {
            dbDocs[targetDoc] = docRows;
            const sqlDocsArray = this.serializeToSqlTable(this.TABLES.DOCUMENTS, dbDocs);
            localStorage.setItem(dbKey, JSON.stringify(sqlDocsArray));
            this.logTransaction('DELETE', tableName as any, rowId, 'SUCCESS', `Deleted row ${rowId} inside quality doc "${targetDoc}"`);
            
            // Sync back to dynamic draft keys to maintain background compatibility
            localStorage.setItem(`iatf_draft_items_${targetDoc}`, JSON.stringify(docRows));
            
            window.dispatchEvent(new CustomEvent('qms-db-mutated'));
            this.triggerAutoPushIfLiveShell();
            
            // Cascade references instantly after deletion
            this.autoSyncCascade(tableName);
            this.autoSyncCascade(targetDoc);
            return true;
          }
        }
        return false;
      }

      let finalRowId = rowId;
      if (tableName === this.TABLES.DOCUMENTS) {
        const clean = rowId.replace(/\s*\(ارجاع به بند.*\)/, '').trim();
        if (
          clean === 'Risk and Opportunity Management' ||
          clean === 'Risk & Opportunity FMEA' ||
          clean === 'مدیریت ریسک‌ها و فرصت‌ها' ||
          clean === 'مدیریت ریسک و فرصت‌ها'
        ) {
          finalRowId = 'مدیریت ریسک و فرصت‌ها';
        } else {
          finalRowId = clean;
        }
      }
      const dbKey = this.getDbKey(tableName, orgId, prodId);
      const all = this.selectAll(tableName, orgId, prodId);
      if (all[finalRowId] !== undefined) {
        delete all[finalRowId];
        const sqlArr = this.serializeToSqlTable(tableName, all);
        localStorage.setItem(dbKey, JSON.stringify(sqlArr));
        this.logTransaction('DELETE', tableName as any, finalRowId, 'SUCCESS', 'Deleted document/control relation index');
        this.syncLegacyKeys(tableName as any, all);
        this.triggerAutoPushIfLiveShell();
        
        // Cascade references instantly after deletion
        this.autoSyncCascade(tableName);
        if (tableName === this.TABLES.DOCUMENTS) {
          this.autoSyncCascade(finalRowId);
        }
        return true;
      }
      return false;
    } catch (e) {
      this.logTransaction('DELETE', tableName as any, rowId, 'FAILED', `Failed deleting item: ${e}`);
      return false;
    }
  }

  /**
   * Clears/Trashes all records inside a project table or doc-prefix item array at once.
   */
  public static clearTable(tableName: string, orgId?: string, prodId?: string): boolean {
    try {
      if (tableName.startsWith('doc_')) {
        const targetDoc = tableName.substring(4);
        const dbKey = this.getDbKey(this.TABLES.DOCUMENTS, orgId, prodId);
        const dbDocsRaw = localStorage.getItem(dbKey);
        if (dbDocsRaw) {
          const dbDocs = JSON.parse(dbDocsRaw);
          dbDocs[targetDoc] = [];
          localStorage.setItem(dbKey, JSON.stringify(dbDocs));
          this.logTransaction('DELETE', tableName as any, 'ALL', 'SUCCESS', `Cleared all rows inside quality doc "${targetDoc}"`);
          localStorage.setItem(`iatf_draft_items_${targetDoc}`, JSON.stringify([]));
          window.dispatchEvent(new CustomEvent('qms-db-mutated'));
          this.triggerAutoPushIfLiveShell();
          // Cascade empty modifications instantly
          this.autoSyncCascade(tableName);
          this.autoSyncCascade(targetDoc);
          return true;
        }
        return false;
      }
      
      const res = this.writeAll(tableName, {}, orgId, prodId);
      if (res) {
        window.dispatchEvent(new CustomEvent('qms-db-mutated'));
      }
      return res;
    } catch (e) {
      this.logTransaction('DELETE', tableName as any, 'ALL', 'FAILED', `Failed clearing table: ${e}`);
      return false;
    }
  }

  /**
   * Restores a table or quality document to its default state as designed in the source code.
   */
  public static restoreTableToDefault(tableName: string): boolean {
    try {
      this.logTransaction('SEED_DATABASE', tableName as any, 'ALL', 'SUCCESS', `Attempting to restore table "${tableName}" to its source-code default state.`);
      
      // A. Check if a dynamic factory restore point exists for this general table
      const restoreTableKey = `factory_restore_table_${tableName}`;
      const savedRestoreTable = localStorage.getItem(restoreTableKey);
      if (savedRestoreTable && !tableName.startsWith('doc_') && tableName !== this.TABLES.DOCUMENTS) {
        try {
          const parsed = JSON.parse(savedRestoreTable);
          this.writeAll(tableName, parsed);
          this.syncLegacyKeys(tableName, parsed);
          this.logTransaction('SEED_DATABASE', tableName as any, 'ALL', 'SUCCESS', `Restored table "${tableName}" from its dynamic factory restore point.`);
          window.dispatchEvent(new CustomEvent('qms-db-mutated'));
          this.triggerAutoPushIfLiveShell();
          return true;
        } catch (e) {
          console.warn(`Failed restoring via factory_restore_table_ for ${tableName}`, e);
        }
      }

      // 1. If it's a specific quality document
      if (tableName.startsWith('doc_')) {
        const targetDoc = tableName.substring(4).trim();
        const dbKey = this.getDbKey(this.TABLES.DOCUMENTS);
        const dbDocsRaw = localStorage.getItem(dbKey);
        
        let dbDocs: Record<string, any[]> = {};
        if (dbDocsRaw) {
          try {
            const parsed = JSON.parse(dbDocsRaw);
            dbDocs = Array.isArray(parsed) ? this.deserializeFromSqlTable(this.TABLES.DOCUMENTS, parsed) : parsed;
          } catch {}
        }
        
        // Retrieve default items from dynamic factory restore point or fall back to code templates
        let defaultItems: any[] = [];
        const savedRestoreItems = localStorage.getItem(`factory_restore_items_${targetDoc}`);
        if (savedRestoreItems) {
          try {
            defaultItems = JSON.parse(savedRestoreItems);
          } catch {}
        } else {
          // Find if there is a matching template in documentTemplates
          const matchedKey = Object.keys(documentTemplates).find(title => {
            const cleanTitle = title.replace(/\s*\(ارجاع به بند.*\)/, '').trim();
            return cleanTitle === targetDoc || title === targetDoc;
          });
          if (matchedKey) {
            defaultItems = (documentTemplates as any)[matchedKey].items || [];
          }
        }
        
        // Restore standard columns if a restore point exists, otherwise clear custom columns
        const savedRestoreCols = localStorage.getItem(`factory_restore_cols_${targetDoc}`);
        if (savedRestoreCols) {
          localStorage.setItem(`iatf_draft_cols_${targetDoc}`, savedRestoreCols);
        } else {
          localStorage.removeItem(`iatf_draft_cols_${targetDoc}`);
        }
        
        dbDocs[targetDoc] = defaultItems;
        const sqlDocsArray = this.serializeToSqlTable(this.TABLES.DOCUMENTS, dbDocs);
        localStorage.setItem(dbKey, JSON.stringify(sqlDocsArray));
        
        localStorage.setItem(`iatf_draft_items_${targetDoc}`, JSON.stringify(defaultItems));
        
        this.logTransaction('SEED_DATABASE', 'documents_table', targetDoc, 'SUCCESS', `Restored document "${targetDoc}" to its factory template state with ${defaultItems.length} rows.`);
        window.dispatchEvent(new CustomEvent('qms-db-mutated'));
        this.triggerAutoPushIfLiveShell();
        
        this.autoSyncCascade(tableName);
        this.autoSyncCascade(targetDoc);
        return true;
      }
      
      // 2. If it's the entire documents_table
      if (tableName === this.TABLES.DOCUMENTS) {
        const dbKey = this.getDbKey(this.TABLES.DOCUMENTS);
        const dbDocs: Record<string, any[]> = {};
        
        Object.keys(documentTemplates).forEach((title) => {
          const cleanTitle = title.replace(/\s*\(ارجاع به بند.*\)/, '').trim();
          const defaultItems = (documentTemplates as any)[title].items || [];
          dbDocs[cleanTitle] = defaultItems;
          
          localStorage.removeItem(`iatf_draft_cols_${cleanTitle}`);
          localStorage.setItem(`iatf_draft_items_${cleanTitle}`, JSON.stringify(defaultItems));
        });
        
        localStorage.setItem(dbKey, JSON.stringify(dbDocs));
        this.logTransaction('SEED_DATABASE', 'documents_table', 'ALL', 'SUCCESS', `Restored all standard documents to their source code default templates.`);
        window.dispatchEvent(new CustomEvent('qms-db-mutated'));
        this.triggerAutoPushIfLiveShell();
        
        this.autoSyncCascade(tableName);
        Object.keys(dbDocs).forEach(docTitle => {
          this.autoSyncCascade(docTitle);
        });
        return true;
      }
      
      // 3. If it's the strategic_items_table
      if (tableName === this.TABLES.STRATEGIC_ITEMS) {
        const defaultSItems: Record<string, any> = {
          '1': { id: '1', title: 'نیازها و انتظارات ذینفعان', clauseId: '4.2', linkedDoc: 'لیست ذینفعان و انتظارات کیفی آن‌ها' },
          '2': { id: '2', title: 'SWOT', clauseId: '4.1', linkedDoc: 'ماتریس SWOT (نقاط قوت، ضعف، فرصت‌ها و تهدیدها)' },
          '3': { id: '3', title: 'اهداف استراتژیک', clauseId: '6.2.1', linkedDoc: 'اهداف کیفیت و برنامه‌های دستیابی سازمان' },
          '4': { id: '4', title: 'برنامه‌های دستیابی به اهداف', clauseId: '6.2.2', linkedDoc: 'اهداف کیفیت و برنامه‌های دستیابی سازمان' },
          '5': { id: '5', title: 'بازنگری مدیریت', clauseId: '9.3', linkedDoc: '' }
        };
        
        this.writeAll(this.TABLES.STRATEGIC_ITEMS, defaultSItems);
        localStorage.setItem('iatf_strategic_submenu_items', JSON.stringify(Object.values(defaultSItems)));
        this.logTransaction('SEED_DATABASE', 'strategic_items_table', 'ALL', 'SUCCESS', `Restored strategic items submenu list to its factory defaults.`);
        window.dispatchEvent(new CustomEvent('qms-db-mutated'));
        return true;
      }
      
      // 4. If it's the strategic_threshold_matrix_table
      if (tableName === this.TABLES.STRATEGIC_THRESHOLD) {
        const defaultMatrix = [
          ['minor', 'minor', 'minor', 'minor', 'important'], // S=1
          ['minor', 'minor', 'minor', 'important', 'important'], // S=2
          ['minor', 'minor', 'important', 'important', 'important'], // S=3
          ['minor', 'important', 'important', 'important', 'important'], // S=4
          ['minor', 'important', 'important', 'important', 'important']  // S=5
        ];
        
        const thresholdObj = { active_matrix: defaultMatrix };
        this.writeAll(this.TABLES.STRATEGIC_THRESHOLD, thresholdObj);
        localStorage.setItem('qms_strategic_threshold_matrix', JSON.stringify(defaultMatrix));
        this.logTransaction('SEED_DATABASE', 'strategic_threshold_matrix_table', 'ALL', 'SUCCESS', 'Restored 5x5 strategic threshold matrix settings to factory standards.');
        window.dispatchEvent(new CustomEvent('qms-db-mutated'));
        return true;
      }
      
      // 5. For other tables, clear them as they are empty by default in design
      const success = this.writeAll(tableName, {});
      if (success) {
        // Handle legacy and other components' localStorage variables for safety
        if (tableName === this.TABLES.DOCUMENT_CONTROL) {
          localStorage.setItem('iatf_iso9001_doc_control_v2', JSON.stringify({}));
        } else if (tableName === this.TABLES.INDICATORS) {
          localStorage.setItem('iatf_indicators', JSON.stringify({}));
        } else if (tableName === this.TABLES.CLAUSE_LINKS) {
          localStorage.setItem('iatf_clause_documents', JSON.stringify({}));
        } else if (tableName === this.TABLES.CSR_MAPPINGS) {
          localStorage.setItem('iatf_csr_comparisons', JSON.stringify([]));
        } else if (tableName === this.TABLES.PROCESS_MAPPINGS) {
          localStorage.setItem('iatf_manual_clause_mappings', JSON.stringify({}));
        } else if (tableName === this.TABLES.KPI_VARS) {
          localStorage.setItem('iatf_kpi_global_vars', JSON.stringify({}));
        } else if (tableName === this.TABLES.STRATEGIC_EVALUATIONS) {
          localStorage.setItem('qms_strategic_evaluations', JSON.stringify([]));
        } else if (tableName === 'nc_items_table' || tableName === 'qmsdb_v3_nc_items') {
          localStorage.setItem('qmsdb_v3_nc_items', JSON.stringify({}));
        }
        
        this.logTransaction('SEED_DATABASE', tableName as any, 'ALL', 'SUCCESS', `Reverted table "${tableName}" back to empty/clean source-code state.`);
        window.dispatchEvent(new CustomEvent('qms-db-mutated'));
      }
      return success;
    } catch (e) {
      this.logTransaction('SEED_DATABASE', tableName as any, 'ALL', 'FAILED', `Error restoring table to default: ${e}`);
      return false;
    }
  }

  /**
   * Backup the entire database catalog into a single JSON object conforming to SQL standards (lists of rows)
   */
  public static exportFullSchemaJson(orgId?: string, prodId?: string): string {
    try {
      const backup: Record<string, any> = {};
      Object.values(this.TABLES).forEach(tab => {
        backup[tab] = this.serializeToSqlTable(tab, this.selectAll(tab, orgId, prodId));
      });
      // Add system logs
      try {
        const logsRaw = localStorage.getItem(`${this.STORAGE_PREFIX}system_logs`);
        backup['_system_logs'] = logsRaw ? JSON.parse(logsRaw) : [];
      } catch {}

      this.logTransaction('BACKUP', 'db_system', 'BACKUP_FILE', 'SUCCESS', `Dispatched database schema dump containing ${JSON.stringify(backup).length} bytes`);
      return JSON.stringify(backup, null, 2);
    } catch (e) {
      this.logTransaction('BACKUP', 'db_system', 'BACKUP_FILE', 'FAILED', `Backup creation failed: ${e}`);
      return '{}';
    }
  }

  /**
   * Restores the database from a backup JSON dump file
   */
  public static restoreFullSchemaJson(jsonStr: string, orgId?: string, prodId?: string): boolean {
    try {
      const data = JSON.parse(jsonStr);
      if (!data || typeof data !== 'object') throw new Error('Data payload is not a valid JSON database schema');
      
      // Restore each table
      Object.values(this.TABLES).forEach(tab => {
        if (data[tab] !== undefined) {
          const dbKey = this.getDbKey(tab, orgId, prodId);
          const rawVal = data[tab];
          // Ensure it is stored as table array
          const sqlArray = Array.isArray(rawVal) ? rawVal : this.serializeToSqlTable(tab, rawVal);
          localStorage.setItem(dbKey, JSON.stringify(sqlArray));
          
          // Sync legacy keys using internal record format
          const recordSet = this.deserializeFromSqlTable(tab, sqlArray);
          this.syncLegacyKeys(tab, recordSet);
        }
      });

      if (data['_system_logs']) {
        localStorage.setItem(`${this.STORAGE_PREFIX}system_logs`, JSON.stringify(data['_system_logs']));
      }

      this.logTransaction('RESTORE', 'db_system', 'RESTORE_FILE', 'SUCCESS', 'Successfully restored database tables from backup file and synchronized runtime states');
      return true;
    } catch (e) {
      this.logTransaction('RESTORE', 'db_system', 'RESTORE_FILE', 'FAILED', `Database restore failed: ${e}`);
      return false;
    }
  }

  /**
   * Wipes all data for a specific tenant and re-initializes
   */
  public static resetAndWipe(orgId: string, prodId: string) {
    try {
      Object.values(this.TABLES).forEach(tab => {
        const key = this.getDbKey(tab, orgId, prodId);
        localStorage.removeItem(key);
      });
      this.initAndSynchronize(orgId, prodId);
      this.logTransaction('SEED_DATABASE', 'db_system', 'WIPE', 'SUCCESS', `Wiped and re-initialized database for tenant: ${orgId}/${prodId}`);
    } catch (e) {
      console.error('Wipe failed:', e);
    }
  }

  /**
   * Optimizes the database by cleaning up old logs and vacuuming unused keys
   */
  public static optimizeDatabaseVacuum() {
    try {
      const logsKey = `${this.STORAGE_PREFIX}system_logs`;
      const curRaw = localStorage.getItem(logsKey);
      const logs: DbTransaction[] = curRaw ? JSON.parse(curRaw) : [];
      
      // Keep only last 20 logs for extreme vacuuming
      const trimmedLogs = logs.slice(0, 20);
      localStorage.setItem(logsKey, JSON.stringify(trimmedLogs));

      const bytesBefore = JSON.stringify(localStorage).length;
      
      // Clean up orphaned draft items not linked in main table (optional safety)
      
      const bytesAfter = JSON.stringify(localStorage).length;
      
      return {
        success: true,
        bytesFreed: Math.max(0, bytesBefore - bytesAfter)
      };
    } catch (e) {
      return { success: false, bytesFreed: 0 };
    }
  }

  /**
   * Returns metadata and column definitions of the database tables
   */
  public static getSchemas(lang: 'fa' | 'en'): DatabaseSchema[] {
    const isFa = lang === 'fa';
    const schemas: DatabaseSchema[] = [
      {
        tableName: this.TABLES.DOCUMENTS,
        primaryKey: 'document_name',
        recordCount: Object.keys(this.selectAll(this.TABLES.DOCUMENTS)).length,
        descriptionFa: 'پایگاه داده رکوردهای محتوایی ذخیره شده اسناد فرآیند و کیفیت پروژه.',
        descriptionEn: 'Core table holding actual data items and edited rows of QMS standard templates.',
        columns: ['document_name (Primary Key)', 'items (DocItem[] JSON payload)', 'lastUpdatedTime'],
        relations: []
      },
      {
        tableName: this.TABLES.DOCUMENT_CONTROL,
        primaryKey: 'document_name',
        recordCount: Object.keys(this.selectAll(this.TABLES.DOCUMENT_CONTROL)).length,
        descriptionFa: 'پایگاه شناسنامه‌های کنترلی مستندات منطبق بر بند ۷.۵ استاندارد ایزو ۹۰۰۱.',
        descriptionEn: 'ISO 9001 compliance metadata (Revision values, Authored By, Authorized By, status status).',
        columns: ['document_name (Primary Key)', 'code (Unique Identifier)', 'revision', 'preparedBy', 'approvedBy', 'lifecycle_status'],
        relations: [
          {
            foreignKey: 'document_name',
            referencedTable: 'documents_table',
            referencedKey: 'document_name',
            descriptionFa: 'نام سند مرجع که جزئیات و ساختار سند در آن است.',
            descriptionEn: 'The referenced document title storing the actual structured elements.'
          }
        ]
      },
      {
        tableName: this.TABLES.INDICATORS,
        primaryKey: 'indicator_id',
        recordCount: this.getIndicatorsCount(),
        descriptionFa: 'داده‌های پایش عملکرد کیفی فرآیندها و اهداف سازمانی استاندارد IATF.',
        descriptionEn: 'Stores indicators, targets, formula descriptions, and progress evaluation milestones.',
        columns: ['indicator_id (Primary Key)', 'type (process/objective)', 'titleFa', 'titleEn', 'target', 'records (Evaluation history logs)'],
        relations: [
          {
            foreignKey: 'clauseId',
            referencedTable: 'standard_clauses_tree',
            referencedKey: 'id',
            descriptionFa: 'شناسه بند مرتبط با این شاخص عملکرد فرآیندی ممیزی.',
            descriptionEn: 'The associated clause identifier representing the processes KPI root.'
          }
        ]
      },
      {
        tableName: this.TABLES.CLAUSE_LINKS,
        primaryKey: 'clause_id',
        recordCount: Object.keys(this.selectAll(this.TABLES.CLAUSE_LINKS)).length,
        descriptionFa: 'جدول ارتباطی بندهای استاندارد خودرویی با مستندات سفارشی و بومی‌سازی شده.',
        descriptionEn: 'Relational mapping mapping custom localized doc titles within specific standards clause keys.',
        columns: ['clause_id (Primary Key)', 'documents_list (string[] array)'],
        relations: [
          {
            foreignKey: 'documents_list (elements)',
            referencedTable: 'documents_table',
            referencedKey: 'document_name',
            descriptionFa: 'عناصر آرایه لیست مستندات به نام سند جامع اشاره دارند.',
            descriptionEn: 'Elements in the documents list string array refer to a record in documents_table.'
          }
        ]
      },
      {
        tableName: this.TABLES.RECORDS,
        primaryKey: 'record_id',
        recordCount: Object.keys(this.selectAll(this.TABLES.RECORDS)).length,
        descriptionFa: 'پایگاه داده بایگانی سوابق (snapshots) و مدارک مصوب و نهایی شده فرآیندها.',
        descriptionEn: 'Database holding permanent records, snapshots, and archived versions of processed documents.',
        columns: ['record_id (Primary Key)', 'documentName', 'clauseId', 'archivedAt', 'items (DocItem[])', 'code', 'revision', 'preparedBy', 'approvedBy'],
        relations: [
          {
            foreignKey: 'documentName',
            referencedTable: 'documents_table',
            referencedKey: 'document_name',
            descriptionFa: 'نام سند که نسخه بایگانی‌شده از روی آن تهیه شده است.',
            descriptionEn: 'The source document title from which this snapshot record was archived.'
          }
        ]
      },
      {
        tableName: this.TABLES.CSR_MAPPINGS,
        primaryKey: 'id',
        recordCount: Object.keys(this.selectAll(this.TABLES.CSR_MAPPINGS)).length,
        descriptionFa: 'ماتریس الزامات خاص مشتریان (CSR) تطبیق‌یافته با بندهای استاندارد IATF 16949.',
        descriptionEn: 'Relational storage for customer compliance mapping benchmarks aligned to standard clauses.',
        columns: ['id (Primary Key)', 'documentId', 'customerNumber', 'customerTitle', 'mappedIatfClauseId', 'analysisText', 'status', 'documentTitle'],
        relations: [
          {
            foreignKey: 'documentId',
            referencedTable: 'documents_table',
            referencedKey: 'document_name',
            descriptionFa: 'کد یا شناسه سند اختصاصی CSR پیوست‌شده.',
            descriptionEn: 'Reference mapping to the target physical CSR checklist record.'
          }
        ]
      },
      {
        tableName: this.TABLES.PROCESS_MAPPINGS,
        primaryKey: 'process_key',
        recordCount: Object.keys(this.selectAll(this.TABLES.PROCESS_MAPPINGS)).length,
        descriptionFa: 'ماتریس فرآیندها و الزامات بندهای استاندارد (Process-Requirements Matrix).',
        descriptionEn: 'Cross-reference grid mappings connecting quality process profiles to standard checklist rows.',
        columns: ['process_key (Primary Key)', 'clause_ids (string[] array)'],
        relations: [
          {
            foreignKey: 'process_key',
            referencedTable: 'documents_table',
            referencedKey: 'id',
            descriptionFa: 'شناسه یا نام فرآیند اصلی مندرج در شناسنامه‌های فرآیندی سازمان.',
            descriptionEn: 'Referential link mapping specific standard processes to target Turtle logs.'
          }
        ]
      },
      {
        tableName: this.TABLES.KPI_VARS,
        primaryKey: 'var_key',
        recordCount: Object.keys(this.selectAll(this.TABLES.KPI_VARS)).length,
        descriptionFa: 'پایگاه متغیرها و ثوابت فرمولی ممیزی و پایش فرآیندها.',
        descriptionEn: 'Relational store holding mathematical KPI constants & variables associated with process KPIs.',
        columns: ['var_key (Primary Key)', 'value', 'updatedAt'],
        relations: []
      },
      {
        tableName: this.TABLES.STRATEGIC_ITEMS,
        primaryKey: 'id',
        recordCount: Object.keys(this.selectAll(this.TABLES.STRATEGIC_ITEMS)).length,
        descriptionFa: 'دفتر برنامه‌ریزی استراتژیک، حاصل کارت‌های اهداف عملیاتی و پروژه‌های مأموریت.',
        descriptionEn: 'Strategic planning cards repository tracking goals, operations, and long-term vision.',
        columns: ['id (Primary Key)', 'goal', 'operation', 'responsible', 'progress', 'remarks'],
        relations: []
      },
      {
        tableName: this.TABLES.STRATEGIC_EVALUATIONS,
        primaryKey: 'id',
        recordCount: Object.keys(this.selectAll(this.TABLES.STRATEGIC_EVALUATIONS)).length,
        descriptionFa: 'ارزیابی عوامل استراتژیک سازمانی شامل تحلیل جامع SWOT و نقاط قوت/ضعف و ذینفعان.',
        descriptionEn: 'Strategic SWOT and stakeholder analysis mapping of internal and external organization factors.',
        columns: ['id (Primary Key)', 'type', 'factor', 'weight', 'rating', 'score', 'strategy'],
        relations: []
      },
      {
        tableName: this.TABLES.STRATEGIC_THRESHOLD,
        primaryKey: 'active_matrix',
        recordCount: Object.keys(this.selectAll(this.TABLES.STRATEGIC_THRESHOLD)).length,
        descriptionFa: 'تنظیمات آستانه‌ها و رنگ‌آمیزی نواحی ریسک ماتریس تصمیم‌گیری استراتژیک.',
        descriptionEn: 'Threshold ranges, danger scores and configuration boundaries of the 5x5 strategic risk grid.',
        columns: ['active_matrix (Primary Key)', 'yellow_threshold', 'red_threshold', 'cell_colors', 'lastUpdated'],
        relations: []
      },
      {
        tableName: this.TABLES.CORRECTIVE_ACTIONS,
        primaryKey: 'id',
        recordCount: Object.keys(this.selectAll(this.TABLES.CORRECTIVE_ACTIONS)).length,
        descriptionFa: 'اقدامات اصلاحی و ریشه‌یابی به روش استاندارد حل مسئله ۸D و رویه‌های CAPA.',
        descriptionEn: 'Corrective action cards (CAPA) tracking non-conformances, root-causes, containment and progress.',
        columns: ['id (Primary Key)', 'ncTitle', 'rootCause', 'correctiveAction', 'responsible', 'status', 'progress'],
        relations: []
      }
    ];

    // Dynamically append all custom/standard documents as individual virtual database tables
    try {
      const dbKey = this.getDbKey(this.TABLES.DOCUMENTS);
      const dbDocsRaw = localStorage.getItem(dbKey);
      if (dbDocsRaw) {
        const dbDocs = JSON.parse(dbDocsRaw);
        Object.keys(dbDocs).forEach((title) => {
          const clean = title.trim().toLowerCase();
          const isPlaceholder = /^(سند|document|doc|sheet|table)\s*_?[\u0660-\u0669\u06f0-\u06f9\d]+$/i.test(clean) || 
                                /^(سند|document|doc|sheet|table)$/i.test(clean);
          if (isPlaceholder) return;

          const rows = dbDocs[title] || [];
          // Build custom columns list based on either first item or defaults
          let cols = ['id', 'clause', 'title', 'description', 'remarks'];
          if (rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null) {
            cols = Object.keys(rows[0]);
          }
          
          schemas.push({
            tableName: `doc_${title}`,
            primaryKey: 'id',
            recordCount: rows.length,
            descriptionFa: `جدول مجازی سیستم برای مستند کیفیت: "${title}". تمام ارتباطات و سطر این فرم در مرکز مدیریت یکپارچه دیتابیس در دسترس هستند.`,
            descriptionEn: `Virtual database table representing standard quality form: "${title}". Live rows are fully mapped as individual records.`,
            columns: cols,
            relations: [
              {
                foreignKey: 'clause',
                referencedTable: 'standard_clauses_tree',
                referencedKey: 'id',
                descriptionFa: 'بند استاندارد خودرویی ممیزی مرتبط با این فرم کیفیت.',
                descriptionEn: 'The associated quality standard clause identifier.'
              }
            ]
          });
        });
      }
    } catch (e) {
      console.warn('Failed listing virtual document collections under schemas list', e);
    }

    return schemas;
  }

  private static getIndicatorsCount(): number {
    try {
      const raw = localStorage.getItem(`${this.STORAGE_PREFIX}${this.TABLES.INDICATORS}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.length : Object.keys(parsed || {}).length;
      }
    } catch {}
    return 0;
  }

  /**
   * Helper routine to write data to legacy keys kept by index processes for safety
   */
  private static syncLegacyKeys(tableName: string, value: any) {
    try {
      if (tableName === this.TABLES.DOCUMENTS) {
        localStorage.setItem('iatf_docs', JSON.stringify(value));
      } else if (tableName === this.TABLES.DOCUMENT_CONTROL) {
        localStorage.setItem('iatf_iso9001_doc_control_v2', JSON.stringify(value));
      } else if (tableName === this.TABLES.INDICATORS) {
        localStorage.setItem('iatf_indicators', JSON.stringify(value));
      } else if (tableName === this.TABLES.CLAUSE_LINKS) {
        localStorage.setItem('iatf_clause_documents', JSON.stringify(value));
      } else if (tableName === this.TABLES.CSR_MAPPINGS) {
        const arr = Object.values(value || {});
        localStorage.setItem('iatf_csr_comparisons', JSON.stringify(arr));
      } else if (tableName === this.TABLES.PROCESS_MAPPINGS) {
        localStorage.setItem('iatf_manual_clause_mappings', JSON.stringify(value));
      } else if (tableName === this.TABLES.KPI_VARS) {
        localStorage.setItem('iatf_kpi_global_vars', JSON.stringify(value));
      } else if (tableName === this.TABLES.STRATEGIC_ITEMS) {
        const arr = Object.values(value || {});
        localStorage.setItem('iatf_strategic_submenu_items', JSON.stringify(arr));
      } else if (tableName === this.TABLES.STRATEGIC_EVALUATIONS) {
        const arr = Object.values(value || {});
        localStorage.setItem('qms_strategic_evaluations', JSON.stringify(arr));
      } else if (tableName === this.TABLES.STRATEGIC_THRESHOLD) {
        localStorage.setItem('qms_strategic_threshold_matrix', JSON.stringify(value));
      }
    } catch {}
  }

  /**
   * Track dependencies and updates dynamically between tables/documents
   */
  public static getDependencyLog() {
    try {
      const raw = localStorage.getItem('iatf_dependencies_log');
      if (raw) return JSON.parse(raw);
    } catch {}
    return { lastSaved: {} as Record<string, number>, lastSynced: {} as Record<string, number> };
  }

  public static saveDependencyLog(log: any) {
    try {
      localStorage.setItem('iatf_dependencies_log', JSON.stringify(log));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('iatf-dependency-updated'));
        // Also dispatch standard browser storage change event
        window.dispatchEvent(new Event('storage'));
      }
    } catch {}
  }

  public static autoSyncCascade(mutatedTableOrDoc: string) {
    try {
      const cleanMutated = mutatedTableOrDoc.replace(/\s*\(ارجاع به بند.*\)/, '').replace(/^doc_/, '').trim();
      const mutatedDbTableName = mutatedTableOrDoc.startsWith('doc_') 
        ? mutatedTableOrDoc 
        : `doc_${cleanMutated}`;

      const allDocs = Array.from(new Set([
        ...Object.keys(this.selectAll(this.TABLES.DOCUMENTS)),
        ...Object.keys(documentTemplates)
      ]));
      
      allDocs.forEach(otherDoc => {
        const cleanOther = otherDoc.replace(/\s*\(ارجاع به بند.*\)/, '').trim();
        if (cleanOther === cleanMutated) return; // Skip self
        
        let columns: any[] = [];
        try {
          const rawCols = localStorage.getItem(`iatf_draft_cols_${cleanOther}`);
          if (rawCols) columns = JSON.parse(rawCols);
        } catch {}
        
        if (columns && Array.isArray(columns) && columns.length > 0) {
          const hasLookupToMutated = columns.some(c => 
            c && c.type === 'db_lookup' && (
              c.dbTable === mutatedTableOrDoc || 
              c.dbTable === mutatedDbTableName ||
              c.dbTable === `doc_${cleanMutated}` ||
              c.dbTable === cleanMutated ||
              (c.dbTable && c.dbTable.startsWith('doc_') && c.dbTable.substring(4) === cleanMutated)
            )
          );
          
          if (hasLookupToMutated) {
            // Run synchronization!
            this.synchronizeDocument(cleanOther);
            try {
              const log = this.getDependencyLog();
              log.lastSynced[`${cleanOther}::${cleanMutated}`] = Date.now();
              this.saveDependencyLog(log);
            } catch {}
          }
        }
      });
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('iatf-dependency-updated'));
        window.dispatchEvent(new CustomEvent('qms-db-mutated'));
        window.dispatchEvent(new Event('storage'));
      }
    } catch (e) {
      console.warn('[QmsDatabase Auto-Sync Cascade Exception]', e);
    }
  }

  public static logDocumentSaved(docTitle: string) {
    const log = this.getDependencyLog();
    log.lastSaved[docTitle] = Date.now();
    this.saveDependencyLog(log);
    this.autoSyncCascade(docTitle);
  }

  public static getOutdatedDependencies(docTitle: string): string[] {
    let cols: any[] = [];
    try {
      const raw = localStorage.getItem(`iatf_draft_cols_${docTitle}`);
      if (raw) {
        cols = JSON.parse(raw);
      }
    } catch {}
    
    if (!Array.isArray(cols)) return [];
    
    const dependencies: string[] = [];
    for (const col of cols) {
      if (col && col.type === 'db_lookup' && col.dbTable && col.dbTable.startsWith('doc_')) {
        const dbName = col.dbTable.substring(4);
        if (dbName && !dependencies.includes(dbName)) {
          dependencies.push(dbName);
        }
      }
    }
    
    // Check if the document actually has cell discrepancies
    const disc = this.checkDocumentDiscrepancies(docTitle);
    if (!disc.isOutOfSync) {
      // If no actual data discrepancy is found, auto-acknowledge the dependency sync!
      const log = this.getDependencyLog();
      let updatedLog = false;
      for (const dep of dependencies) {
        if (!log.lastSynced[`${docTitle}::${dep}`] || log.lastSynced[`${docTitle}::${dep}`] < (log.lastSaved[dep] || 0)) {
          log.lastSynced[`${docTitle}::${dep}`] = Date.now();
          updatedLog = true;
        }
      }
      if (updatedLog) {
        this.saveDependencyLog(log);
      }
      return [];
    }

    const log = this.getDependencyLog();
    const outdated: string[] = [];
    for (const dep of dependencies) {
      const savedTime = log.lastSaved[dep] || 0;
      const syncedTime = log.lastSynced[`${docTitle}::${dep}`] || 0;
      if (savedTime > syncedTime) {
        outdated.push(dep);
      }
    }
    return outdated;
  }

  /**
   * Checks a document for cell discrepancies relative to the database lookup references
   */
  public static checkDocumentDiscrepancies(docTitle: string): { 
    isOutOfSync: boolean; 
    docTitle: string; 
    issuesCount: number; 
    details: string[]; 
  } {
    const cleanTitle = docTitle.replace(/\s*\(ارجاع به بند.*\)/, '').trim();
    
    // Load rows/items for this document
    let items: any[] = [];
    try {
      const dbRows = this.selectRow<any[]>('documents_table', cleanTitle);
      if (dbRows && Array.isArray(dbRows)) {
        items = dbRows;
      }
    } catch {}
    
    if (items.length === 0) {
      try {
        const raw = localStorage.getItem(`iatf_draft_items_${cleanTitle}`);
        if (raw) items = JSON.parse(raw);
      } catch {}
    }
    
    // Load columns for this document
    let columns: any[] = [];
    try {
      const rawCols = localStorage.getItem(`iatf_draft_cols_${cleanTitle}`);
      if (rawCols) columns = JSON.parse(rawCols);
    } catch {}

    if (!columns || columns.length === 0) {
      return { isOutOfSync: false, docTitle, issuesCount: 0, details: [] };
    }
    
    const dbLookupCols = columns.filter(c => c && c.type === 'db_lookup');
    if (dbLookupCols.length === 0) {
      return { isOutOfSync: false, docTitle, issuesCount: 0, details: [] };
    }
    
    const detailsList: string[] = [];
    let issuesCount = 0;
    
    // Helper routine to get value (matching DocumentEditor.tsx)
    const getLookupVal = (col: any, item: any) => {
      if (!col.dbTable || !col.dbColumn) return '';
      let lookupId = '';
      if (col.dbLookupKeyField === 'manual' || !col.dbLookupKeyField) {
        lookupId = item[col.field + '_fk'] || '';
      } else {
        lookupId = item[col.dbLookupKeyField] || '';
      }
      if (!lookupId) return '';
      
      if (col.dbTable.startsWith('doc_')) {
        const targetDoc = col.dbTable.substring(4);
        let docRows: any[] = [];
        try {
          const dbDocsRaw = localStorage.getItem(`${this.STORAGE_PREFIX}documents_table`);
          if (dbDocsRaw) {
            const dbDocs = JSON.parse(dbDocsRaw);
            docRows = dbDocs[targetDoc] || [];
          }
        } catch {}
        if (docRows.length === 0) {
          try {
            const rawDraft = localStorage.getItem(`iatf_draft_items_${targetDoc}`);
            if (rawDraft) docRows = JSON.parse(rawDraft);
          } catch {}
        }
        const targetIt = docRows.find((it: any) => {
          if (col.dbTargetKeyField) {
            return String(it[col.dbTargetKeyField] || '') === String(lookupId);
          }
          return String(it.id) === String(lookupId);
        });
        if (!targetIt) return '';
        const propVal = targetIt[col.dbColumn];
        if (propVal === undefined || propVal === null) return '';
        return typeof propVal === 'object' ? JSON.stringify(propVal) : String(propVal);
      } else {
        let dbTableData: Record<string, any> = {};
        try {
          const raw = localStorage.getItem(`${this.STORAGE_PREFIX}${col.dbTable}`);
          if (raw) dbTableData = JSON.parse(raw);
        } catch {}
        let targetRow = dbTableData[lookupId];
        if (col.dbTargetKeyField) {
          targetRow = Object.values(dbTableData).find((row: any) => {
            if (row && typeof row === 'object') {
              return String(row[col.dbTargetKeyField] || '') === String(lookupId);
            }
            return false;
          });
        }
        if (!targetRow) return '';
        
        if (col.dbTable === 'documents_table') {
          if (col.dbColumn === 'rowCount') {
            return Array.isArray(targetRow) ? String(targetRow.length) : '0';
          }
          if (col.dbColumn === 'lastUpdatedTime') {
            return 'Persisted';
          }
          if (Array.isArray(targetRow) && col.dbColumn) {
            return targetRow.map((it: any) => it[col.dbColumn!] ?? '').filter(Boolean).join(' | ');
          }
          return '';
        }
        if (col.dbTable === 'clause_links_table' && col.dbColumn === 'documents_list') {
          const list = Array.isArray(targetRow) ? targetRow : (targetRow.documents_list || []);
          return Array.isArray(list) ? list.join('، ') : String(list);
        }
        const propVal = targetRow[col.dbColumn];
        if (propVal === undefined || propVal === null) return '';
        return typeof propVal === 'object' ? JSON.stringify(propVal) : String(propVal);
      }
    };
    
    items.forEach((item: any, idx) => {
      dbLookupCols.forEach((col: any) => {
        const hasFK = col.dbLookupKeyField && col.dbLookupKeyField !== 'manual' ? !!item[col.dbLookupKeyField] : !!item[col.field + '_fk'];
        if (!hasFK) return;
        
        try {
          const liveVal = getLookupVal(col, item);
          const storedVal = item[col.field] || '';
          
          if (liveVal !== storedVal) {
            // Ignore the discrepancy if the source of validation has been deleted/emptied
            if (!liveVal) return;
            
            issuesCount++;
            const rowIndicator = item.field1 || item.title || item.name || `ردیف ${idx + 1}`;
            detailsList.push(
              `ستون «${col.label}» در ردیف «${rowIndicator}»: مقدار ذخیره شده (${storedVal || '—'}) با مقدار مبدا (${liveVal || '—'}) همخوانی ندارد.`
            );
          }
        } catch (e) {
          console.warn('Discrepancy check failed for item:', item.id, e);
        }
      });
    });
    
    return {
      isOutOfSync: issuesCount > 0,
      docTitle,
      issuesCount,
      details: detailsList
    };
  }

  /**
   * Synchronizes cell values for db_lookup columns inside a document
   */
  public static synchronizeDocument(docTitle: string): boolean {
    const cleanTitle = docTitle.replace(/\s*\(ارجاع به بند.*\)/, '').trim();
    
    let items: any[] = [];
    try {
      const dbRows = this.selectRow<any[]>('documents_table', cleanTitle);
      if (dbRows && Array.isArray(dbRows)) {
        items = dbRows;
      }
    } catch {}
    
    if (items.length === 0) {
      try {
        const raw = localStorage.getItem(`iatf_draft_items_${cleanTitle}`);
        if (raw) items = JSON.parse(raw);
      } catch {}
    }
    
    let columns: any[] = [];
    try {
      const rawCols = localStorage.getItem(`iatf_draft_cols_${cleanTitle}`);
      if (rawCols) columns = JSON.parse(rawCols);
    } catch {}
    
    if (items.length === 0 || columns.length === 0) return false;
    
    const dbLookupCols = columns.filter(c => c && c.type === 'db_lookup');
    if (dbLookupCols.length === 0) return false;
    
    // Helper routine to get value (matching checkDocumentDiscrepancies)
    const getLookupVal = (col: any, item: any) => {
      if (!col.dbTable || !col.dbColumn) return '';
      let lookupId = '';
      if (col.dbLookupKeyField === 'manual' || !col.dbLookupKeyField) {
        lookupId = item[col.field + '_fk'] || '';
      } else {
        lookupId = item[col.dbLookupKeyField] || '';
      }
      if (!lookupId) return '';
      
      if (col.dbTable.startsWith('doc_')) {
        const targetDoc = col.dbTable.substring(4);
        let docRows: any[] = [];
        try {
          const dbDocsRaw = localStorage.getItem(`${this.STORAGE_PREFIX}documents_table`);
          if (dbDocsRaw) {
            const dbDocs = JSON.parse(dbDocsRaw);
            docRows = dbDocs[targetDoc] || [];
          }
        } catch {}
        if (docRows.length === 0) {
          try {
            const rawDraft = localStorage.getItem(`iatf_draft_items_${targetDoc}`);
            if (rawDraft) docRows = JSON.parse(rawDraft);
          } catch {}
        }
        const targetIt = docRows.find((it: any) => {
          if (col.dbTargetKeyField) {
            return String(it[col.dbTargetKeyField] || '') === String(lookupId);
          }
          return String(it.id) === String(lookupId);
        });
        if (!targetIt) return '';
        const propVal = targetIt[col.dbColumn];
        if (propVal === undefined || propVal === null) return '';
        return typeof propVal === 'object' ? JSON.stringify(propVal) : String(propVal);
      } else {
        let dbTableData: Record<string, any> = {};
        try {
          const raw = localStorage.getItem(`${this.STORAGE_PREFIX}${col.dbTable}`);
          if (raw) dbTableData = JSON.parse(raw);
        } catch {}
        let targetRow = dbTableData[lookupId];
        if (col.dbTargetKeyField) {
          targetRow = Object.values(dbTableData).find((row: any) => {
            if (row && typeof row === 'object') {
              return String(row[col.dbTargetKeyField] || '') === String(lookupId);
            }
            return false;
          });
        }
        if (!targetRow) return '';
        
        if (col.dbTable === 'documents_table') {
          if (col.dbColumn === 'rowCount') {
            return Array.isArray(targetRow) ? String(targetRow.length) : '0';
          }
          if (col.dbColumn === 'lastUpdatedTime') {
            return 'Persisted';
          }
          if (Array.isArray(targetRow) && col.dbColumn) {
            return targetRow.map((it: any) => it[col.dbColumn!] ?? '').filter(Boolean).join(' | ');
          }
          return '';
        }
        if (col.dbTable === 'clause_links_table' && col.dbColumn === 'documents_list') {
          const list = Array.isArray(targetRow) ? targetRow : (targetRow.documents_list || []);
          return Array.isArray(list) ? list.join('، ') : String(list);
        }
        const propVal = targetRow[col.dbColumn];
        if (propVal === undefined || propVal === null) return '';
        return typeof propVal === 'object' ? JSON.stringify(propVal) : String(propVal);
      }
    };
    
    let updatedCount = 0;
    const nextItems = items.map((item: any) => {
      const nextItem = { ...item };
      dbLookupCols.forEach((col: any) => {
        const fkField = col.dbLookupKeyField && col.dbLookupKeyField !== 'manual' ? col.dbLookupKeyField : col.field + '_fk';
        const hasFK = !!item[fkField];
        if (!hasFK) return;
        
        // Check structural referential integrity
        let parentExists = true;
        const lookupId = item[fkField] || '';
        
        if (col.dbTable && col.dbTable.startsWith('doc_')) {
          const targetDoc = col.dbTable.substring(4);
          let docRows: any[] = [];
          try {
            const dbDocsRaw = localStorage.getItem(`${this.STORAGE_PREFIX}documents_table`);
            if (dbDocsRaw) {
              const dbDocs = JSON.parse(dbDocsRaw);
              docRows = dbDocs[targetDoc] || [];
            }
          } catch {}
          if (docRows.length === 0) {
            try {
              const rawDraft = localStorage.getItem(`iatf_draft_items_${targetDoc}`);
              if (rawDraft) docRows = JSON.parse(rawDraft);
            } catch {}
          }
          const targetIt = docRows.find((it: any) => String(it.id) === String(lookupId));
          if (!targetIt && lookupId) {
            parentExists = false;
          }
        } else if (col.dbTable) {
          let dbTableData: Record<string, any> = {};
          try {
            const raw = localStorage.getItem(`${this.STORAGE_PREFIX}${col.dbTable}`);
            if (raw) dbTableData = JSON.parse(raw);
          } catch {}
          if (lookupId && !dbTableData[lookupId]) {
            parentExists = false;
          }
        }

        if (!parentExists) {
          // Relational constraint check failed: Cascade clear of deleted parent row
          if (nextItem[col.field] !== '' || nextItem[fkField] !== '') {
            nextItem[col.field] = '';
            nextItem[fkField] = '';
            updatedCount++;
          }
          return;
        }

        const liveVal = getLookupVal(col, item);
        const storedVal = item[col.field] || '';
        if (liveVal !== storedVal) {
          nextItem[col.field] = liveVal;
          updatedCount++;
        }
      });
      return nextItem;
    });
    
    if (updatedCount > 0) {
      localStorage.setItem(`iatf_draft_items_${cleanTitle}`, JSON.stringify(nextItems));
      this.writeRow('documents_table', cleanTitle, nextItems);
      this.logTransaction('UPDATE', 'documents_table', cleanTitle, 'SUCCESS', `Re-synced ${updatedCount} out-of-date lookup reference cells in document.`);
      
      // Notify components about mutation
      window.dispatchEvent(new CustomEvent('qms-db-mutated'));
      return true;
    }
    
    return false;
  }

  public static acknowledgeDependencySync(docTitle: string, refDocTitle: string) {
    const log = this.getDependencyLog();
    log.lastSynced[`${docTitle}::${refDocTitle}`] = Date.now();
    this.saveDependencyLog(log);
  }

  /**
   * Task-Workflow Observer registration hook
   */
  public static subscribeTaskWorkflowObserver(listener: (event: TaskWorkflowEvent) => void): () => void {
    return TaskWorkflowObserver.subscribe(listener);
  }

  /**
   * Notify Task-Workflow status change to immediately update linked Document/Workflow state
   */
  public static notifyTaskWorkflowStatusChange(event: TaskWorkflowEvent) {
    TaskWorkflowObserver.notify(event);
  }

  /**
   * Enforces Unique ID Constraint for Task Assignment to prevent duplicates
   */
  public static enforceUniqueTaskAssignmentKey(task: {
    id?: string;
    workflowId?: string;
    documentType?: string;
    documentId?: string;
    stepNumber?: number;
    approverRoleId?: string;
    approverUserId?: string;
    assignedToUserId?: string;
    title?: string;
  }): string {
    if (task.id && !task.id.startsWith('temp-')) {
      return task.id;
    }

    const wfOrDocType = task.workflowId || (task.documentType ? task.documentType.replace(/[^a-zA-Z0-9]/g, '_') : 'gen');
    const docId = task.documentId ? task.documentId.replace(/[^a-zA-Z0-9]/g, '_') : 'nodoc';
    const step = task.stepNumber || 1;
    const assignee = task.approverRoleId || task.approverUserId || task.assignedToUserId || 'role';
    
    return `wf-task-${wfOrDocType}-${docId}-step${step}-${assignee}`;
  }
}

/**
 * Task-Workflow Event Interface for real-time observer state synchronization
 */
export interface TaskWorkflowEvent {
  taskId: string;
  workflowId?: string;
  documentType?: string;
  documentId?: string;
  documentTitle?: string;
  stepNumber?: number;
  totalSteps?: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'done';
  approverUserId?: string;
  approverUserName?: string;
  comment?: string;
  signatureData?: string;
  updatedAt?: string;
}

/**
 * Task-Workflow Observer Pattern implementation for decoupled real-time synchronization
 */
export class TaskWorkflowObserver {
  private static listeners: Array<(event: TaskWorkflowEvent) => void> = [];

  public static subscribe(listener: (event: TaskWorkflowEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public static notify(event: TaskWorkflowEvent): void {
    // 1. Immediately update linked Document Control record in QmsDatabase
    if (event.documentId) {
      try {
        const docControlDb = QmsDatabase.selectAll(QmsDatabase.TABLES.DOCUMENT_CONTROL) || {};
        const docKeys = Object.keys(docControlDb);
        const matchedKey = docKeys.find(k => k === event.documentId || docControlDb[k]?.docCode === event.documentId);
        
        if (matchedKey) {
          const existingDoc = docControlDb[matchedKey];
          if (event.status === 'approved' || event.status === 'completed' || event.status === 'done') {
            const isFinal = event.stepNumber && event.totalSteps ? event.stepNumber >= event.totalSteps : true;
            existingDoc.status = isFinal ? 'APPROVED' : 'IN_PROGRESS';
            if (event.approverUserName) existingDoc.approvedBy = event.approverUserName;
            existingDoc.approvedAt = new Date().toISOString();
            if (event.signatureData) existingDoc.digitalSignature = event.signatureData;
          } else if (event.status === 'rejected') {
            existingDoc.status = 'REJECTED';
            if (event.comment) existingDoc.rejectionReason = event.comment;
            if (event.approverUserName) existingDoc.rejectedBy = event.approverUserName;
            existingDoc.rejectedAt = new Date().toISOString();
          }
          existingDoc.lastUpdatedTime = Date.now();
          QmsDatabase.writeRow(QmsDatabase.TABLES.DOCUMENT_CONTROL, matchedKey, existingDoc);
        }
      } catch (err) {
        console.error('[TaskWorkflowObserver] Error updating document control:', err);
      }
    }

    // 2. Dispatch custom window events for active views and live UI
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('qms-task-workflow-status-changed', { detail: event }));
      window.dispatchEvent(new CustomEvent('qms-workflow-sync', { detail: event }));
      window.dispatchEvent(new CustomEvent('qms-db-mutated'));
    }

    // 3. Trigger all registered subscribers
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (e) {
        console.error('[TaskWorkflowObserver] Subscriber callback error:', e);
      }
    });
  }
}

