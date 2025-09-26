import { MPesaStatement, ExportOptions } from "../types";
import * as ExcelJS from "exceljs";
import {
  addChargesSheet,
  addFinancialSummarySheet,
  addMonthlyWeeklyBreakdownSheet,
  addDailyBalanceTrackerSheet,
} from "./exports";

export class XlsxService {
  static async convertStatementToXlsx(
    statement: MPesaStatement,
    options?: ExportOptions
  ): Promise<ArrayBuffer> {
    // Create a new workbook
    const workbook = new ExcelJS.Workbook();

    // Add metadata
    workbook.creator = "mpesa2csv";
    workbook.lastModifiedBy = "mpesa2csv";
    workbook.created = new Date();
    workbook.modified = new Date();

    // Create worksheet
    const worksheet = workbook.addWorksheet("M-Pesa Transactions");

    // Define columns with headers and widths
    worksheet.columns = [
      { header: "Receipt No", key: "receiptNo", width: 12 },
      { header: "Completion Time", key: "completionTime", width: 20 },
      { header: "Details", key: "details", width: 40 },
      { header: "Transaction Status", key: "transactionStatus", width: 18 },
      { header: "Paid In", key: "paidIn", width: 12 },
      { header: "Withdrawn", key: "withdrawn", width: 12 },
      { header: "Balance", key: "balance", width: 12 },
    ];

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
    headerRow.alignment = { horizontal: "center" };

    // Add transaction data
    statement.transactions.forEach((transaction) => {
      worksheet.addRow({
        receiptNo: transaction.receiptNo,
        completionTime: transaction.completionTime,
        details: transaction.details,
        transactionStatus: transaction.transactionStatus,
        paidIn: transaction.paidIn !== null ? transaction.paidIn : "",
        withdrawn: transaction.withdrawn !== null ? transaction.withdrawn : "",
        balance: transaction.balance,
      });
    });

    const dataRange = worksheet.getRows(1, worksheet.rowCount);
    if (dataRange) {
      dataRange.forEach((row) => {
        if (row) {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            };
          });
        }
      });
    }

    // Add Charges/Fees sheet if requested
    if (options?.includeChargesSheet) {
      addChargesSheet(workbook, statement);
    }

    // Add Financial Summary sheet if requested
    if (options?.includeSummarySheet) {
      addFinancialSummarySheet(workbook, statement);
    }

    // Add Monthly/Weekly Breakdown sheet if requested
    if (options?.includeBreakdownSheet) {
      addMonthlyWeeklyBreakdownSheet(workbook, statement);
    }

    // Add Daily Balance Tracker sheet if requested
    if (options?.includeDailyBalanceSheet) {
      addDailyBalanceTrackerSheet(workbook, statement);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as ArrayBuffer;
  }

  static async createDownloadLink(
    statement: MPesaStatement,
    options?: ExportOptions
  ): Promise<string> {
    const arrayBuffer = await this.convertStatementToXlsx(statement, options);
    const blob = new Blob([arrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    return URL.createObjectURL(blob);
  }

  static getFileName(statement: MPesaStatement, timestamp?: string): string {
    const baseFileName = statement.fileName
      ? statement.fileName.replace(/\.[^/.]+$/, "") // Remove extension
      : "mpesa-statement";

    const timeStamp =
      timestamp || new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    return `${baseFileName}_${timeStamp}.xlsx`;
  }
}
