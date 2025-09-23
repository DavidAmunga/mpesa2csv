import * as pdfjsLib from "pdfjs-dist";

// Setup worker
if (typeof window !== "undefined") {
  // Try local worker first
  const workerSrc = "/pdf.worker.min.mjs";

  // Set up the worker with fallbacks
  const setupWorker = async () => {
    try {
      // Test if the worker is accessible
      const response = await fetch(workerSrc, { method: "HEAD" });
      if (response.ok) {
        console.log("Using local PDF.js worker");
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
        return;
      }
    } catch (e) {
      console.warn("Could not access local PDF.js worker, trying CDN...");
    }

    // Try CDN
    const cdnSources = [
      // Try unpkg
      `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`,
      // Try cdnjs
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`,
      // Try jsdelivr
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`,
    ];

    for (const cdnSrc of cdnSources) {
      try {
        const response = await fetch(cdnSrc, { method: "HEAD" });
        if (response.ok) {
          console.log("Using PDF.js worker from CDN:", cdnSrc);
          pdfjsLib.GlobalWorkerOptions.workerSrc = cdnSrc;
          return;
        }
      } catch (e) {
        console.warn(`Failed to load worker from ${cdnSrc}`);
      }
    }

    // Last resort: try to use the default worker
    console.warn(
      "All attempts to load PDF.js worker failed, trying default options"
    );
    // This might not work, but it's our last option
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      // If all else fails, try to use a default worker src
      pdfjsLib.GlobalWorkerOptions.workerSrc = "pdf.worker.js";
    }
  };

  // Start the worker setup process
  setupWorker();
}

export default pdfjsLib;
