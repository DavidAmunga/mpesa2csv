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
          ? "border-4 border-green-500 bg-green-50 shadow-lg scale-105 transform"
          : "border-2 hover:bg-green-500/5 border-dashed hover:border-green-500 cursor-pointer border-gray-300 bg-white shadow-sm hover:shadow-md"
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
            dragActive ? "text-green-600" : "text-green-700"
          }`}
        >
          {dragActive
            ? "Drop your PDF files here!"
            : "Upload M-PESA Statement PDFs"}
        </h3>

        <p
          className={`max-w-md transition-colors duration-300 ${
            dragActive ? "text-green-600 font-medium" : "text-gray-600"
          }`}
        >
          {dragActive
            ? "Release to upload your M-PESA statement PDFs"
            : "Drag and drop your M-PESA statement PDFs here, or click the button below to select files. You can select multiple files at once."}
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
              ? "Uploading..."
              : "Select PDF Files"}
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

        <div className="text-xs text-gray-500 mt-4">
          Your M-PESA statements will be processed locally. No data is sent to
          any server.
        </div>
      </div>
    </div>
  );
};

export default FileUploader;
