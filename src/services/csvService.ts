import { MPesaStatement, ExportOptions } from "../types";
import Papa from "papaparse";
import { applyTransactionFilters } from "./transactionFilters";
import { formatDate } from "../utils/dateFormatter";

export class CsvService {
  static convertStatementToCsv(
    statement: MPesaStatement,
    options?: ExportOptions
  ): string {
    const filteredStatement = applyTransactionFilters(statement, options);

    const transactionsData = filteredStatement.transactions.map(
      (transaction) => {
        const baseData: any = {
          "Receipt No": transaction.receiptNo,
          "Completion Time": formatDate(
            transaction.completionTime,
            options?.dateFormat
          ),
          Details: transaction.details,
          "Transaction Status": transaction.transactionStatus,
          "Paid In": transaction.paidIn !== null ? transaction.paidIn : "",
          Withdrawn:
            transaction.withdrawn !== null ? transaction.withdrawn : "",
          Balance: transaction.balance,
        };

        if (transaction.transactionType !== undefined) {
          baseData["Transaction Type"] = transaction.transactionType;
        }
        if (transaction.otherParty !== undefined) {
          baseData["Other Party"] = transaction.otherParty;
        }

        return baseData;
      }
    );

    return Papa.unparse(transactionsData, {
      header: true,
      delimiter: ",",
      newline: "\r\n",
    });
  }

  static createDownloadLink(
    statement: MPesaStatement,
    options?: ExportOptions
  ): string {
    const content = this.convertStatementToCsv(statement, options);
    const blob = new Blob([content], { type: "text/csv" });
    return URL.createObjectURL(blob);
  }

  static getFileName(statement: MPesaStatement, timestamp?: string): string {
    const baseFileName = statement.fileName
      ? statement.fileName.replace(/\.[^/.]+$/, "")
      : "mpesa-statement";

    const timeStamp =
      timestamp || new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    return `${baseFileName}_${timeStamp}.csv`;
  }
}
