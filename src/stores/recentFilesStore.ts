import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RecentFileEntry {
  id: string; // Unique ID for the entry
  fileName: string;
  fileSize: number;
  fileHash: string;
  processedDate: number; // timestamp
  transactionCount: number;
  isPasswordProtected: boolean;
  dateRange?: {
    from: string;
    to: string;
  };
  // Additional metadata
  totalPaidIn?: number;
  totalWithdrawn?: number;
  finalBalance?: number;
}

interface RecentFilesState {
  files: RecentFileEntry[];
  addFile: (file: RecentFileEntry) => void;
  removeFile: (id: string) => void;
  clearAll: () => void;
  getAll: () => RecentFileEntry[];
  getById: (id: string) => RecentFileEntry | undefined;
}

const MAX_RECENT_FILES = 20;

/**
 * Store for tracking recently processed PDF files
 * Persisted to localStorage
 */
export const useRecentFilesStore = create<RecentFilesState>()(
  persist(
    (set, get) => ({
      files: [],

      addFile: (file: RecentFileEntry) => {
        console.log('[RecentFiles] Adding file to history:', file.fileName);
        
        set((state) => {
          const existingFiles = [...state.files];
          
          // Check if file already exists (by hash)
          const existingIndex = existingFiles.findIndex(
            (f) => f.fileHash === file.fileHash
          );
          
          if (existingIndex !== -1) {
            // Update existing entry with new data
            console.log('[RecentFiles] Updating existing entry');
            existingFiles[existingIndex] = {
              ...file,
              processedDate: Date.now(), // Update timestamp
            };
          } else {
            // Add new entry at the beginning
            existingFiles.unshift(file);
          }
          
          // Keep only the most recent MAX_RECENT_FILES entries
          const limitedFiles = existingFiles.slice(0, MAX_RECENT_FILES);
          
          if (existingFiles.length > MAX_RECENT_FILES) {
            console.log('[RecentFiles] Removed', existingFiles.length - MAX_RECENT_FILES, 'old entries');
          }
          
          console.log('[RecentFiles] Total files in history:', limitedFiles.length);
          return { files: limitedFiles };
        });
      },

      removeFile: (id: string) => {
        console.log('[RecentFiles] Removing file:', id);
        set((state) => ({
          files: state.files.filter((f) => f.id !== id),
        }));
      },

      clearAll: () => {
        console.log('[RecentFiles] Clearing all history');
        set({ files: [] });
      },

      getAll: () => {
        return get().files;
      },

      getById: (id: string) => {
        return get().files.find((f) => f.id === id);
      },
    }),
    {
      name: 'mpesa2csv-recent-files',
      version: 1,
    }
  )
);
