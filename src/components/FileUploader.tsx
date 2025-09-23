import React, { useState, useRef, ChangeEvent, useEffect } from "react";
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

  // Prevent browser's default drag and drop behavior
  useEffect(() => {
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
  }, []);

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    console.log("Drag event:", e.type);
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      // Use a more reliable method to check if we're truly leaving the drop zone
      const relatedTarget = e.relatedTarget as Element;
      if (!e.currentTarget.contains(relatedTarget)) {
        setDragActive(false);
      }
    }
  };

  const isPdfFile = (file: File): boolean => {
    // Check MIME type first
    if (file.type === "application/pdf") {
      return true;
    }

    // Fallback to file extension if MIME type is not set correctly
    const fileName = file.name.toLowerCase();
    return fileName.endsWith(".pdf");
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    console.log("Drop event triggered", e);
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    try {
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const files: File[] = [];
        const allFiles = Array.from(e.dataTransfer.files);

        console.log(`Dropped ${allFiles.length} files`);

        for (const file of allFiles) {
          console.log(
            `File: ${file.name}, Type: ${file.type}, Size: ${file.size}`
          );
          if (isPdfFile(file)) {
            files.push(file);
          }
        }

        console.log(`Valid PDF files: ${files.length}`);

        if (files.length > 0) {
          onFilesSelected(files);
        } else {
          alert("Please drop only PDF files.");
        }

        // Clear the dataTransfer
        e.dataTransfer.clearData();
      } else {
        console.log("No files in drop event");
      }
    } catch (error) {
      console.error("Error handling drop:", error);
      alert("Error processing dropped files. Please try again.");
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files: File[] = [];
      const allFiles = Array.from(e.target.files);

      console.log(`Selected ${allFiles.length} files`);

      for (const file of allFiles) {
        console.log(
          `File: ${file.name}, Type: ${file.type}, Size: ${file.size}`
        );
        if (isPdfFile(file)) {
          files.push(file);
        }
      }

      console.log(`Valid PDF files: ${files.length}`);

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
      className={`card text-center transition-all duration-300 rounded-lg p-8 min-h-[300px] flex items-center justify-center ${
        dragActive
          ? "border-4 border-green-500 bg-green-50 shadow-lg scale-105 transform"
          : "border-2 hover:bg-green-500/5 border-dashed hover:border-green-500 cursor-pointer border-gray-300 bg-white shadow-sm hover:shadow-md"
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      aria-label="Drop PDF files here or click to select files"
    >
      <div className="flex flex-col items-center justify-center space-y-4">
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

        <div className="text-xs text-gray-500 mt-6">
          Your M-PESA statements will be processed locally. No data is sent to
          any server.
        </div>
      </div>
    </div>
  );
};

export default FileUploader;
