import React, { useState, useRef, ChangeEvent, useEffect } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { FileStatus } from "../types";

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
  status: FileStatus;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  onFilesSelected,
  status,
}) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set up Tauri webview drag-drop event listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupDragDropListener = async () => {
      try {
        const webview = getCurrentWebview();

        unlisten = await webview.onDragDropEvent((event) => {
          if (event.payload.type === "over") {
            setDragActive(true);
          } else if (event.payload.type === "drop") {
            setDragActive(false);
            handleTauriDrop(event.payload.paths);
          } else {
            setDragActive(false);
          }
        });
      } catch (error) {
        setupBrowserDragDrop();
      }
    };

    const setupBrowserDragDrop = () => {
      const preventDefaults = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
      };

      const events = ["dragenter", "dragover", "dragleave", "drop"];

      events.forEach((eventName) => {
        document.addEventListener(eventName, preventDefaults, false);
      });

      return () => {
        events.forEach((eventName) => {
          document.removeEventListener(eventName, preventDefaults, false);
        });
      };
    };

    setupDragDropListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const isPdfFile = (file: File): boolean => {
    if (file.type === "application/pdf") {
      return true;
    }

    const fileName = file.name.toLowerCase();
    return fileName.endsWith(".pdf");
  };

  const isPdfFilePath = (filePath: string): boolean => {
    return filePath.toLowerCase().endsWith(".pdf");
  };

  const handleTauriDrop = async (filePaths: string[]) => {
    try {
      const pdfPaths = filePaths.filter(isPdfFilePath);

      if (pdfPaths.length === 0) {
        alert("Please drop only PDF files.");
        return;
      }

      const files: File[] = [];

      for (const filePath of pdfPaths) {
        try {
          const { readFile } = await import("@tauri-apps/plugin-fs");
          const fileContent = await readFile(filePath);

          const fileName = filePath.split(/[\\/]/).pop() || "unknown.pdf";

          const file = new File([fileContent], fileName, {
            type: "application/pdf",
          });
          files.push(file);
        } catch (error) {
          // Silently skip files that can't be read
        }
      }

      if (files.length > 0) {
        onFilesSelected(files);
      } else {
        alert("Failed to read the dropped PDF files. Please try again.");
      }
    } catch (error) {
      alert("Error processing dropped files. Please try again.");
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files: File[] = [];
      const allFiles = Array.from(e.target.files);

      for (const file of allFiles) {
        if (isPdfFile(file)) {
          files.push(file);
        }
      }

      if (files.length > 0) {
        onFilesSelected(files);
      } else {
        alert("Please select only PDF files.");
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`card text-center transition-all duration-300 rounded-lg p-6 min-h-[250px] flex items-center justify-center ${
        dragActive
          ? "border-4 border-green-500 bg-green-50 dark:bg-green-900/20 shadow-lg scale-105 transform"
          : "border-2 hover:bg-green-500/5 dark:hover:bg-green-500/10 border-dashed hover:border-green-500 cursor-pointer border-gray-300 dark:border-gray-600 bg-white dark:bg-zinc-800 shadow-sm hover:shadow-md"
      }`}
      role="button"
      tabIndex={0}
      aria-label="Drop PDF files here or click to select files"
    >
      <div className="flex flex-col items-center justify-center space-y-3">
        <span
          className={`text-4xl font-bold transition-transform duration-300 ${
            dragActive ? "scale-125" : ""
          }`}
        >
          {dragActive ? "📂✨" : "💸→📝"}
        </span>
        <h3
          className={`text-xl font-semibold transition-colors duration-300 ${
            dragActive
              ? "text-green-600 dark:text-green-400"
              : "text-green-700 dark:text-green-300"
          }`}
        >
          {dragActive
            ? "Drop your PDF files here!"
            : "Convert M-PESA PDF's to CSV"}
        </h3>

        <p
          className={`max-w-md transition-colors duration-300 ${
            dragActive
              ? "text-green-600 dark:text-green-400 font-medium"
              : "text-gray-600 dark:text-gray-300"
          }`}
        >
          {dragActive
            ? "Release to upload your M-PESA statement PDFs"
            : "Convert your PDF statements to CSV format instantly. Drag & drop multiple files or click below to get started."}
        </p>

        {!dragActive && (
          <button
            type="button"
            onClick={handleButtonClick}
            className="cursor-pointer bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-md shadow-md hover:shadow-lg transition-all"
            disabled={
              status === FileStatus.LOADING || status === FileStatus.PROCESSING
            }
          >
            {status === FileStatus.LOADING
              ? "Loading Files..."
              : "Choose PDF Files"}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="application/pdf"
          onChange={handleFileChange}
          multiple
        />

        {status === FileStatus.LOADING && (
          <div className="mt-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500 mx-auto"></div>
          </div>
        )}

        <div className="text-xs text-gray-500 dark:text-gray-400 mt-4 flex items-center justify-center gap-1">
          🔒 <strong>100% Private:</strong> All processing happens on your
          device. No data leaves your computer.
        </div>
      </div>
    </div>
  );
};

export default FileUploader;
