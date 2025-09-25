import { useState, useEffect } from "react";
import {
  MPesaStatement,
  FileStatus,
  ExportFormat,
  ExportOptions,
} from "./types";
import { PdfService } from "./services/pdfService";
import { ExportService } from "./services/exportService";
import FileUploader from "./components/file-uploader";
import PasswordPrompt from "./components/password-prompt";
import { Download, RotateCcw } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import dayjs from "dayjs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import { Button } from "./components/ui/button";
import { Checkbox } from "./components/ui/checkbox";

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
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeChargesSheet: false,
  });
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const formatDateForFilename = (): string => {
    return dayjs().format("YYYY-MM-DD_HH-mm-ss");
  };

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
          setStatus(FileStatus.PROTECTED);
          return { needsPassword: true, fileIndex: i, processedStatements };
        } else if (result.pdf) {
          setStatus(FileStatus.PROCESSING);
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

      // Generate download link asynchronously
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
      const pdf = await PdfService.unlockPdf(currentFile, password);

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
      }
    } catch (err: any) {
      setStatus(FileStatus.PROTECTED);
      setError(err.message || "Failed to unlock the PDF file");
    }
  };

  const handleReset = () => {
    setFiles([]);
    setStatus(FileStatus.IDLE);
    setError(undefined);
    setStatements([]);
    setCurrentFileIndex(0);
    setIsDownloading(false);

    if (exportLink) {
      URL.revokeObjectURL(exportLink);
      setExportLink("");
      setExportFileName("");
    }
  };

  const handleDownload = async () => {
    if (statements.length === 0 || isDownloading) return;

    setIsDownloading(true);
    setError(undefined);

    try {
      const combinedStatement = statements[0];

      const arrayBuffer = await ExportService.getFileBuffer(
        combinedStatement,
        exportFormat,
        exportOptions
      );
      const content = new Uint8Array(arrayBuffer);

      await invoke<string>("save_file", {
        content: Array.from(content),
        defaultFilename:
          exportFileName ||
          `mpesa_statement.${ExportService.getFileExtension(exportFormat)}`,
        fileType: ExportService.getFileExtension(exportFormat),
      });

      setError(undefined);
    } catch (error: any) {
      if (error.includes("cancelled")) {
        setError(undefined);
      } else {
        setError("Failed to save file. Please try again.");
      }
    }

    setIsDownloading(false);
  };

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      if (exportLink) {
        URL.revokeObjectURL(exportLink);
      }
    };
  }, [exportLink]);

  return (
    <div className="min-h-screen max-h-screen  flex flex-col overflow-hidden">
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
                  status={status}
                  error={error}
                  currentFileName={files[currentFileIndex]?.name}
                  currentFileIndex={currentFileIndex}
                  totalFiles={files.length}
                />
              </div>
            ) : status === FileStatus.PROCESSING ? (
              <div className="rounded-lg shadow-sm p-6 text-center flex flex-col items-center justify-center transition-all duration-300 min-h-[300px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-foreground">
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
                    🎉 Conversion Complete!
                  </h2>
                  <p className="">
                    Successfully converted {files.length} PDF file
                    {files.length > 1 ? "s" : ""} with{" "}
                    {statements[0].transactions.length} transactions
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium   mb-2">
                    Export Format
                  </label>
                  <Select
                    value={exportFormat}
                    onValueChange={(value: ExportFormat) => {
                      setExportFormat(value);
                      const combinedStatement = statements[0];
                      const fileName = ExportService.getFileName(
                        combinedStatement,
                        value,
                        formatDateForFilename()
                      );

                      ExportService.createDownloadLink(
                        combinedStatement,
                        value,
                        exportOptions
                      )
                        .then(setExportLink)
                        .catch(() => setExportLink(""));
                      setExportFileName(fileName);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select export format">
                        {ExportService.getFormatDisplayName(exportFormat)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {ExportService.getAllFormats().map((format) => (
                        <SelectItem key={format} value={format}>
                          {ExportService.getFormatDisplayName(format)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {exportFormat === ExportFormat.XLSX && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">
                      Additional Sheets
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <Checkbox
                          checked={exportOptions.includeChargesSheet}
                          onCheckedChange={(value) => {
                            const newOptions = {
                              ...exportOptions,
                              includeChargesSheet: Boolean(value),
                            };
                            setExportOptions(newOptions);

                            // Regenerate download link with new options
                            const combinedStatement = statements[0];
                            ExportService.createDownloadLink(
                              combinedStatement,
                              exportFormat,
                              newOptions
                            )
                              .then(setExportLink)
                              .catch(() => setExportLink(""));
                          }}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm">
                          Include Charges/Fees Sheet
                        </span>
                      </label>
                      <p className="text-xs text-muted-foreground ml-6">
                        Creates a separate sheet with all transaction charges
                        and fees
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-center mb-5">
                  <Button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    size="lg"
                    className="px-6"
                  >
                    {isDownloading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        Download{" "}
                        {ExportService.getFormatDisplayName(exportFormat)}
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleReset}
                    variant="outline"
                    size="lg"
                    className="px-6 text-foreground"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Process More Files
                  </Button>
                </div>

                <div className="pt-3 border-t border-border">
                  <p className="text-xs  text-center truncate">
                    File: {exportFileName}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </main>

        <footer className="flex-shrink-0 text-center text-xs border-t py-3 mt-0">
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
        </footer>
      </div>
    </div>
  );
}

export default App;
