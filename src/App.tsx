import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";
import { Download, RotateCcw, ExternalLink } from "lucide-react";

import {
  MPesaStatement,
  FileStatus,
  ExportFormat,
  ExportOptions as ExportOptionsType,
} from "./types";
import { TabulaService } from "./services/tabulaService";
import { ExportService } from "./services/exportService";
import FileUploader from "./components/file-uploader";
import PasswordPrompt from "./components/password-prompt";
import ExportOptions from "./components/export-options";
import { UpdateChecker } from "./components/update-checker";
import { Button } from "./components/ui/button";
import { formatDateForFilename } from "./utils/helpers";

function App() {
  const [files, setFiles] = useState<File[]>([]);
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
    setFiles(selectedFiles);
    setStatus(FileStatus.LOADING);
    setError(undefined);
    setStatements([]);
    setCurrentFileIndex(0);

    try {
      const result = await processFiles(selectedFiles);
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
    existingStatements: MPesaStatement[] = []
  ) => {
    const processedStatements: MPesaStatement[] = [...existingStatements];

    for (let i = startIndex; i < filesToProcess.length; i++) {
      setCurrentFileIndex(i);
      const file = filesToProcess[i];

      try {
        setStatus(FileStatus.PROCESSING);

        const csvContent = await Promise.race([
          TabulaService.extractTablesFromPdf(file),
          new Promise<string>((_, reject) =>
            setTimeout(
              () =>
                reject(new Error("PDF processing timeout after 60 seconds")),
              60000
            )
          ),
        ]);

        const statement = TabulaService.parseTabulaCSV(csvContent);
        statement.fileName = file.name;
        processedStatements.push(statement);
      } catch (err: any) {
        if (
          err.message?.includes("password") ||
          err.message?.includes("encrypted") ||
          err.message?.includes("protected")
        ) {
          setStatus(FileStatus.PROTECTED);
          return { needsPassword: true, fileIndex: i, processedStatements };
        }

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

    try {
      const currentFile = files[currentFileIndex];

      const csvContent = await TabulaService.extractTablesFromPdf(
        currentFile,
        password
      );
      const statement = TabulaService.parseTabulaCSV(csvContent);
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
      }
    } catch (err: any) {
      setStatus(FileStatus.PROTECTED);
      setError(err.message || "Incorrect password. Please try again.");
    }
  };

  const handleSkipFile = async () => {
    if (files.length === 0) return;

    setError(undefined);
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
      } else {
        setStatus(FileStatus.IDLE);
        setFiles([]);
        setCurrentFileIndex(0);
      }
    }
  };

  const handleReset = () => {
    setFiles([]);
    setStatus(FileStatus.IDLE);
    setError(undefined);
    setStatements([]);
    setCurrentFileIndex(0);
    setIsDownloading(false);
    setDownloadSuccess(false);
    setSavedFilePath("");

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
      console.error(error);
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
    <div className="min-h-screen flex flex-col">
      <UpdateChecker autoCheck={true} />
      <div className="flex-1 mx-auto px-4 py-4 flex flex-col max-w-4xl w-full overflow-y-auto">
        <main className="flex-1 flex items-center justify-center py-4">
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
                />
              </div>
            ) : status === FileStatus.PROCESSING ? (
              <div className="p-6 text-center flex flex-col items-center justify-center transition-all duration-300 min-h-[300px]">
                <div className="relative mb-6 w-20 h-20">
                  <div className="w-20 h-20 rounded-full bg-primary/20 animate-ping absolute"></div>
                  <div className="w-20 h-20 rounded-full bg-primary/40 animate-pulse absolute"></div>
                  <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center relative">
                    <span className="text-2xl">📊</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-lg font-semibold">
                    Processing Your Statements
                  </p>
                  <p className="text-sm text-muted-foreground">
                    File {currentFileIndex + 1} of {files.length}
                  </p>

                  {/* Progress bar */}
                  <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: `${
                          ((currentFileIndex + 1) / files.length) * 100
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>

                {files[currentFileIndex] && (
                  <p className="text-xs text-muted-foreground mt-4 truncate max-w-full px-4">
                    {files[currentFileIndex].name}
                  </p>
                )}
              </div>
            ) : status === FileStatus.SUCCESS && statements.length > 0 ? (
              <div className="rounded-lg px-6 py-6 transition-all duration-300 max-h-full overflow-y-auto">
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

        <footer className="flex-shrink-0 text-center text-xs border-t py-3 mt-4 sticky bottom-0 ">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
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
