import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PasswordCacheEntry {
  fileHash: string;
  password: string;
  fileName: string;
  timestamp: number;
}

interface PasswordCacheState {
  passwords: Record<string, PasswordCacheEntry>;
  getPassword: (fileHash: string) => string | null;
  savePassword: (fileHash: string, password: string, fileName: string) => void;
  removePassword: (fileHash: string) => void;
  clearAll: () => void;
  getAll: () => PasswordCacheEntry[];
}

const MAX_CACHE_SIZE = 50;

/**
 * Store for caching PDF passwords based on file hash
 * Persisted to localStorage
 */
export const usePasswordCacheStore = create<PasswordCacheState>()(
  persist(
    (set, get) => ({
      passwords: {},

      getPassword: (fileHash: string) => {
        const entry = get().passwords[fileHash];
        console.log('[PasswordCache] getPassword called:', {
          fileHash: fileHash.substring(0, 16) + '...',
          found: !!entry,
          allHashes: Object.keys(get().passwords).map(h => h.substring(0, 16) + '...'),
        });
        return entry ? entry.password : null;
      },

      savePassword: (fileHash: string, password: string, fileName: string) => {
        console.log('[PasswordCache] savePassword called:', {
          fileHash: fileHash.substring(0, 16) + '...',
          fileName,
          passwordLength: password.length,
        });
        
        set((state) => {
          const currentPasswords = { ...state.passwords };
          const currentSize = Object.keys(currentPasswords).length;
          
          // Add or update the password
          currentPasswords[fileHash] = {
            fileHash,
            password,
            fileName,
            timestamp: Date.now(),
          };
          
          // If we exceeded the limit, remove oldest entries
          if (currentSize >= MAX_CACHE_SIZE && !state.passwords[fileHash]) {
            console.log('[PasswordCache] Cache limit reached, purging oldest entries');
            
            // Sort entries by timestamp (oldest first)
            const sortedEntries = Object.entries(currentPasswords)
              .sort(([, a], [, b]) => a.timestamp - b.timestamp);
            
            // Remove oldest entries until we're under the limit
            const entriesToRemove = sortedEntries.length - MAX_CACHE_SIZE + 1;
            for (let i = 0; i < entriesToRemove; i++) {
              const [hashToRemove] = sortedEntries[i];
              console.log('[PasswordCache] Removing old entry:', currentPasswords[hashToRemove].fileName);
              delete currentPasswords[hashToRemove];
            }
          }
          
          return { passwords: currentPasswords };
        });
        
        console.log('[PasswordCache] After save, total entries:', Object.keys(get().passwords).length);
      },

      removePassword: (fileHash: string) => {
        set((state) => {
          const { [fileHash]: _, ...rest } = state.passwords;
          return { passwords: rest };
        });
      },

      clearAll: () => {
        set({ passwords: {} });
      },

      getAll: () => {
        return Object.values(get().passwords);
      },
    }),
    {
      name: 'mpesa2csv-password-cache',
      version: 1,
    }
  )
);
