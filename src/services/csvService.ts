import { MPesaStatement } from "../types";
import Papa from "papaparse";

export class CsvService {
  static convertStatementToCsv(statement: MPesaStatement): string {
    const transactionsData = statement.transactions.map((transaction) => ({
      "Receipt No": transaction.receiptNo,
      "Completion Time": transaction.completionTime,
      Details: transaction.details,
      "Transaction Status": transaction.transactionStatus,
      "Paid In": transaction.paidIn !== null ? transaction.paidIn : "",
      Withdrawn: transaction.withdrawn !== null ? transaction.withdrawn : "",
      Balance: transaction.balance,
    }));

    return Papa.unparse(transactionsData, {
      header: true,
      delimiter: ",",
      newline: "\r\n",
    });
  }

  static createDownloadLink(statement: MPesaStatement): string {
    const content = this.convertStatementToCsv(statement);
    const blob = new Blob([content], { type: "text/csv" });
    return URL.createObjectURL(blob);
  }

  static getFileName(statement: MPesaStatement, timestamp?: string): string {
    const baseFileName = statement.fileName 
      ? statement.fileName.replace(/\.[^/.]+$/, "") // Remove extension
      : "mpesa-statement";
    
    const timeStamp = timestamp || new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    return `${baseFileName}_${timeStamp}.csv`;
  }
}
