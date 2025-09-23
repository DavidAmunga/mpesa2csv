import { useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { AlertCircle, Download, X } from "lucide-react";

interface UpdateInfo {
  version: string;
  date: string;
  body: string;
}

export function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      const update = await check();
      if (update) {
        setUpdateAvailable(true);
        setUpdateInfo({
          version: update.version,
          date: update.date || "Unknown",
          body: update.body || "No release notes available.",
        });
        setShowDialog(true);
      }
    } catch (error) {
      console.error("Failed to check for updates:", error);
    }
  };

  const installUpdate = async () => {
    if (!updateAvailable) return;

    try {
      setIsUpdating(true);
      const update = await check();
      if (update) {
        await update.downloadAndInstall();
        await relaunch();
      }
    } catch (error) {
      console.error("Failed to install update:", error);
      setIsUpdating(false);
    }
  };

  const dismissUpdate = () => {
    setShowDialog(false);
  };

  if (!showDialog || !updateAvailable || !updateInfo) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-full">
              <AlertCircle className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Update Available
              </h3>
              <p className="text-sm text-gray-500">
                Version {updateInfo.version}
              </p>
            </div>
            <button
              onClick={dismissUpdate}
              className="ml-auto p-1 hover:bg-gray-100 rounded"
              disabled={isUpdating}
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-2">What's New:</h4>
            <div className="text-sm text-gray-600 bg-gray-50 rounded p-3 max-h-32 overflow-y-auto">
              {updateInfo.body.split("\n").map((line, index) => (
                <p key={index} className="mb-1">
                  {line}
                </p>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={dismissUpdate}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              disabled={isUpdating}
            >
              Later
            </button>
            <button
              onClick={installUpdate}
              disabled={isUpdating}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isUpdating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Update Now
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-3 text-center">
            The app will restart automatically after the update is installed.
          </p>
        </div>
      </div>
    </div>
  );
}
