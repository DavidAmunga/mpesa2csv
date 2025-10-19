import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";
import { Download, RotateCcw, ExternalLink, History } from "lucide-react";

import {
  MPesaStatement,
  FileStatus,
  ExportFormat,
  ExportOptions as ExportOptionsType,
} from "./types";
import { PdfService } from "./services/pdfService";
import { ExportService } from "./services/exportService";
import FileUploader from "./components/file-uploader";
import PasswordPrompt from "./components/password-prompt";
import ExportOptions from "./components/export-options";
import { UpdateChecker } from "./components/update-checker";
import { Button } from "./components/ui/button";
import { formatDateForFilename } from "./utils/helpers";
import { calculateQuickFileHash } from "./utils/fileHash";
import { usePasswordCacheStore } from "./stores/passwordCacheStore";
import { useRecentFilesStore } from "./stores/recentFilesStore";
import RecentFilesHistory from "./components/recent-files-history";

function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [fileHashes, setFileHashes] = useState<Map<number, string>>(new Map());
  const [status, setStatus] = useState<FileStatus>(FileStatus.IDLE);
  const [error, setError] = useState<string | undefined>(undefined);
  const [statements, setStatements] = useState<MPesaStatement[]>([]);
  const [exportLink, setExportLink] = useState<string>("");
  const [exportFileName, setExportFileName] = useState<string>("");
  const [exportFormat, setExportFormat] = useState<ExportFormat>(
    ExportFormat.XLSX
  );
  const [exportOptions, setExportOptions] = useState<ExportOptionsType>({
    includeChargesSheet: false,
    includeSummarySheet: false,
    includeBreakdownSheet: false,
    includeDailyBalanceSheet: false,
  });
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [appVersion, setAppVersion] = useState<string>("");
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const [savedFilePath, setSavedFilePath] = useState<string>("");
  const [currentPlatform, setCurrentPlatform] = useState<string>("");
  const [cachedPassword, setCachedPassword] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  
  const { getPassword, savePassword } = usePasswordCacheStore();
  const { addFile: addRecentFile } = useRecentFilesStore();

  const getDefaultFileName = () => {
    return (
      exportFileName ||
      `mpesa_statement.${ExportService.getFileExtension(exportFormat)}`
    );
  };

  const prepareFileContent = async (statement: MPesaStatement) => {
    const arrayBuffer = await ExportService.getFileBuffer(
      statement,
      exportFormat,
      exportOptions
    );
    const content = new Uint8Array(arrayBuffer);
    return Array.from(content);
  };

  const handleFormatChange = (format: ExportFormat) => {
    setExportFormat(format);
    const combinedStatement = statements[0];
    const fileName = ExportService.getFileName(
      combinedStatement,
      format,
      formatDateForFilename()
    );

    ExportService.createDownloadLink(combinedStatement, format, exportOptions)
      .then(setExportLink)
      .catch(() => setExportLink(""));
    setExportFileName(fileName);
  };

  const handleOptionsChange = (options: ExportOptionsType) => {
    setExportOptions(options);
    const combinedStatement = statements[0];
    ExportService.createDownloadLink(combinedStatement, exportFormat, options)
      .then(setExportLink)
      .catch(() => setExportLink(""));
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const [version] = await Promise.all([
          invoke<string>("get_app_version"),
          // platform(),
        ]);
        setAppVersion(version);
        setCurrentPlatform(platform());
      } catch (error) {
        console.error("Failed to initialize app:", error);
      }
    };
    initializeApp();
  }, []);

  const handleFilesSelected = async (selectedFiles: File[]) => {
    console.log('[App] ===== FILE UPLOAD STARTED =====');
    console.log('[App] Selected files:', selectedFiles.map(f => f.name));
    
    setFiles(selectedFiles);
    setStatus(FileStatus.LOADING);
    setError(undefined);
    setStatements([]);
    setCurrentFileIndex(0);
    
    // Calculate hashes for all files
    console.log('[App] Starting file hash calculation for', selectedFiles.length, 'files');
    const hashMap = new Map<number, string>();
    try {
      await Promise.all(
        selectedFiles.map(async (file, index) => {
          try {
            const hash = await calculateQuickFileHash(file);
            hashMap.set(index, hash);
            console.log('[App] Hash calculated for file', index, ':', file.name, '->', hash.substring(0, 16) + '...');
          } catch (err) {
            console.error(`[App] Failed to hash file ${file.name}:`, err);
          }
        })
      );
      setFileHashes(hashMap);
      console.log('[App] All hashes calculated. Total:', hashMap.size);
    } catch (err) {
      console.error('[App] Error calculating file hashes:', err);
    }

    try {
      const result = await processFiles(selectedFiles, 0, [], hashMap);
      if (result?.error) {
        setStatus(FileStatus.ERROR);
        setError(result.error);
      }
    } catch (error: any) {
      setStatus(FileStatus.ERROR);
      setError(
        error.message || "An unexpected error occurred while processing files"
      );
    }
  };

  const processFiles = async (
    filesToProcess: File[],
    startIndex: number = 0,
    existingStatements: MPesaStatement[] = [],
    hashMap?: Map<number, string>
  ) => {
    const processedStatements: MPesaStatement[] = [...existingStatements];

    for (let i = startIndex; i < filesToProcess.length; i++) {
      setCurrentFileIndex(i);
      const file = filesToProcess[i];

      try {
        // Get cached password if available
        const fileHash = (hashMap || fileHashes).get(i);
        console.log('[App] Processing file', i, '- Hash:', fileHash ? fileHash.substring(0, 16) + '...' : 'NO HASH');
        const foundCachedPassword = fileHash ? getPassword(fileHash) : null;
        console.log('[App] Cached password for file', i, ':', foundCachedPassword ? '***FOUND***' : 'NOT FOUND');
        
        const result = (await Promise.race([
          PdfService.loadPdf(file),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("PDF loading timeout after 30 seconds")),
              30000
            )
          ),
        ])) as { isProtected: boolean; pdf?: any };

        if (result.isProtected) {
          // Set cached password so the PasswordPrompt can auto-fill
          if (foundCachedPassword) {
            console.log('[App] ✅ Setting cached password for auto-fill');
            setCachedPassword(foundCachedPassword);
          }
          setStatus(FileStatus.PROTECTED);
          return { needsPassword: true, fileIndex: i, processedStatements };
        } else if (result.pdf) {
          setStatus(FileStatus.PROCESSING);
          console.log('[App] ℹ️ No password needed for:', file.name);
          
          const statement = (await Promise.race([
            PdfService.parseMpesaStatement(result.pdf),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("PDF parsing timeout after 60 seconds")),
                60000
              )
            ),
          ])) as MPesaStatement;

          statement.fileName = file.name;
          processedStatements.push(statement);
        } else {
          throw new Error("No PDF data returned from loadPdf");
        }
      } catch (err: any) {
        setStatus(FileStatus.ERROR);
        setError(err.message || "Failed to process the PDF file");
        return {
          needsPassword: false,
          fileIndex: i,
          processedStatements,
          error: err.message,
        };
      }
    }

    if (processedStatements.length > 0) {
      const combinedStatement = combineStatements(processedStatements);
      setStatements([combinedStatement]);

      const fileName = ExportService.getFileName(
        combinedStatement,
        exportFormat,
        formatDateForFilename()
      );

      ExportService.createDownloadLink(
        combinedStatement,
        exportFormat,
        exportOptions
      )
        .then(setExportLink)
        .catch(() => setExportLink(""));
      setExportFileName(fileName);
      setStatus(FileStatus.SUCCESS);
      
      // Save to recent files history
      console.log('[App] Normal flow complete - saving to history');
      saveToRecentFiles(filesToProcess, combinedStatement, hashMap || fileHashes);
    }

    return {
      needsPassword: false,
      fileIndex: filesToProcess.length,
      processedStatements,
    };
  };

  const combineStatements = (statements: MPesaStatement[]): MPesaStatement => {
    if (statements.length === 1) {
      return statements[0];
    }

    const allTransactions = statements.flatMap((s) => s.transactions);

    allTransactions.sort((a, b) => {
      const dateA = new Date(a.completionTime);
      const dateB = new Date(b.completionTime);
      return dateA.getTime() - dateB.getTime();
    });

    return {
      transactions: allTransactions,
      fileName: `Combined_${statements.length}_statements`,
    };
  };

  const handlePasswordSubmit = async (password: string) => {
    if (files.length === 0) return;

    setStatus(FileStatus.PROCESSING);
    setError(undefined);
    setCachedPassword(null); // Clear cached password after use

    try {
      const currentFile = files[currentFileIndex];
      const pdf = await PdfService.unlockPdf(currentFile, password);

      // Save password to cache if file was successfully unlocked
      const fileHash = fileHashes.get(currentFileIndex);
      console.log('[App] Attempting to save password for file', currentFileIndex);
      console.log('[App] File hash:', fileHash ? fileHash.substring(0, 16) + '...' : 'NO HASH FOUND');
      console.log('[App] Current fileHashes map size:', fileHashes.size);
      console.log('[App] All hashes in map:', Array.from(fileHashes.entries()).map(([k, v]) => `${k}: ${v.substring(0, 16)}...`));
      
      if (fileHash) {
        console.log('[App] ✅ Saving password to cache for:', currentFile.name);
        savePassword(fileHash, password, currentFile.name);
        console.log('[App] ✅ Password saved successfully');
      } else {
        console.error('[App] ❌ Cannot save password - no hash found for file index:', currentFileIndex);
      }

      const statement = await PdfService.parseMpesaStatement(pdf);
      statement.fileName = currentFile.name;

      const updatedStatements = [...statements, statement];
      setStatements(updatedStatements);

      const nextIndex = currentFileIndex + 1;
      if (nextIndex < files.length) {
        const result = await processFiles(files, nextIndex, updatedStatements);
        if (result?.error) {
          setStatus(FileStatus.ERROR);
          setError(result.error);
        }
      } else {
        const combinedStatement = combineStatements(updatedStatements);
        const fileName = ExportService.getFileName(
          combinedStatement,
          exportFormat,
          formatDateForFilename()
        );

        ExportService.createDownloadLink(
          combinedStatement,
          exportFormat,
          exportOptions
        )
          .then(setExportLink)
          .catch(() => setExportLink(""));
        setExportFileName(fileName);
        setStatus(FileStatus.SUCCESS);
        
        // Save to recent files history after password submission
        console.log('[App] Password flow complete - saving to history');
        saveToRecentFiles(files, combinedStatement, fileHashes);
      }
    } catch (err: any) {
      setStatus(FileStatus.PROTECTED);
      setError(err.message || "Failed to unlock the PDF file");
    }
  };

  const handleSkipFile = async () => {
    if (files.length === 0) return;

    setError(undefined);
    setCachedPassword(null); // Clear cached password when skipping
    const nextIndex = currentFileIndex + 1;

    if (nextIndex < files.length) {
      const result = await processFiles(files, nextIndex, statements);
      if (result?.error) {
        setStatus(FileStatus.ERROR);
        setError(result.error);
      }
    } else {
      if (statements.length > 0) {
        const combinedStatement = combineStatements(statements);
        const fileName = ExportService.getFileName(
          combinedStatement,
          exportFormat,
          formatDateForFilename()
        );

        ExportService.createDownloadLink(
          combinedStatement,
          exportFormat,
          exportOptions
        )
          .then(setExportLink)
          .catch(() => setExportLink(""));
        setExportFileName(fileName);
        setStatus(FileStatus.SUCCESS);
        
        // Save to recent files history after skip
        console.log('[App] Skip flow complete - saving to history');
        saveToRecentFiles(files, combinedStatement, fileHashes);
      } else {
        setStatus(FileStatus.IDLE);
        setFiles([]);
        setCurrentFileIndex(0);
      }
    }
  };

  const saveToRecentFiles = (
    processedFiles: File[],
    statement: MPesaStatement,
    hashMap: Map<number, string>
  ) => {
    console.log('[RecentFiles] saveToRecentFiles called');
    console.log('[RecentFiles] Processing', processedFiles.length, 'files');
    console.log('[RecentFiles] Statement has', statement.transactions.length, 'transactions');
    console.log('[RecentFiles] HashMap size:', hashMap.size);
    
    processedFiles.forEach((file, index) => {
      const fileHash = hashMap.get(index);
      console.log(`[RecentFiles] File ${index}:`, file.name, 'Hash:', fileHash ? fileHash.substring(0, 16) + '...' : 'NO HASH');
      
      if (!fileHash) {
        console.error('[RecentFiles] ❌ Skipping file - no hash found for index:', index);
        return;
      }

      // Calculate date range from transactions
      const transactions = statement.transactions;
      let dateRange = undefined;
      if (transactions.length > 0) {
        const dates = transactions.map(t => new Date(t.completionTime));
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
        dateRange = {
          from: minDate.toLocaleDateString(),
          to: maxDate.toLocaleDateString(),
        };
        console.log('[RecentFiles] Date range:', dateRange);
      }

      // Calculate totals
      const totalPaidIn = transactions.reduce((sum, t) => sum + (t.paidIn || 0), 0);
      const totalWithdrawn = transactions.reduce((sum, t) => sum + (t.withdrawn || 0), 0);
      const finalBalance = transactions.length > 0 
        ? transactions[transactions.length - 1].balance 
        : 0;
      
      console.log('[RecentFiles] Totals - Paid In:', totalPaidIn, 'Withdrawn:', totalWithdrawn, 'Balance:', finalBalance);

      const recentFileEntry = {
        id: `${fileHash}-${Date.now()}`,
        fileName: file.name,
        fileSize: file.size,
        fileHash,
        processedDate: Date.now(),
        transactionCount: transactions.length,
        isPasswordProtected: !!getPassword(fileHash),
        dateRange,
        totalPaidIn,
        totalWithdrawn,
        finalBalance,
      };
      
      console.log('[RecentFiles] Adding entry:', recentFileEntry);
      addRecentFile(recentFileEntry);
      console.log('[RecentFiles] ✅ Entry added successfully');
    });
    
    console.log('[RecentFiles] saveToRecentFiles completed');
  };

  const handleReset = () => {
    setFiles([]);
    setFileHashes(new Map());
    setStatus(FileStatus.IDLE);
    setError(undefined);
    setStatements([]);
    setCurrentFileIndex(0);
    setIsDownloading(false);
    setDownloadSuccess(false);
    setSavedFilePath("");
    setCachedPassword(null);
    setShowHistory(false);

    if (exportLink) {
      URL.revokeObjectURL(exportLink);
      setExportLink("");
      setExportFileName("");
    }
  };

  const handleDownloadError = (error: any) => {
    const errorMessage =
      typeof error === "string" ? error : error.message || error.toString();

    if (errorMessage.includes("cancelled")) {
      setError(undefined);
    } else if (errorMessage.includes("permission")) {
      setError(
        "Permission denied. Please check app permissions and try again."
      );
    } else if (errorMessage.includes("space")) {
      setError("Not enough storage space. Please free up space and try again.");
    } else {
      setError(`Failed to save file: ${errorMessage}`);
    }
  };

  const handleDownload = async () => {
    if (statements.length === 0 || isDownloading) return;

    setIsDownloading(true);
    setError(undefined);

    try {
      const combinedStatement = statements[0];
      const fileName = getDefaultFileName();

      if (currentPlatform === "android") {
        const arrayBuffer = await ExportService.getFileBuffer(
          combinedStatement,
          exportFormat,
          exportOptions
        );

        const mimeType =
          exportFormat === ExportFormat.CSV
            ? "text/csv"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

        const dataArray = Array.from(new Uint8Array(arrayBuffer));

        const result = await invoke<{
          fileName: string;
          path?: string;
          uri?: string;
        }>("plugin:pldownloader|save_file_public_from_buffer", {
          payload: {
            data: dataArray,
            fileName: fileName,
            mimeType: mimeType,
          },
        });

        setError(undefined);
        setDownloadSuccess(true);

        const filePath = result.path || result.uri || fileName;
        setSavedFilePath(filePath);
      } else {
        const contentArray = await prepareFileContent(combinedStatement);

        const invokeParams = {
          content: contentArray,
          defaultFilename: fileName,
          fileType: ExportService.getFileExtension(exportFormat),
        };

        const result = await invoke<string>("save_file", invokeParams);

        setError(undefined);
        setDownloadSuccess(true);
        setSavedFilePath(result);
      }
    } catch (error: any) {
      handleDownloadError(error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenFile = async () => {
    try {
      if (savedFilePath) {
        const filePath = savedFilePath.replace(
          "File saved successfully to: ",
          ""
        );
        await invoke("open_file", { path: filePath });
      }
    } catch (error: any) {
      setError(`Failed to open file: ${error.message || error.toString()}`);
    }
  };

  useEffect(() => {
    return () => {
      if (exportLink) {
        URL.revokeObjectURL(exportLink);
      }
    };
  }, [exportLink]);

  return (
    <div className="min-h-screen max-h-screen  flex flex-col overflow-hidden">
      <UpdateChecker autoCheck={true} />
      
      {/* History Modal Overlay */}
      {showHistory && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowHistory(false);
            }
          }}
        >
          <div className="rounded-lg shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden border">
            <RecentFilesHistory onClose={() => setShowHistory(false)} />
          </div>
        </div>
      )}
      
      <div className="flex-1 mx-auto px-4 py-4 flex flex-col max-w-4xl w-full">
        <main className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-2xl transition-all duration-300 ease-in-out">
            {status === FileStatus.IDLE ||
            status === FileStatus.LOADING ||
            status === FileStatus.ERROR ? (
              <div className="space-y-3 transition-all duration-300">
                <FileUploader
                  onFilesSelected={handleFilesSelected}
                  status={status}
                />
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 transition-all duration-300">
                    <p className="text-destructive text-sm">{error}</p>
                  </div>
                )}
              </div>
            ) : status === FileStatus.PROTECTED ? (
              <div className="transition-all duration-300">
                <PasswordPrompt
                  onPasswordSubmit={handlePasswordSubmit}
                  onSkip={handleSkipFile}
                  onReset={handleReset}
                  status={status}
                  error={error}
                  currentFileName={files[currentFileIndex]?.name}
                  currentFileIndex={currentFileIndex}
                  totalFiles={files.length}
                  defaultPassword={cachedPassword}
                />
              </div>
            ) : status === FileStatus.PROCESSING ? (
              <div className=" p-6 text-center flex flex-col items-center justify-center transition-all duration-300 min-h-[300px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-center">
                  Processing file {currentFileIndex + 1} of {files.length}...
                </p>
                {files[currentFileIndex] && (
                  <p className="text-sm text-muted-foreground mt-2 truncate max-w-full">
                    {files[currentFileIndex].name}
                  </p>
                )}
              </div>
            ) : status === FileStatus.SUCCESS && statements.length > 0 ? (
              <div className="rounded-lg px-6 py-6 transition-all duration-300 ">
                <div className="text-center mb-5">
                  <h2 className="text-xl font-semibold text-primary mb-2">
                    ✅ Your Data is Ready!
                  </h2>
                  <p className="">
                    Processed {statements[0].transactions.length} transactions
                    from {files.length} statement{files.length > 1 ? "s" : ""} •
                    Choose your export options below
                  </p>
                </div>

                <div className="mb-4">
                  <ExportOptions
                    exportFormat={exportFormat}
                    exportOptions={exportOptions}
                    onFormatChange={handleFormatChange}
                    onOptionsChange={handleOptionsChange}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center mb-5">
                  {!downloadSuccess ? (
                    <Button
                      onClick={handleDownload}
                      disabled={isDownloading}
                      size="lg"
                      className="px-6"
                    >
                      {isDownloading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                          Preparing Export...
                        </>
                      ) : (
                        <>
                          <Download className="w-5 h-5" />
                          Export as{" "}
                          {ExportService.getFormatDisplayName(exportFormat)}
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="flex flex-row items-center gap-1">
                      <Button
                        onClick={handleOpenFile}
                        variant="outline"
                        size="lg"
                        className="px-6 text-foreground"
                      >
                        <ExternalLink className="w-5 h-5" />
                        Open File
                      </Button>
                    </div>
                  )}

                  <Button
                    onClick={handleReset}
                    variant="outline"
                    size="lg"
                    className="px-6 text-foreground"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Start Again
                  </Button>
                </div>

                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-center truncate">
                    File: {exportFileName}
                  </p>
                  {downloadSuccess && savedFilePath && (
                    <p className="text-xs text-center mt-1 truncate">
                      Saved to: {savedFilePath}
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </main>

        <footer className="flex-shrink-0 text-center text-xs border-t py-3 mt-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <p>
                Built by{" "}
                <a
                  href="https://twitter.com/davidamunga_"
                  className="text-green-500 hover:text-green-500/80 font-medium transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @davidamunga
                </a>
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(true)}
                className="flex items-center gap-1 text-xs"
              >
                <History className="w-3 h-3" />
                History
              </Button>
            </div>
            <div className="flex items-center gap-3">
              {appVersion && <span className="">v{appVersion}</span>}
              <UpdateChecker showButton={true} />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
