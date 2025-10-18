import { MPesaStatement, ExportOptions } from "../types";
import { applyTransactionFilters } from "./transactionFilters";

export class QifService {
  /**
   * Generates QIF (Quicken Interchange Format) for M-Pesa transactions
   * QIF is a simpler, text-based format used by Quicken and other accounting software
   */
  static convertStatementToQif(
    statement: MPesaStatement,
    options?: ExportOptions
  ): string {
    const filteredStatement = applyTransactionFilters(statement, options);

    // QIF header - Bank account type
    let qif = "!Type:Bank\n";

    // Generate transaction entries
    filteredStatement.transactions.forEach((transaction) => {
      // D - Date (MM/DD/YYYY or DD/MM/YYYY format)
      const date = this.formatQifDate(new Date(transaction.completionTime));
      qif += `D${date}\n`;

      // T - Amount (positive for deposits, negative for withdrawals)
      const amount =
        transaction.paidIn !== null
          ? transaction.paidIn
          : transaction.withdrawn !== null
          ? -transaction.withdrawn
          : 0;
      qif += `T${amount.toFixed(2)}\n`;

      // P - Payee
      const payee =
        transaction.otherParty || transaction.details.substring(0, 50).trim();
      qif += `P${payee}\n`;

      // M - Memo
      qif += `M${transaction.details}\n`;

      // N - Reference number (check number or transaction ID)
      if (transaction.receiptNo) {
        qif += `N${transaction.receiptNo}\n`;
      }

      // L - Category (optional - we can set based on transaction type)
      if (transaction.transactionType) {
        qif += `L${transaction.transactionType}\n`;
      }

      // ^ - End of entry marker
      qif += "^\n";
    });

    return qif;
  }

  /**
   * Format date as MM/DD/YYYY for QIF (US format commonly used)
   * or DD/MM/YYYY based on locale preferences
   */
  private static formatQifDate(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();

    // Using MM/DD/YYYY format which is more widely compatible
    return `${month}/${day}/${year}`;
  }

  static createDownloadLink(
    statement: MPesaStatement,
    options?: ExportOptions
  ): string {
    const content = this.convertStatementToQif(statement, options);
    const blob = new Blob([content], {
      type: "application/x-qif",
    });
    return URL.createObjectURL(blob);
  }

  static getFileName(statement: MPesaStatement, timestamp?: string): string {
    const baseFileName = statement.fileName
      ? statement.fileName.replace(/\.[^/.]+$/, "")
      : "mpesa-statement";

    const timeStamp =
      timestamp || new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    return `${baseFileName}_${timeStamp}.qif`;
  }
}
