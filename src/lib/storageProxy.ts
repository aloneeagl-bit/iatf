/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// In-Memory store for offline (non-configured) database sessions or sandboxed environments
const memoryStore: Record<string, string> = {};

// Mock storage object for environments where window.localStorage or window.sessionStorage throws SecurityError
const createMockStorage = (): Storage => {
  return {
    get length() {
      return Object.keys(memoryStore).length;
    },
    clear() {
      Object.keys(memoryStore).forEach(k => delete memoryStore[k]);
    },
    getItem(key: string) {
      return memoryStore[key] !== undefined ? memoryStore[key] : null;
    },
    key(index: number) {
      return Object.keys(memoryStore)[index] || null;
    },
    removeItem(key: string) {
      delete memoryStore[key];
    },
    setItem(key: string, value: string) {
      memoryStore[key] = String(value);
    }
  };
};

let safeLocalStorage: Storage | null = null;
let safeSessionStorage: Storage | null = null;

try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const ls = window.localStorage;
    const testKey = '__storage_test__';
    ls.setItem(testKey, '1');
    ls.removeItem(testKey);
    safeLocalStorage = ls;
  }
} catch (e) {
  console.warn('Local storage is restricted or throws SecurityError in this environment.', e);
}

try {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const ss = window.sessionStorage;
    const testKey = '__storage_test__';
    ss.setItem(testKey, '1');
    ss.removeItem(testKey);
    safeSessionStorage = ss;
  }
} catch (e) {
  console.warn('Session storage is restricted or throws SecurityError in this environment.', e);
}

const mockLs = createMockStorage();
const mockSs = createMockStorage();

if (typeof window !== 'undefined') {
  if (!safeLocalStorage) {
    try {
      Object.defineProperty(window, 'localStorage', {
        get() { return mockLs; },
        configurable: true
      });
    } catch (e) {
      console.warn('Failed to define fallback localStorage property:', e);
    }
  }

  if (!safeSessionStorage) {
    try {
      Object.defineProperty(window, 'sessionStorage', {
        get() { return mockSs; },
        configurable: true
      });
    } catch (e) {
      console.warn('Failed to define fallback sessionStorage property:', e);
    }
  }

  // Global Sandbox Safety Patch for window.confirm
  try {
    window.confirm = function(message?: string): boolean {
      console.info("Global Sandbox Override: Automated confirmation allowed for dialog:", message);
      return true;
    };
  } catch (e) {
    console.warn("Could not patch window.confirm:", e);
  }
}
