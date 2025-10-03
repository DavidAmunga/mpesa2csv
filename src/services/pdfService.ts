import { MPesaStatement, Transaction } from "../types";
import pdfjsLib from "../lib/pdfjs-setup";
import { PDFDocumentProxy } from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  (window as any).pdfjsWorkerSrc || "/pdf.worker.min.mjs";

export class PdfService {
  static async loadPdf(
    file: File
  ): Promise<{ isProtected: boolean; pdf?: PDFDocumentProxy }> {
    const arrayBuffer = await file.arrayBuffer();

    try {
      // Make sure the worker is properly initialized
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        throw new Error("PDF.js worker not properly initialized");
      }

      // Try to load the PDF without a password
      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        password: "",
      }).promise;

      return { isProtected: false, pdf };
    } catch (error: any) {
      // Check if the error is due to password protection
      if (error.name === "PasswordException") {
        return { isProtected: true };
      }
      throw error;
    }
  }

  static async unlockPdf(
    file: File,
    password: string
  ): Promise<PDFDocumentProxy> {
    const arrayBuffer = await file.arrayBuffer();
    try {
      return await pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        password,
      }).promise;
    } catch (error: any) {
      if (error.name === "PasswordException") {
        throw new Error("Incorrect password. Please try again.");
      }
      throw error;
    }
  }

  static async parseMpesaStatement(
    pdf: PDFDocumentProxy
  ): Promise<MPesaStatement> {
    const numPages = pdf.numPages;
    let allText = "";

    for (let i = 1; i <= numPages; i++) {
      const pageText = await this.extractTextFromPage(pdf, i);
      allText += pageText + "\n";
    }

    const transactions = this.parseTransactions(allText);

    return {
      transactions,
    };
  }

  static async extractTextFromPage(
    pdf: PDFDocumentProxy,
    pageNumber: number
  ): Promise<string> {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    let lastY = null;
    let lastX = null;
    let text = "";

    const LINE_TOLERANCE = 2;
    const WORD_TOLERANCE = 8;
    const LARGE_GAP_TOLERANCE = 40;

    const items = textContent.items
      .filter((item) => "str" in item && item.str.trim() !== "")
      .sort((a, b) => {
        if (!("transform" in a) || !("transform" in b)) return 0;
        const yDiff = Math.abs(a.transform[5] - b.transform[5]);
        if (yDiff < LINE_TOLERANCE) {
          // Items on same line (within tolerance)
          return a.transform[4] - b.transform[4]; // Sort by x position
        }
        return b.transform[5] - a.transform[5]; // Sort by y position (top to bottom)
      });

    for (const item of items) {
      if (!("str" in item) || !("transform" in item)) continue;

      const x = item.transform[4];
      const y = item.transform[5];
      const str = item.str;

      if (lastY !== null && Math.abs(y - lastY) > LINE_TOLERANCE) {
        text += "\n";
        lastX = null;
      } else if (lastX !== null && lastY !== null) {
        const xGap = x - lastX;

        if (xGap > LARGE_GAP_TOLERANCE) {
          text += "   ";
        } else if (xGap > WORD_TOLERANCE) {
          text += " ";
        } else if (
          text.length > 0 &&
          !text.endsWith(" ") &&
          !text.endsWith("\n") &&
          xGap > 0
        ) {
          text += " ";
        }
      }

      text += str;
      lastY = y;
      lastX = x + (item.width || 0);
    }

    return text.replace(/[ \t]{5,}/g, "   ");
  }

  /**
   * Parses detailed transactions from the statement text
   * Enhanced to handle multiple M-PESA statement formats
   */
  static parseTransactions(text: string): Transaction[] {
    const transactions: Transaction[] = [];

    const detailedPatterns = [
      /DETAILED\s+STATEMENT[\s\S]*?(?:Receipt\s+No\.|Receipt\s*Number)/i,
      /DETAILED\s+STATEMENT[\s\S]*?(?:[A-Z0-9]{10})/i,
      /Receipt\s+No\s+Completion\s+Time\s+Details/i,
      /[A-Z0-9]{10}\s+\d{4}-\d{2}-\d{2}/i,
    ];

    let detailedSection = "";
    let sectionFound = false;

    for (const pattern of detailedPatterns) {
      const match = text.match(pattern);
      if (match) {
        detailedSection = text.substring(match.index || 0);
        sectionFound = true;
        break;
      }
    }

    if (!sectionFound) {
      const firstTransactionMatch = text.match(
        /[A-Z0-9]{10}\s+\d{4}-\d{2}-\d{2}/i
      );
      if (firstTransactionMatch) {
        detailedSection = text.substring(firstTransactionMatch.index || 0);
        sectionFound = true;
      }
    }

    if (!sectionFound) {
      const anyReceiptMatch = text.match(/[A-Z0-9]{10}/i);
      if (anyReceiptMatch) {
        detailedSection = text;
        sectionFound = true;
      } else {
        return transactions;
      }
    }

    let transactionBlocks = [];

    const receiptPattern =
      /(?:^|\n)([A-Z0-9]{10})\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/gm;
    let match;
    const receiptPositions = [];

    while ((match = receiptPattern.exec(detailedSection)) !== null) {
      receiptPositions.push({
        receiptNo: match[1],
        datetime: match[2],
        startIndex: match.index,
        fullMatch: match[0],
      });
    }

    for (let i = 0; i < receiptPositions.length; i++) {
      const current = receiptPositions[i];
      const next = receiptPositions[i + 1];

      const startIndex = current.startIndex;
      const endIndex = next ? next.startIndex : detailedSection.length;

      const blockContent = detailedSection
        .substring(startIndex, endIndex)
        .trim();

      if (blockContent && !blockContent.includes("Disclaimer:")) {
        transactionBlocks.push(blockContent);
      }
    }

    if (transactionBlocks.length === 0) {
      const lines = detailedSection.split("\n");
      let currentTransaction = "";

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (/^[A-Z0-9]{10}\s+\d{4}-\d{2}-\d{2}/.test(line)) {
          if (currentTransaction.trim()) {
            transactionBlocks.push(currentTransaction.trim());
          }
          currentTransaction = line;
        } else if (currentTransaction && line) {
          currentTransaction += "\n" + line;
        }
      }

      if (currentTransaction.trim()) {
        transactionBlocks.push(currentTransaction.trim());
      }
    }

    if (transactionBlocks.length === 0) {
      const rows = detailedSection.split(
        /(?=[A-Z0-9]{10}\s+\d{4}-\d{2}-\d{2})/
      );
      transactionBlocks = rows.filter((block) =>
        /[A-Z0-9]{10}\s+\d{4}-\d{2}-\d{2}/.test(block)
      );
    }

    for (const block of transactionBlocks) {
      const receiptMatch = block.match(/([A-Z0-9]{10})/);
      if (!receiptMatch) {
        continue;
      }

      const receiptNo = receiptMatch[1].trim();

      const dateMatch = block.match(/\d{4}-\d{2}-\d{2}/);
      const timeMatch = block.match(/\d{2}:\d{2}:\d{2}/);

      let completionTime = "";
      if (dateMatch && timeMatch) {
        completionTime = `${dateMatch[0]} ${timeMatch[0]}`;
      } else if (dateMatch) {
        completionTime = dateMatch[0];
      }

      const statusPattern =
        /\b(COMPLETED|FAILED|PENDING|Completed|Failed|Pending)\b/gi;
      let statusMatch;
      let lastStatusMatch = null;

      while ((statusMatch = statusPattern.exec(block)) !== null) {
        lastStatusMatch = statusMatch;
      }

      const status = lastStatusMatch ? lastStatusMatch[0].trim() : "Unknown";

      // Extract details by removing receipt number, date/time, status, and amounts
      let details = block
        .replace(new RegExp(receiptNo, "g"), "")
        .replace(/\d{4}-\d{2}-\d{2}/g, "")
        .replace(/\d{2}:\d{2}:\d{2}/g, "")
        .replace(/\b(COMPLETED|FAILED|PENDING)\b/gi, "")
        .replace(/[-]?[\d,]+\.\d{2}/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!details.trim()) {
        details = this.extractDetailsFromBlock(
          block,
          receiptNo,
          completionTime,
          status
        );
      }

      if (details.trim().length < 20) {
        const alternativeDetails = this.extractDetailsAlternative(
          block,
          receiptNo,
          completionTime
        );
        if (alternativeDetails.length > details.length) {
          details = alternativeDetails;
        }
      }

      details = details.replace(/[ \t]+/g, " ").replace(/\n[ \t]*/g, "\n");

      let paidIn = null;
      let withdrawn = null;
      let balance = null;

      const paidInPattern = /Paid\s+In\s+[-]?([\d,]+\.\d{2})/i;
      const withdrawnPattern = /Withdrawn\s+[-]?([\d,]+\.\d{2})/i;
      const balancePattern = /Balance\s+[-]?([\d,]+\.\d{2})/i;

      const paidInMatch = block.match(paidInPattern);
      const withdrawnMatch = block.match(withdrawnPattern);
      const balanceMatch = block.match(balancePattern);

      if (paidInMatch) {
        paidIn = this.parseAmount(paidInMatch[1]);
      }

      if (withdrawnMatch) {
        withdrawn = this.parseAmount(withdrawnMatch[1]);
      }

      if (balanceMatch) {
        balance = this.parseAmount(balanceMatch[1]);
      }

      if (!paidIn && !withdrawn && !balance) {
        const amountPattern = /([\d,]+\.\d{2})/g;
        const amounts = [];
        let amountMatch;

        while ((amountMatch = amountPattern.exec(block)) !== null) {
          amounts.push(amountMatch[1]);
        }

        if (amounts.length >= 3) {
          const parsedAmounts = amounts.map((amt) => this.parseAmount(amt));

          balance = parsedAmounts[parsedAmounts.length - 1];

          if (
            details.toLowerCase().includes("business payment from") ||
            details.toLowerCase().includes("merchant payment from") ||
            details.toLowerCase().includes("received") ||
            details.toLowerCase().includes("customer transfer") ||
            details.toLowerCase().includes("b2c payment")
          ) {
            paidIn = parsedAmounts[0];
            if (parsedAmounts.length > 2) {
              withdrawn =
                parsedAmounts[1] === balance ? null : parsedAmounts[1];
            }
          } else {
            withdrawn = parsedAmounts[0];
            if (parsedAmounts.length > 2) {
              paidIn = parsedAmounts[1] === balance ? null : parsedAmounts[1];
            }
          }
        } else if (amounts.length === 2) {
          balance = this.parseAmount(amounts[1]);
          const firstAmount = this.parseAmount(amounts[0]);

          if (
            details.toLowerCase().includes("business payment from") ||
            details.toLowerCase().includes("merchant payment from") ||
            details.toLowerCase().includes("received") ||
            details.toLowerCase().includes("customer transfer") ||
            details.toLowerCase().includes("b2c payment")
          ) {
            paidIn = firstAmount;
          } else {
            withdrawn = firstAmount;
          }
        } else if (amounts.length === 1) {
          balance = this.parseAmount(amounts[0]);
        }
      }

      if (!paidIn && !withdrawn && !balance) {
        const amountPattern = /[-]?([\d,]+\.\d{2})/g;
        let amounts = [];
        let amountMatch;

        while ((amountMatch = amountPattern.exec(block)) !== null) {
          amounts.push(amountMatch[0]);
        }

        if (amounts.length >= 1) {
          balance = this.parseAmount(amounts[amounts.length - 1]);

          if (amounts.length >= 2) {
            const transactionAmount = this.parseAmount(
              amounts[amounts.length - 2]
            );

            if (
              details.toLowerCase().includes("business payment from") ||
              details.toLowerCase().includes("merchant payment from") ||
              details.toLowerCase().includes("funds received") ||
              details.toLowerCase().includes("customer transfer") ||
              details.toLowerCase().includes("b2c payment")
            ) {
              paidIn = transactionAmount;
            } else {
              withdrawn = transactionAmount;
            }
          }
        }
      }

      let finalDetails = details.replace(/Disclaimer:[\s\S]*$/, "").trim();

      const transaction: Transaction = {
        receiptNo,
        completionTime,
        details: finalDetails,
        transactionStatus: status,
        paidIn,
        withdrawn,
        balance: balance || 0,
        raw: block.trim(),
      };

      transactions.push(transaction);
    }

    return transactions.sort((a, b) => {
      const dateA = new Date(a.completionTime);
      const dateB = new Date(b.completionTime);
      return dateA.getTime() - dateB.getTime();
    });
  }

  /**
   * Alternative details extraction method that's more aggressive
   */
  private static extractDetailsAlternative(
    block: string,
    receiptNo: string,
    completionTime: string
  ): string {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    let timeLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(completionTime)) {
        timeLineIndex = i;
        break;
      }
    }

    if (timeLineIndex === -1) return "";

    const detailLines = [];
    for (let i = timeLineIndex + 1; i < lines.length; i++) {
      const line = lines[i];

      if (
        /^\d+\.\d{2}$/.test(line) ||
        /^(COMPLETED|FAILED|PENDING)$/i.test(line) ||
        line.includes(receiptNo)
      ) {
        break;
      }

      if (!/^\d+\.\d{2}$/.test(line)) {
        detailLines.push(line);
      }
    }

    return detailLines.join(" ").trim();
  }

  /**
   * Extract details from block using alternative methods when primary extraction fails
   */
  private static extractDetailsFromBlock(
    block: string,
    receiptNo: string,
    completionTime: string,
    status: string
  ): string {
    let cleanBlock = block
      .replace(new RegExp(receiptNo, "g"), "")
      .replace(new RegExp(completionTime, "g"), "")
      .replace(new RegExp(status, "gi"), "");

    cleanBlock = cleanBlock.replace(/\d+\.\d{2}/g, "");

    const lines = cleanBlock
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return lines.join(" ").replace(/\s+/g, " ").trim();
  }

  /**
   * Parses an amount string to a number
   */
  private static parseAmount(amountStr: string): number {
    if (!amountStr || amountStr === "-") {
      return 0;
    }

    try {
      const cleanedStr = amountStr.replace(/[^\d.-]/g, "");

      const parts = cleanedStr.split(".");
      if (parts.length > 2) {
        const integerPart = parts[0];
        const decimalPart = parts.slice(1).join("");
        return parseFloat(`${integerPart}.${decimalPart}`);
      }

      return parseFloat(cleanedStr);
    } catch (error) {
      return 0;
    }
  }
}
