import { MPesaStatement } from "../types";
import * as XLSX from "xlsx";

export class XlsxService {
  static convertStatementToXlsx(statement: MPesaStatement): ArrayBuffer {
    // Prepare the data in the same format as CSV
    const transactionsData = statement.transactions.map((transaction) => ({
      "Receipt No": transaction.receiptNo,
      "Completion Time": transaction.completionTime,
      "Details": transaction.details,
      "Transaction Status": transaction.transactionStatus,
      "Paid In": transaction.paidIn !== null ? transaction.paidIn : "",
      "Withdrawn": transaction.withdrawn !== null ? transaction.withdrawn : "",
      "Balance": transaction.balance,
    }));

    // Create a new workbook
    const workbook = XLSX.utils.book_new();
    
    // Create worksheet from the data
    const worksheet = XLSX.utils.json_to_sheet(transactionsData);

    // Set column widths for better readability
    const columnWidths = [
      { wch: 12 }, // Receipt No
      { wch: 20 }, // Completion Time
      { wch: 40 }, // Details
      { wch: 18 }, // Transaction Status
      { wch: 12 }, // Paid In
      { wch: 12 }, // Withdrawn
      { wch: 12 }, // Balance
    ];
    worksheet["!cols"] = columnWidths;

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "M-Pesa Transactions");

    // Generate the Excel file as ArrayBuffer
    return XLSX.write(workbook, { 
      bookType: "xlsx", 
      type: "array",
      compression: true 
    });
  }

  static createDownloadLink(statement: MPesaStatement): string {
    const arrayBuffer = this.convertStatementToXlsx(statement);
    const blob = new Blob([arrayBuffer], { 
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
    });
    return URL.createObjectURL(blob);
  }

  static getFileName(statement: MPesaStatement, timestamp?: string): string {
    const baseFileName = statement.fileName 
      ? statement.fileName.replace(/\.[^/.]+$/, "") // Remove extension
      : "mpesa-statement";
    
    const timeStamp = timestamp || new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    return `${baseFileName}_${timeStamp}.xlsx`;
  }
}
