/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { QmsDatabase } from './qmsDatabase';

// Portable Local Disk Drive D Sync Controller for the Quality Management System
// Uses standard HTML5 Directory Access API and supports an optional headless automated localhost sync proxy (on port 3050).

export class LocalDiskSync {
  private static FOLDER_HANDLE: FileSystemDirectoryHandle | null = null;
  private static LOCAL_AGENT_URL = 'http://localhost:3050';

  /**
   * Helper to store the directory handler in IndexedDB so it remains available between page refreshes.
   */
  public static async storeHandleInIndexedDB(handle: FileSystemDirectoryHandle): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open('qms_local_drive_sync_db', 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('handles')) {
            request.result.createObjectStore('handles');
          }
        };
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('handles', 'readwrite');
          const store = tx.objectStore('handles');
          const putReq = store.put(handle, 'sync_folder_key');
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        };
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Helper to retrieve any cached folder handle from IndexedDB
   */
  public static async getHandleFromIndexedDB(): Promise<FileSystemDirectoryHandle | null> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('qms_local_drive_sync_db', 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('handles')) {
            request.result.createObjectStore('handles');
          }
        };
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('handles', 'readonly');
          const store = tx.objectStore('handles');
          const getReq = store.get('sync_folder_key');
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        };
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Resolves, requests permission, and obtains the active folder handle.
   */
  public static async getConnectedFolder(): Promise<FileSystemDirectoryHandle | null> {
    if (this._isHandlingNodeEnv()) return null;

    if (!this.FOLDER_HANDLE) {
      const cached = await this.getHandleFromIndexedDB();
      if (cached) {
        this.FOLDER_HANDLE = cached;
      }
    }

    if (this.FOLDER_HANDLE) {
      // Prompt user to verify reading/writing permission for this browser session if needed
      const opts = { mode: 'readwrite' as const };
      try {
        let status = await (this.FOLDER_HANDLE as any).queryPermission(opts);
        if (status === 'prompt') {
          status = await (this.FOLDER_HANDLE as any).requestPermission(opts);
        }
        if (status === 'granted') {
          return this.FOLDER_HANDLE;
        }
      } catch (err) {
        console.warn('Could not query/request directory handle permission', err);
      }
    }
    return null;
  }

  /**
   * Triggers the native folder selection directory picker.
   */
  public static async chooseLocalFolder(): Promise<{ success: boolean; name: string; error?: string }> {
    try {
      if (!('showDirectoryPicker' in window)) {
        throw new Error('سیستم عامل یا مرورگر شما از قابلیت دسترسی مستقیم به فولدرهای ویندوز (FileSystem APIs) پشتیبانی نمی‌کند. لطفا مرورگر کروم یا اج را بروزرسانی نمایید.');
      }
      
      const handle = await (window as any).showDirectoryPicker({
        id: 'qms_db_picker',
        mode: 'readwrite'
      });

      this.FOLDER_HANDLE = handle;
      await this.storeHandleInIndexedDB(handle);
      return { success: true, name: handle.name };
    } catch (e: any) {
      let errMsg = e?.message || String(e);
      if (
        errMsg.includes('Cross origin sub frames') || 
        errMsg.includes('iframe') || 
        errMsg.includes('allowed to show a file picker') ||
        window.self !== window.top
      ) {
        errMsg = 'خطای امنیتی فریم مرورگر (به دلیل حضور در هاب پیش‌نمایش متقاطع): مرورگر اجازه آدرس‌دهی مستقیم فولدرهای رایانه را درون کادرهای درونی (Iframe) نمی‌دهد. لطفاً در بالای صفحه بر روی تصویر فلش مورب سمت راست (دکمه بازکردن در تب جدید) کلیک کنید یا دکمه «اجرای زنده در تب مستقل» زیر را کلیک کنید تا این صفحه در تب اصلی مرورگر باز شود. در آنجا بدون خطا می‌توانید درایو D را هماهنگ کنید.';
      }
      return { success: false, name: '', error: errMsg };
    }
  }

  /**
   * Clears the current folder link
   */
  public static async disconnectFolder(): Promise<void> {
    this.FOLDER_HANDLE = null;
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('qms_local_drive_sync_db', 1);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('handles', 'readwrite');
          const store = tx.objectStore('handles');
          const delReq = store.delete('sync_folder_key');
          delReq.onsuccess = () => resolve();
          delReq.onerror = () => resolve();
        };
        request.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Verifies if the local zero-prompt Node server sync agent on port 3050 is running.
   */
  public static async pingLocalAgent(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 850);
      const res = await fetch(`${this.LOCAL_AGENT_URL}/api/status`, {
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' }
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      return data && data.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Pushes the entire active database system down to the connected local folder or local network agent port.
   */
  public static async pushAllToLocalDisk(): Promise<{ success: boolean; bytes: number; method: 'api' | 'directory'; error?: string }> {
    try {
      const dumpStr = QmsDatabase.exportFullSchemaJson();
      const bytes = dumpStr.length;

      // 1. Try local agent API first (Zero-Prompt option)
      const hasAgent = await this.pingLocalAgent();
      if (hasAgent) {
        const res = await fetch(`${this.LOCAL_AGENT_URL}/api/sync-push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: JSON.parse(dumpStr) })
        });
        const respData = await res.json();
        if (respData && respData.success) {
          return { success: true, bytes, method: 'api' };
        }
      }

      // 2. Fall back to standard direct browser directory access API (Folder Handle)
      const folder = await this.getConnectedFolder();
      if (!folder) {
        throw new Error('مسیر محلی متصل نیست یا دسترسی برای نوشتن صادر نشده است. لطفا روی دکمه «بروزرسانی دسترسی فولدر یا اتصال مجدد» کلیک کنید.');
      }

      // Write master database JSON
      await this._writeFileInFolder(folder, 'qms_database_store.json', dumpStr);

      // Write individual table JSONs so users can inspect/edit them in notepad or scripts!
      const backupData = JSON.parse(dumpStr);
      for (const [key, rows] of Object.entries(backupData)) {
        if (key.startsWith('_')) continue; // Skip metadata keys if any
        const tblFileName = `${key}.json`;
        const tblContent = JSON.stringify(rows, null, 2);
        await this._writeFileInFolder(folder, tblFileName, tblContent);
      }

      // Generate local agent bridge code and user quick execution scripts!
      const agentScript = this.generateLocalAgentInFolderScript();
      await this._writeFileInFolder(folder, 'qms_local_agent.js', agentScript);
      
      const batScript = `@echo off\ntitle QMS Local Sync Agent Core - Port 3050\necho Loading Portable Database Sync Server...\nnode qms_local_agent.js\npause`;
      await this._writeFileInFolder(folder, 'run_qms_local_agent.bat', batScript);

      const readmeFa = `به پایگاه داده پرتابل و آفلاین برنامه مدیریت کیفیت یکپارچه خوش آمدید.
این فولدر حاوی تمام جداول اطلاعاتی سیستم QMS شماست که با موفقیت از مرورگر پشتیبان‌گیری شده است.

ساختار فایل‌ها:
- qms_database_store.json : فایل جامع دیتابیس (پشتیبان نهایی سیستم)
- [نام_جدول].json : داده‌های تفکیک‌شده هر جدول به طور مستقل (جهت کاربری‌های عمومی)
- qms_local_agent.js : اسکریپت پس‌زمینه نود برای همگام‌سازی بدون واسطه و خودکار
- run_qms_local_agent.bat : ابزار کلیک برای بالا آوردن فوری وب سرویس لوکال روی ویندوز بدون وارد کردن کدهای دستوری

انتقال اطلاعات به سیستم‌های دیگر:
۱. تمام این پوشه را کپی کرده و به سیستم مقصد منتقل کنید. (مثلا در آدرس D:\\qms_database قرار دهید)
۲. برنامه تحت وب QMS را در سیستم مقصد باز کنید.
۳. به مسیر «مدیریت و تحلیل هسته دیتابیس قفل به پایگاه داده» بروید و در بخش «فولدر درایو D لپ‌تاپ»، آدرس همین پوشه را یکبار دبل کلیک کنید و مجوز خوانش مرورگر را بدهید.
۴. دکمه «بارگذاری و بازیابی اطلاعات» را بزنید. کل اطلاعات، قالب‌ها، سوابق و کارهای ممیزی شده شما فورا بازیابی می‌شود!
۵- متناوباً، با دو بار کلیک روی run_qms_local_agent.bat، دیتابیس به صورت کاملاً زنده، زرق و محرمانه بدون ثانیه‌ای مکث به مرورگر فورا متصل خواهد شد و در تبیین اطلاعات سوابق نیازی به باز کردن دستی فولدر نخواهد بود.`;

      await this._writeFileInFolder(folder, 'راهنمای دیتابیس پرتابل.txt', readmeFa);

      return { success: true, bytes, method: 'directory' };
    } catch (e: any) {
      return { success: false, bytes: 0, method: 'directory', error: e?.message || String(e) };
    }
  }

  /**
   * Pulls structural databases from Drive D / Connected Folder into Browser LocalStorage.
   */
  public static async pullAllFromLocalDisk(): Promise<{ success: boolean; bytes: number; method: 'api' | 'directory'; error?: string }> {
    try {
      // 1. Try local agent API first
      const hasAgent = await this.pingLocalAgent();
      if (hasAgent) {
        const res = await fetch(`${this.LOCAL_AGENT_URL}/api/sync-pull`);
        const respData = await res.json();
        if (respData && respData.success && respData.data) {
          const schemaStr = JSON.stringify(respData.data);
          const restored = QmsDatabase.restoreFullSchemaJson(schemaStr);
          if (restored) {
            return { success: true, bytes: schemaStr.length, method: 'api' };
          }
          throw new Error('فرمت داده‌های بازگردانی شده از لوکال ایجنت درگاه نامعتبر است.');
        }
      }

      // 2. Fall back to direct browser directory picker handle read
      const folder = await this.getConnectedFolder();
      if (!folder) {
        throw new Error('مسیر محلی متصل نیست یا دسترسی صادر نشده است. لطفا روی دکمه «بروزرسانی دسترسی فولدر یا اتصال مجدد» کلیک کنید.');
      }

      const fileHandle = await folder.getFileHandle('qms_database_store.json');
      const file = await fileHandle.getFile();
      const content = await file.text();

      if (!content || content === '{}') {
        throw new Error('فایل دیتابیس اصلی qms_database_store.json در پوشه انتخابی خالی است یا یافت نشد.');
      }

      const restored = QmsDatabase.restoreFullSchemaJson(content);
      if (restored) {
        return { success: true, bytes: content.length, method: 'directory' };
      }
      throw new Error('داده‌های فایل دیتابیس از نظر یکتایی یا ساختار فاقد صحت ممیزی سیستم می‌باشد.');
    } catch (e: any) {
      return { success: false, bytes: 0, method: 'directory', error: e?.message || String(e) };
    }
  }

  /**
   * Helper code representing the absolute source file for local node agent listener
   */
  private static generateLocalAgentInFolderScript(): string {
    return `/**
 * QMS Local Database Node Sync Agent - Port 3050
 * Auto-generated by Standard Quality System Engine.
 * Run using command: node qms_local_agent.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3050;
const DB_STORE_NAME = 'qms_database_store.json';

const server = http.createServer((req, res) => {
  // CORS configurations representing standard sandboxed or cloud origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API 1: Status ping
  if (req.url === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', dir: __dirname }));
    return;
  }

  // API 2: Fetch full database JSON
  if (req.url === '/api/sync-pull' && req.method === 'GET') {
    const dbFilePath = path.join(__dirname, DB_STORE_NAME);
    if (!fs.existsSync(dbFilePath)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'File not existing yet. Post backup to build.' }));
      return;
    }
    try {
      const raw = fs.readFileSync(dbFilePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: JSON.parse(raw) }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API 3: Save full backup JSON and split down into tables
  if (req.url === '/api/sync-push' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (!payload || !payload.data) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid payload structure' }));
          return;
        }

        const dataObj = payload.data;
        // 1. Write core database json file
        const dbFilePath = path.join(__dirname, DB_STORE_NAME);
        fs.writeFileSync(dbFilePath, JSON.stringify(dataObj, null, 2), 'utf8');

        // 2. Write individual tables as json files
        for (const [tableName, rows] of Object.entries(dataObj)) {
          if (tableName.startsWith('_')) continue;
          const tablePath = path.join(__dirname, \`\${tableName}.json\`);
          fs.writeFileSync(tablePath, JSON.stringify(rows, null, 2), 'utf8');
        }

        console.log(\`[QMS Local Agent] Successfully updated \${Object.keys(dataObj).length} tables!\`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: Object.keys(dataObj).length }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Default Fallback
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(\`=======================================================\`);
  console.log(\` QMS PORTABLE DATABASE LOCAL HOST AGENT IS ONLINE!    \`);
  console.log(\`-------------------------------------------------------\`);
  console.log(\` Active Port: \${PORT}\`);
  console.log(\` Directory:   \${__dirname}\`);
  console.log(\` State Master: \${path.join(__dirname, DB_STORE_NAME)}\`);
  console.log(\`-------------------------------------------------------\`);
  console.log(\` Press Control+C to terminate this server securely.   \`);
  console.log(\`=======================================================\`);
});
`;
  }

  /**
   * Helper function to safe write a handle file inside the connected folder
   */
  private static async _writeFileInFolder(folderHandle: FileSystemDirectoryHandle, filename: string, content: string): Promise<void> {
    const fileHandle = await folderHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  private static _isHandlingNodeEnv(): boolean {
    return typeof window === 'undefined';
  }
}
