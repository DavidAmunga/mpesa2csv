import { MPesaStatement, ExportOptions } from "../types";
import { applyTransactionFilters } from "./transactionFilters";
import { formatDate } from "../utils/dateFormatter";

export class JsonService {
  static convertStatementToJson(
    statement: MPesaStatement,
    options?: ExportOptions
  ): string {
    const filteredStatement = applyTransactionFilters(statement, options);

    const transactionsData = filteredStatement.transactions.map(
      (transaction) => {
        const baseData: any = {
          receiptNo: transaction.receiptNo,
          completionTime: formatDate(
            transaction.completionTime,
            options?.dateFormat
          ),
          details: transaction.details,
          transactionStatus: transaction.transactionStatus,
          paidIn: transaction.paidIn !== null ? transaction.paidIn : null,
          withdrawn:
            transaction.withdrawn !== null ? transaction.withdrawn : null,
          balance: transaction.balance,
        };

        if (transaction.transactionType !== undefined) {
          baseData.transactionType = transaction.transactionType;
        }
        if (transaction.otherParty !== undefined) {
          baseData.otherParty = transaction.otherParty;
        }

        return baseData;
      }
    );

    return JSON.stringify(transactionsData, null, 2);
  }

  static createDownloadLink(
    statement: MPesaStatement,
    options?: ExportOptions
  ): string {
    const content = this.convertStatementToJson(statement, options);
    const blob = new Blob([content], { type: "application/json" });
    return URL.createObjectURL(blob);
  }

  static getFileName(statement: MPesaStatement, timestamp?: string): string {
    const baseFileName = statement.fileName
      ? statement.fileName.replace(/\.[^/.]+$/, "")
      : "mpesa-statement";

    const timeStamp =
      timestamp || new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    return `${baseFileName}_${timeStamp}.json`;
  }
}
