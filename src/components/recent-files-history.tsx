import React, { useState } from "react";
import { useRecentFilesStore, RecentFileEntry } from "../stores/recentFilesStore";
import { History, Trash2, FileText, Calendar, Hash, Lock, TrendingUp, TrendingDown, X, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";

interface RecentFilesHistoryProps {
  onClose?: () => void;
  onReprocessFile?: (file: RecentFileEntry) => void;
}

const RecentFilesHistory: React.FC<RecentFilesHistoryProps> = ({ onClose, onReprocessFile }) => {
  const { files, removeFile, clearAll } = useRecentFilesStore();
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffInDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleClearAll = () => {
    if (showConfirmClear) {
      clearAll();
      setShowConfirmClear(false);
    } else {
      setShowConfirmClear(true);
    }
  };

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4 bg-zinc-900/95 dark:bg-zinc-900/95">
        <History className="w-16 h-16 text-gray-500" />
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2 text-white">No History Yet</h3>
          <p className="text-sm text-gray-400">
            Processed PDF files will appear here
          </p>
        </div>
        {onClose && (
          <Button 
            variant="default" 
            onClick={onClose} 
            className="mt-4 bg-primary hover:bg-primary/90"
          >
            <X className="w-4 h-4 mr-1" />
            Close
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900/95 dark:bg-zinc-900/95">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-white" />
          <h2 className="text-lg font-semibold text-white">Recent Files</h2>
          <span className="text-sm text-gray-400">({files.length})</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className={showConfirmClear ? "border border-red-500 bg-red-500/20 text-red-400 hover:bg-red-500/30" : "border border-gray-600 bg-zinc-800 text-white hover:bg-zinc-700"}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            {showConfirmClear ? "Confirm Clear All?" : "Clear All"}
          </Button>
          {onClose && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={onClose}
              className="bg-primary hover:bg-primary/90"
            >
              <X className="w-4 h-4 mr-1" />
              Close
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {files.map((file) => (
            <FileHistoryCard
              key={file.id}
              file={file}
              onRemove={() => removeFile(file.id)}
              onReprocess={onReprocessFile ? () => onReprocessFile(file) : undefined}
              formatDate={formatDate}
              formatFileSize={formatFileSize}
              formatCurrency={formatCurrency}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

interface FileHistoryCardProps {
  file: RecentFileEntry;
  onRemove: () => void;
  onReprocess?: () => void;
  formatDate: (timestamp: number) => string;
  formatFileSize: (bytes: number) => string;
  formatCurrency: (amount: number) => string;
}

const FileHistoryCard: React.FC<FileHistoryCardProps> = ({
  file,
  onRemove,
  onReprocess,
  formatDate,
  formatFileSize,
  formatCurrency,
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleDelete = () => {
    if (showConfirmDelete) {
      onRemove();
    } else {
      setTimeout(() => setShowConfirmDelete(false), 3000);
    }
  };

  return (
    <div className="border border-zinc-800 dark:border-zinc-800 rounded-lg p-4 bg-zinc-800/50 dark:bg-zinc-800/50 hover:bg-zinc-700/60 dark:hover:bg-zinc-700/60 transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-green-400 flex-shrink-0" />
            <h3 className="font-medium truncate text-white" title={file.fileName}>
              {file.fileName}
            </h3>
            {file.isPasswordProtected && (
              <Lock className="w-3 h-3 text-yellow-400 flex-shrink-0" title="Password Protected" />
            )}
            {onReprocess && file.fileData && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onReprocess();
                }}
                className="ml-auto h-6 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                title="Reprocess this file"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                <span className="text-xs">Reprocess</span>
              </Button>
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-1 text-gray-400">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{formatDate(file.processedDate)}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-400">
              <Hash className="w-3 h-3 flex-shrink-0" />
              <span className="font-medium text-white">{file.transactionCount}</span>
              <span>transactions</span>
            </div>
            
            {file.dateRange && (
              <div className="text-xs text-gray-300 pt-1">
                <span className="font-medium text-white">Period:</span> {file.dateRange.from} → {file.dateRange.to}
              </div>
            )}
          </div>

          {(file.totalPaidIn !== undefined || file.totalWithdrawn !== undefined) && (
            <div className="mt-2 pt-2 border-t flex flex-wrap gap-3 text-xs">
              {file.totalPaidIn !== undefined && file.totalPaidIn > 0 && (
                <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
                  <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{formatCurrency(file.totalPaidIn)}</span>
                </div>
              )}
              {file.totalWithdrawn !== undefined && file.totalWithdrawn > 0 && (
                <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium">
                  <TrendingDown className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{formatCurrency(file.totalWithdrawn)}</span>
                </div>
              )}
            </div>
          )}

          <div className="text-xs text-gray-500 mt-1.5 font-mono">
            {formatFileSize(file.fileSize)}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className={showConfirmDelete ? "text-red-400 hover:text-red-300 hover:bg-red-500/20" : "text-gray-400 hover:text-white hover:bg-gray-700"}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default RecentFilesHistory;
