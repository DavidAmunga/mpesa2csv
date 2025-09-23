import React, { useState } from "react";
import { FileStatus } from "../types";
import { Lock } from "lucide-react";

interface PasswordPromptProps {
  onPasswordSubmit: (password: string) => void;
  status: FileStatus;
  error?: string;
  currentFileName?: string;
  currentFileIndex?: number;
  totalFiles?: number;
}

const PasswordPrompt: React.FC<PasswordPromptProps> = ({
  onPasswordSubmit,
  status,
  error,
  currentFileName,
  currentFileIndex,
  totalFiles,
}) => {
  const [password, setPassword] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onPasswordSubmit(password);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-3">
      <Lock className="size-8 text-yellow-500" />

      <h3 className="text-xl font-semibold text-green-700">
        Password Protected PDF
      </h3>

      {totalFiles && totalFiles > 1 && (
        <div className="text-sm text-gray-500 mb-2">
          File {(currentFileIndex ?? 0) + 1} of {totalFiles}
        </div>
      )}

      {currentFileName && (
        <div className="text-sm font-medium text-gray-700 mb-3 px-4 py-2 bg-gray-50 rounded-md max-w-md">
          {currentFileName}
        </div>
      )}

      <p className="text-gray-600 max-w-md text-center">
        This PDF is password protected. Please enter the password to unlock it.
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm mt-4">
        <div className="space-y-4">
          <input
            type="password"
            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
              error ? "border-red-500 focus:ring-red-500" : "border-gray-300"
            }`}
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={status === FileStatus.PROCESSING}
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white w-full px-6 py-3 rounded-md shadow-md hover:shadow-lg transition-all"
            disabled={!password.trim() || status === FileStatus.PROCESSING}
          >
            {status === FileStatus.PROCESSING ? (
              <span className="flex items-center justify-center">
                <span className="animate-spin h-4 w-4 border-b-2 border-white rounded-full mr-2"></span>
                Processing...
              </span>
            ) : (
              "Unlock PDF"
            )}
          </button>
        </div>
      </form>

      <div className="text-xs text-gray-500 mt-4">
        The password will only be used locally to decrypt the PDF file.
      </div>
    </div>
  );
};

export default PasswordPrompt;
