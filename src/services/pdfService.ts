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
    console.log(
      "PdfService.parseMpesaStatement: Starting to parse PDF with",
      pdf.numPages,
      "pages"
    );
    const numPages = pdf.numPages;
    let allText = "";

    for (let i = 1; i <= numPages; i++) {
      console.log(
        `PdfService.parseMpesaStatement: Extracting text from page ${i}/${numPages}`
      );
      const pageText = await this.extractTextFromPage(pdf, i);
      allText += pageText + "\n";
    }

    console.log(
      "PdfService.parseMpesaStatement: Extracted text length:",
      allText.length
    );
    console.log(
      "PdfService.parseMpesaStatement: Text sample:",
      allText.substring(0, 500)
    );

    const transactions = this.parseTransactions(allText);
    console.log(
      "PdfService.parseMpesaStatement: Parsed",
      transactions.length,
      "transactions"
    );

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

    // Set tolerance values for positioning
    const LINE_TOLERANCE = 3; // tolerance for lines
    const WORD_TOLERANCE = 15; // tolerance for words on the same line (adjusted for M-PESA statement)

    // Sort items by y position (top to bottom), then x position (left to right)
    const items = textContent.items
      .filter((item) => "str" in item && item.str.trim() !== "")
      .sort((a, b) => {
        if (!("transform" in a) || !("transform" in b)) return 0;
        // Compare y position first (with a small tolerance)
        const yDiff = Math.abs(a.transform[5] - b.transform[5]);
        if (yDiff < LINE_TOLERANCE) {
          // Items on same line (within tolerance)
          return a.transform[4] - b.transform[4]; // Sort by x position
        }
        return b.transform[5] - a.transform[5]; // Sort by y position (top to bottom)
      });

    // Build text with proper line breaks
    for (const item of items) {
      if (!("str" in item) || !("transform" in item)) continue;

      const x = item.transform[4];
      const y = item.transform[5];
      const str = item.str;

      // Add a new line when y position changes significantly
      if (lastY !== null && Math.abs(y - lastY) > LINE_TOLERANCE) {
        text += "\n";
        lastX = null; // Reset lastX on new line
      } else if (lastX !== null && lastY !== null) {
        // Check if we need to add a space between words
        // This handles the case where words are far apart horizontally
        const xGap = x - (lastX + (item.width || 0));
        if (xGap > WORD_TOLERANCE) {
          text += " ";
        } else if (
          text.length > 0 &&
          !text.endsWith(" ") &&
          !text.endsWith("\n")
        ) {
          // Add space between items on the same line if needed and not too far apart
          text += " ";
        }
      }

      text += str;
      lastY = y;
      lastX = x + (item.width || 0);
    }

    // Fix any double spaces
    return text.replace(/\s{2,}/g, " ");
  }

  /**
   * Parses detailed transactions from the statement text
   * Enhanced to handle multiple M-PESA statement formats
   */
  static parseTransactions(text: string): Transaction[] {
    const transactions: Transaction[] = [];

    // Try multiple patterns to find the detailed statement section
    const detailedPatterns = [
      /DETAILED\s+STATEMENT[\s\S]*?(?:Receipt\s+No\.|Receipt\s*Number)/i,
      /DETAILED\s+STATEMENT[\s\S]*?(?:[A-Z0-9]{10})/i, // M-PESA receipt numbers
      /Receipt\s+No\s+Completion\s+Time\s+Details/i, // Table header pattern
      /[A-Z0-9]{10}\s+\d{4}-\d{2}-\d{2}/i, // Direct receipt pattern
    ];

    let detailedSection = "";
    let sectionFound = false;

    // Try each pattern to find the detailed section
    for (const pattern of detailedPatterns) {
      const match = text.match(pattern);
      if (match) {
        detailedSection = text.substring(match.index || 0);
        sectionFound = true;
        console.log("Found detailed section using pattern:", pattern);
        break;
      }
    }

    // If no detailed section found using patterns, try to find first transaction directly
    if (!sectionFound) {
      const firstTransactionMatch = text.match(
        /[A-Z0-9]{10}\s+\d{4}-\d{2}-\d{2}/i
      );
      if (firstTransactionMatch) {
        detailedSection = text.substring(firstTransactionMatch.index || 0);
        sectionFound = true;
        console.log("Found detailed section by locating first transaction");
      }
    }

    if (!sectionFound) {
      console.warn("Could not find detailed statement section");
      console.log("Text sample:", text.substring(0, 1000));
      console.log(
        "Looking for patterns like 'DETAILED STATEMENT' or receipt numbers..."
      );

      // Last resort: try to find any receipt numbers anywhere in the text
      const anyReceiptMatch = text.match(/[A-Z0-9]{10}/i);
      if (anyReceiptMatch) {
        console.log(
          "Found receipt pattern elsewhere, trying full text parsing"
        );
        detailedSection = text;
        sectionFound = true;
      } else {
        return transactions;
      }
    }

    // Enhanced transaction parsing to handle different table formats
    let transactionBlocks = [];

    // Method 1: Try parsing as traditional line-by-line format
    const receiptPattern = /\n([A-Z0-9]{10})\s+\d{4}-\d{2}-\d{2}/g;
    let match;
    let lastIndex = 0;

    // Find all receipt numbers and their positions
    while ((match = receiptPattern.exec(detailedSection)) !== null) {
      if (lastIndex > 0) {
        // Add the previous block
        const blockContent = detailedSection.substring(lastIndex, match.index);
        if (blockContent.trim()) {
          transactionBlocks.push(blockContent);
        }
      }
      lastIndex = match.index + 1; // +1 to keep the newline
    }

    // Add the last block if any
    if (lastIndex > 0 && lastIndex < detailedSection.length) {
      const blockContent = detailedSection.substring(lastIndex);
      if (blockContent.trim() && !blockContent.includes("Disclaimer:")) {
        transactionBlocks.push(blockContent);
      }
    }

    // Method 2: If no blocks found, try parsing as table format
    if (transactionBlocks.length === 0) {
      console.warn("Trying table-based parsing");

      // Split by lines and look for receipt patterns
      const lines = detailedSection.split("\n");
      let currentTransaction = "";

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check if line starts with a receipt number
        if (/^[A-Z0-9]{10}\s+\d{4}-\d{2}-\d{2}/.test(line)) {
          // Save previous transaction if exists
          if (currentTransaction.trim()) {
            transactionBlocks.push(currentTransaction.trim());
          }
          // Start new transaction
          currentTransaction = line;
        } else if (currentTransaction && line) {
          // Continue building current transaction
          currentTransaction += "\n" + line;
        }
      }

      // Add the last transaction
      if (currentTransaction.trim()) {
        transactionBlocks.push(currentTransaction.trim());
      }
    }

    // Method 3: If still no blocks, try splitting by receipt pattern without line boundaries
    if (transactionBlocks.length === 0) {
      console.warn("Falling back to simple receipt pattern splitting");
      const rows = detailedSection.split(
        /(?=[A-Z0-9]{10}\s+\d{4}-\d{2}-\d{2})/
      );
      transactionBlocks = rows.filter((block) =>
        /[A-Z0-9]{10}\s+\d{4}-\d{2}-\d{2}/.test(block)
      );
    }

    // Process each transaction block
    for (const block of transactionBlocks) {
      // Extract receipt number - 10-character alphanumeric string (always uppercase)
      const receiptMatch = block.match(/([A-Z0-9]{10})/);
      if (!receiptMatch) {
        continue;
      }

      const receiptNo = receiptMatch[1].trim();

      // Extract completion time - handle both formats
      const timeMatch = block.match(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/);
      const completionTime = timeMatch ? timeMatch[0].trim() : "";

      // Extract transaction status - be more flexible
      const statusMatch = block.match(
        /\b(COMPLETED|FAILED|PENDING|Completed|Failed|Pending)\b/i
      );
      const status = statusMatch ? statusMatch[0].trim() : "Unknown";

      // Extract details - using the more robust multiline pattern
      let details = "";
      if (timeMatch && statusMatch) {
        const timeIndex = block.indexOf(timeMatch[0]) + timeMatch[0].length;
        const statusIndex = block.indexOf(statusMatch[0], timeIndex);

        if (statusIndex > timeIndex) {
          // Extract everything between time and status
          details = block.substring(timeIndex, statusIndex).trim();

          // Handle some common M-PESA transaction types more explicitly
          // Business Payment from Equity Bank
          if (
            details.includes("Business Payment from") &&
            details.includes("Equity Bulk Account via API")
          ) {
            const fullDetails = details.replace(/\s+/g, " ").trim();
            // Extract the conversation ID if present
            const conversationIdMatch = block.match(
              /conversation\s+ID\s+is\s+([A-Z0-9]+)/i
            );
            if (conversationIdMatch) {
              details = `${fullDetails} - Conversation ID: ${conversationIdMatch[1]}`;
            } else {
              details = fullDetails;
            }
          }
          // Customer Transfer handling
          else if (details.includes("Customer Transfer")) {
            // Try to extract the recipient info that often appears on a different line
            const transferToMatch = block.match(
              /Customer\s+Transfer\s+(?:to|-)?\s+([^\n]+)/i
            );
            if (transferToMatch) {
              details =
                `Customer Transfer to ${transferToMatch[1].trim()}`.replace(
                  /\s+/g,
                  " "
                );
            } else {
              details = details.replace(/\s+/g, " ").trim();
            }
          }
          // Merchant Payment Online handling
          else if (details.includes("Merchant Payment Online to")) {
            // Some merchant payments have additional details like store names
            const merchantMatch = block.match(
              /Merchant\s+Payment\s+Online\s+to\s+([^\n]+)/i
            );
            if (merchantMatch) {
              details = merchantMatch[1].replace(/\s+/g, " ").trim();

              // Try to find additional merchant info like store name
              const storeMatch = block.match(
                /([A-Z\s]+(?:\s+[A-Z]+)+)\s+([^\s]+)/i
              );
              if (storeMatch) {
                details = `${details} - ${storeMatch[0].trim()}`;
              }
            } else {
              details = details.replace(/\s+/g, " ").trim();
            }
          }
          // Default case - just clean up whitespace
          else {
            details = details.replace(/\s+/g, " ").trim();
          }
        }
      }

      // Enhanced amount extraction to handle table format
      let paidIn = null;
      let withdrawn = null;
      let balance = null;

      // Method 1: Try to extract from column headers (old format)
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

      // Method 2: For new table format, extract amounts by position
      if (!paidIn && !withdrawn && !balance) {
        // Extract all amounts from the transaction block
        const amountPattern = /([\d,]+\.\d{2})/g;
        const amounts = [];
        let amountMatch;

        while ((amountMatch = amountPattern.exec(block)) !== null) {
          amounts.push(amountMatch[1]);
        }

        // In the new format, amounts are typically in order: Paid In, Withdrawn, Balance
        // But we need to be smart about which is which
        if (amounts.length >= 3) {
          // Try to determine based on transaction type and amounts
          const parsedAmounts = amounts.map((amt) => this.parseAmount(amt));

          // Last amount is usually balance
          balance = parsedAmounts[parsedAmounts.length - 1];

          // Check if this looks like a money-in transaction
          if (
            details.toLowerCase().includes("business payment from") ||
            details.toLowerCase().includes("received") ||
            (details.toLowerCase().includes("customer transfer") &&
              parsedAmounts[0] > 0)
          ) {
            paidIn = parsedAmounts[0];
            if (parsedAmounts.length > 2) {
              withdrawn =
                parsedAmounts[1] === balance ? null : parsedAmounts[1];
            }
          } else {
            // Likely a money-out transaction
            withdrawn = parsedAmounts[0];
            if (parsedAmounts.length > 2) {
              paidIn = parsedAmounts[1] === balance ? null : parsedAmounts[1];
            }
          }
        } else if (amounts.length === 2) {
          // One amount + balance
          balance = this.parseAmount(amounts[1]);
          const firstAmount = this.parseAmount(amounts[0]);

          if (
            details.toLowerCase().includes("business payment from") ||
            details.toLowerCase().includes("received")
          ) {
            paidIn = firstAmount;
          } else {
            withdrawn = firstAmount;
          }
        } else if (amounts.length === 1) {
          balance = this.parseAmount(amounts[0]);
        }
      }

      // Method 3: Final fallback for edge cases
      if (!paidIn && !withdrawn && !balance) {
        console.log("Using final fallback amount extraction");
        // Find all amounts in the block including negative ones
        const amountPattern = /[-]?([\d,]+\.\d{2})/g;
        let amounts = [];
        let amountMatch;

        while ((amountMatch = amountPattern.exec(block)) !== null) {
          amounts.push(amountMatch[0]);
        }

        console.log("Found amounts:", amounts);

        // Last amount is typically the balance
        if (amounts.length >= 1) {
          balance = this.parseAmount(amounts[amounts.length - 1]);

          if (amounts.length >= 2) {
            const transactionAmount = this.parseAmount(
              amounts[amounts.length - 2]
            );

            // Determine if it's paid in or withdrawn based on transaction details
            if (
              details.toLowerCase().includes("business payment from") ||
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

      // Create the transaction object
      const transaction: Transaction = {
        receiptNo,
        completionTime,
        details,
        transactionStatus: status,
        paidIn,
        withdrawn,
        balance: balance || 0, // Balance should always have a value
        raw: block.trim(),
      };

      transactions.push(transaction);
    }

    console.log(`Successfully parsed ${transactions.length} transactions`);

    return transactions.sort((a, b) => {
      const dateA = new Date(a.completionTime);
      const dateB = new Date(b.completionTime);
      return dateA.getTime() - dateB.getTime();
    });
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

      // Handle special case where there might be multiple decimal points
      const parts = cleanedStr.split(".");
      if (parts.length > 2) {
        // If there are multiple decimal points, keep only the first one
        const integerPart = parts[0];
        const decimalPart = parts.slice(1).join("");
        return parseFloat(`${integerPart}.${decimalPart}`);
      }

      return parseFloat(cleanedStr);
    } catch (error) {
      console.error("Error parsing amount:", amountStr, error);
      return 0;
    }
  }
}
