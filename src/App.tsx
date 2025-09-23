import { useState, useEffect } from "react";
import { MPesaStatement, FileStatus } from "./types";
import { PdfService } from "./services/pdfService";
import { CsvService } from "./services/csvService";
import FileUploader from "./components/FileUploader";
import PasswordPrompt from "./components/PasswordPrompt";
import { Download, RotateCcw } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<FileStatus>(FileStatus.IDLE);
  const [error, setError] = useState<string | undefined>(undefined);
  const [statements, setStatements] = useState<MPesaStatement[]>([]);
  const [csvLink, setCsvLink] = useState<string>("");
  const [csvFileName, setCsvFileName] = useState<string>("");
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const handleFilesSelected = async (selectedFiles: File[]) => {
    console.log(
      "handleFilesSelected called with",
      selectedFiles.length,
      "files"
    );
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
      console.error("Error in handleFilesSelected:", error);
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
    console.log(
      "processFiles called with",
      filesToProcess.length,
      "files, starting from index",
      startIndex
    );
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
          // Store the current progress and wait for password
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
        console.error("PDF processing error for file", file.name, ":", err);
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

    // All files processed successfully
    if (processedStatements.length > 0) {
      const combinedStatement = combineStatements(processedStatements);
      setStatements([combinedStatement]);

      // Create CSV download link
      const downloadLink = CsvService.createDownloadLink(combinedStatement);
      const fileName = `Combined_M-PESA_Statements_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

      setCsvLink(downloadLink);
      setCsvFileName(fileName);
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

    // Combine all transactions
    const allTransactions = statements.flatMap((s) => s.transactions);

    // Sort transactions by completion time
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

      // Process the unlocked file
      const statement = await PdfService.parseMpesaStatement(pdf);
      statement.fileName = currentFile.name;

      // Get existing processed statements and add the new one
      const updatedStatements = [...statements, statement];
      setStatements(updatedStatements);

      // Continue processing remaining files from the next index
      const nextIndex = currentFileIndex + 1;
      if (nextIndex < files.length) {
        const result = await processFiles(files, nextIndex, updatedStatements);
        if (result?.error) {
          setStatus(FileStatus.ERROR);
          setError(result.error);
        }
      } else {
        // All files processed - finalize
        const combinedStatement = combineStatements(updatedStatements);
        const downloadLink = CsvService.createDownloadLink(combinedStatement);
        const fileName = `Combined_M-PESA_Statements_${new Date()
          .toISOString()
          .slice(0, 10)}.csv`;

        setCsvLink(downloadLink);
        setCsvFileName(fileName);
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

    // Clean up CSV link
    if (csvLink) {
      URL.revokeObjectURL(csvLink);
      setCsvLink("");
      setCsvFileName("");
    }
  };

  const handleDownload = async () => {
    if (statements.length === 0 || isDownloading) return;

    setIsDownloading(true);
    setError(undefined);

    try {
      const combinedStatement = statements[0];
      const csvContent = CsvService.convertStatementToCsv(combinedStatement);

      // Add BOM for proper CSV encoding
      const BOM = "\uFEFF";
      const csvWithBOM = BOM + csvContent;

      // Use Tauri's native save dialog
      const result = await invoke<string>("save_csv_file", {
        csvContent: csvWithBOM,
        defaultFilename: csvFileName || "mpesa_statement.csv",
      });

      console.log("File saved successfully:", result);
      setError(undefined);
    } catch (error: any) {
      console.error("Download failed:", error);
      if (error.includes("cancelled")) {
        // User cancelled the save dialog, don't show error
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
      if (csvLink) {
        URL.revokeObjectURL(csvLink);
      }
    };
  }, [csvLink]);

  return (
    <div className="min-h-screen bg-white">
      <div className="h-full mx-auto px-6 mt-2">
        <main className="space-y-1">
          {status === FileStatus.IDLE ||
          status === FileStatus.LOADING ||
          status === FileStatus.ERROR ? (
            <div className="space-y-4">
              <FileUploader
                onFilesSelected={handleFilesSelected}
                status={status}
              />
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}
            </div>
          ) : status === FileStatus.PROTECTED ? (
            <PasswordPrompt
              onPasswordSubmit={handlePasswordSubmit}
              status={status}
              error={error}
              currentFileName={files[currentFileIndex]?.name}
              currentFileIndex={currentFileIndex}
              totalFiles={files.length}
            />
          ) : status === FileStatus.PROCESSING ? (
            <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
              <p className="text-gray-600">
                Processing file {currentFileIndex + 1} of {files.length}...
              </p>
              {files[currentFileIndex] && (
                <p className="text-sm text-gray-500 mt-2">
                  {files[currentFileIndex].name}
                </p>
              )}
            </div>
          ) : status === FileStatus.SUCCESS && statements.length > 0 ? (
            <div className="bg-white rounded-lg  h-[80vh] px-8 py-2">
              <div className="text-center mb-2">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Ready to Download!
                </h2>
                <p className="text-gray-600">
                  Successfully processed {files.length} file
                  {files.length > 1 ? "s" : ""} with{" "}
                  {statements[0].transactions.length} transactions
                </p>
              </div>

              <div className="flex flex-col  h-[220px] sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className={`cursor-pointer px-6 py-4 rounded-lg font-medium flex items-center gap-2 justify-center transition-colors ${
                    isDownloading
                      ? "bg-gray-400 cursor-not-allowed text-white"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  }`}
                >
                  {isDownloading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Download CSV
                    </>
                  )}
                </button>

                <button
                  onClick={handleReset}
                  className="cursor-pointer  border border-gray-300 hover:bg-gray-50 px-6 py-3 rounded-lg font-medium flex items-center gap-2 justify-center transition-colors"
                >
                  <RotateCcw className="w-5 h-5" />
                  Process More Files
                </button>
              </div>

              <div className="py-2 border-t border-gray-200">
                <p className="text-sm text-gray-500 text-center">
                  File: {csvFileName}
                </p>
              </div>
            </div>
          ) : null}
        </main>

        <footer className=" text-center text-xs text-gray-500 border-t border-gray-200 pt-4">
          <p>
            Built by{" "}
            <a
              href="https://twitter.com/davidamunga_"
              className="text-green-600 hover:text-green-700 font-medium transition-colors"
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
