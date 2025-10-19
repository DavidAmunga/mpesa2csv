import React, { useState, useEffect } from "react";
import { FileStatus } from "../types";
import { Lock } from "lucide-react";
import { cn } from "../lib/utils";
import { PasswordInput } from "./ui/password-input";
import { Button } from "./ui/button";

interface PasswordPromptProps {
  onPasswordSubmit: (password: string) => void;
  onSkip?: () => void;
  onReset?: () => void;
  status: FileStatus;
  error?: string;
  currentFileName?: string;
  currentFileIndex?: number;
  totalFiles?: number;
  defaultPassword?: string | null;
}

const PasswordPrompt: React.FC<PasswordPromptProps> = ({
  onPasswordSubmit,
  onSkip,
  onReset,
  status,
  error,
  currentFileName,
  currentFileIndex,
  totalFiles,
  defaultPassword,
}) => {
  const [password, setPassword] = useState<string>("");
  const [isAutoFilled, setIsAutoFilled] = useState<boolean>(false);

  // Auto-fill password when cached password is available
  useEffect(() => {
    if (defaultPassword) {
      console.log('[PasswordPrompt] Auto-filling password from cache');
      setPassword(defaultPassword);
      setIsAutoFilled(true);
    }
  }, [defaultPassword]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onPasswordSubmit(password);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-3">
      <Lock className="size-8 text-yellow-500" />

      <h3 className="text-xl font-semibold text-green-700 dark:text-green-300">
        Password Protected PDF
      </h3>

      {totalFiles && totalFiles > 1 && (
        <div className="text-sm  mb-2">
          File {(currentFileIndex ?? 0) + 1} of {totalFiles}
        </div>
      )}

      {currentFileName && (
        <div className="text-sm font-medium text-primary mb-3 px-4 py-2  rounded-md max-w-md">
          {currentFileName}
        </div>
      )}

      <p className=" max-w-md text-center">
        This PDF is password protected. {isAutoFilled ? 'Password auto-filled from cache.' : 'Please enter the password to unlock it.'}
      </p>
      
      {isAutoFilled && (
        <div className="text-sm text-green-600 dark:text-green-400 font-medium">
          ✅ Password remembered - click Unlock to continue
        </div>
      )}

      <form onSubmit={handleSubmit} className="w-full  mt-4">
        <div className="space-y-4">
          <PasswordInput
            className={cn(
              error
                ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                : ""
            )}
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={status === FileStatus.PROCESSING}
          />

          {error && (
            <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>
          )}

          <Button
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
          </Button>

          {/* Skip and Reset buttons */}
          <div className="flex gap-2 mt-3">
            {onSkip && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1 text-foreground"
                onClick={onSkip}
                disabled={status === FileStatus.PROCESSING}
              >
                Skip File
              </Button>
            )}
            {onReset && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1 text-foreground"
                onClick={onReset}
                disabled={status === FileStatus.PROCESSING}
              >
                Restart
              </Button>
            )}
          </div>
        </div>
      </form>

      <div className="text-xs  mt-4">
        The password will only be used locally to decrypt the PDF file.
      </div>
    </div>
  );
};

export default PasswordPrompt;
