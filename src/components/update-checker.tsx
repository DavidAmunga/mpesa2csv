import { useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { AlertCircle, Download, X, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

interface UpdateInfo {
  version: string;
  date: string;
  body: string;
}

interface UpdateCheckerProps {
  autoCheck?: boolean;
  showButton?: boolean;
}

export function UpdateChecker({
  autoCheck = false,
  showButton = false,
}: UpdateCheckerProps) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (autoCheck) {
      checkForUpdates();
    }
  }, [autoCheck]);

  const checkForUpdates = async () => {
    try {
      setIsChecking(true);
      const update = await check();
      if (update) {
        setUpdateAvailable(true);

        let releaseNotes = update.body || "No release notes available.";

        if (releaseNotes.includes("See full release notes at")) {
          try {
            const response = await fetch(
              `https://api.github.com/repos/DavidAmunga/mpesa2csv/releases/latest`
            );
            if (response.ok) {
              const releaseData = await response.json();
              if (releaseData.body && releaseData.body.trim()) {
                releaseNotes = releaseData.body;
              }
            }
          } catch (apiError) {
            console.warn(
              "Failed to fetch release notes from GitHub API:",
              apiError
            );
          }
        }

        setUpdateInfo({
          version: update.version,
          date: update.date || "Unknown",
          body: releaseNotes,
        });
        setShowDialog(true);
      }
    } catch (error) {
      console.error("Failed to check for updates:", error);
    } finally {
      setIsChecking(false);
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

  if (showButton && !showDialog) {
    return (
      <Button
        onClick={checkForUpdates}
        disabled={isChecking}
        variant="ghost"
        size="sm"
        className="text-xs hover:bg-transparent hover:text-primary"
      >
        {isChecking ? (
          <>
            <RefreshCw className="w-3 h-3 animate-spin" />
            Checking...
          </>
        ) : (
          <>
            <RefreshCw className="w-3 h-3" />
            Check for Updates
          </>
        )}
      </Button>
    );
  }

  if (!showDialog || !updateAvailable || !updateInfo) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-800 rounded-lg shadow-xl max-w-md w-full mx-4 border">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-full">
              <AlertCircle className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Update Available</h3>
              <p className="text-sm">Version {updateInfo.version}</p>
            </div>
            <Button
              onClick={dismissUpdate}
              variant="ghost"
              size="sm"
              className="ml-auto p-1"
              disabled={isUpdating}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="mb-6">
            <h4 className="font-medium mb-2">What's New:</h4>
            <div className="text-sm bg-zinc-900 rounded p-3 max-h-32 overflow-y-auto">
              {updateInfo.body.split("\n").map((line, index) => {
                let formattedLine = line;

                if (line.startsWith("## ")) {
                  formattedLine = line.replace("## ", "");
                  return (
                    <p key={index} className="mb-2 font-semibold text-primary">
                      {formattedLine}
                    </p>
                  );
                }

                if (line.startsWith("### ")) {
                  formattedLine = line.replace("### ", "");
                  return (
                    <p key={index} className="mb-1 font-medium">
                      {formattedLine}
                    </p>
                  );
                }

                if (line.startsWith("- ")) {
                  formattedLine = line.replace("- ", "• ");
                  return (
                    <p key={index} className="mb-1 ml-2">
                      {formattedLine}
                    </p>
                  );
                }

                formattedLine = formattedLine.replace(
                  /\*\*(.*?)\*\*/g,
                  "<strong>$1</strong>"
                );

                if (line.trim() === "") {
                  return <br key={index} />;
                }

                return (
                  <p
                    key={index}
                    className="mb-1"
                    dangerouslySetInnerHTML={{ __html: formattedLine }}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={dismissUpdate}
              variant="outline"
              className="flex-1 text-zinc-800"
              disabled={isUpdating}
            >
              Later
            </Button>
            <Button
              onClick={installUpdate}
              disabled={isUpdating}
              className="flex-1"
            >
              {isUpdating ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Update Now
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-3 text-center">
            The app will restart automatically after the update is installed.
          </p>
        </div>
      </div>
    </div>
  );
}
