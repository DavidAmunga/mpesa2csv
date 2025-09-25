import { MPesaStatement, ExportOptions } from "../types";
import * as ExcelJS from "exceljs";

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
      this.addChargesSheet(workbook, statement);
    }

    // Add Financial Summary sheet if requested
    if (options?.includeSummarySheet) {
      this.addFinancialSummarySheet(workbook, statement);
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

  private static addChargesSheet(
    workbook: ExcelJS.Workbook,
    statement: MPesaStatement
  ): void {
    // Filter transactions that contain "charge" in the details (case insensitive)
    const chargeTransactions = statement.transactions.filter((transaction) =>
      transaction.details.toLowerCase().includes("charge")
    );

    if (chargeTransactions.length === 0) {
      return; // No charges found, don't create the sheet
    }

    // Create the charges worksheet
    const chargesWorksheet = workbook.addWorksheet("Charges & Fees");

    // Define columns for charges sheet
    chargesWorksheet.columns = [
      { header: "Receipt No", key: "receiptNo", width: 12 },
      { header: "Date", key: "date", width: 12 },
      { header: "Full Details", key: "fullDetails", width: 40 },
      { header: "Amount", key: "amount", width: 12 },
    ];

    // Style the header row
    const headerRow = chargesWorksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFD700" },
    };
    headerRow.alignment = { horizontal: "center" };

    // Process and add charge transactions
    chargeTransactions.forEach((transaction) => {
      const amount = transaction.withdrawn || transaction.paidIn || 0;

      chargesWorksheet.addRow({
        receiptNo: transaction.receiptNo,
        date: transaction.completionTime,
        fullDetails: transaction.details,
        amount: amount,
      });
    });

    // Add borders to all cells
    const dataRange = chargesWorksheet.getRows(1, chargesWorksheet.rowCount);
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

    // Add summary at the bottom
    const summaryStartRow = chargesWorksheet.rowCount + 2;
    const totalCharges = chargeTransactions.reduce((sum, transaction) => {
      return sum + (transaction.withdrawn || transaction.paidIn || 0);
    }, 0);

    chargesWorksheet.getCell(`A${summaryStartRow}`).value = "Total Charges:";
    chargesWorksheet.getCell(`A${summaryStartRow}`).font = { bold: true };
    chargesWorksheet.getCell(`D${summaryStartRow}`).value = totalCharges;
    chargesWorksheet.getCell(`D${summaryStartRow}`).font = { bold: true };
    chargesWorksheet.getCell(`D${summaryStartRow}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFE4B5" },
    };

    chargesWorksheet.getCell(`A${summaryStartRow + 1}`).value =
      "Number of Charge Transactions:";
    chargesWorksheet.getCell(`A${summaryStartRow + 1}`).font = { bold: true };
    chargesWorksheet.getCell(`D${summaryStartRow + 1}`).value =
      chargeTransactions.length;
    chargesWorksheet.getCell(`D${summaryStartRow + 1}`).font = { bold: true };
  }

  private static addFinancialSummarySheet(
    workbook: ExcelJS.Workbook,
    statement: MPesaStatement
  ): void {
    if (statement.transactions.length === 0) return;

    const summaryWorksheet = workbook.addWorksheet("Financial Summary");

    // Calculate financial metrics
    const metrics = this.calculateFinancialMetrics(statement.transactions);

    // Set up the layout
    let currentRow = 1;

    // Title
    summaryWorksheet.getCell(`A${currentRow}`).value =
      "FINANCIAL SUMMARY REPORT";
    summaryWorksheet.getCell(`A${currentRow}`).font = { bold: true, size: 16 };
    summaryWorksheet.getCell(`A${currentRow}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    summaryWorksheet.getCell(`A${currentRow}`).font.color = {
      argb: "FFFFFFFF",
    };
    summaryWorksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    currentRow += 2;

    // Period Overview
    summaryWorksheet.getCell(`A${currentRow}`).value = "PERIOD OVERVIEW";
    summaryWorksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
    summaryWorksheet.getCell(`A${currentRow}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE7E6E6" },
    };
    summaryWorksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    currentRow++;

    const periodData = [
      ["Start Date:", metrics.startDate],
      ["End Date:", metrics.endDate],
      ["Total Days:", metrics.totalDays],
      ["Total Transactions:", metrics.totalTransactions],
    ];

    periodData.forEach(([label, value]) => {
      summaryWorksheet.getCell(`A${currentRow}`).value = label;
      summaryWorksheet.getCell(`A${currentRow}`).font = { bold: true };
      summaryWorksheet.getCell(`B${currentRow}`).value = value;
      currentRow++;
    });
    currentRow++;

    // Cash Flow Summary
    summaryWorksheet.getCell(`A${currentRow}`).value = "CASH FLOW SUMMARY";
    summaryWorksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
    summaryWorksheet.getCell(`A${currentRow}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE7E6E6" },
    };
    summaryWorksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    currentRow++;

    const cashFlowData = [
      [
        "Total Money In (Income):",
        `KSh ${metrics.totalMoneyIn.toLocaleString()}`,
      ],
      [
        "Total Money Out (Expenses):",
        `KSh ${metrics.totalMoneyOut.toLocaleString()}`,
      ],
      ["Net Cash Flow:", `KSh ${metrics.netCashFlow.toLocaleString()}`],
      [
        "Average Daily Income:",
        `KSh ${metrics.avgDailyIncome.toLocaleString()}`,
      ],
      [
        "Average Daily Spending:",
        `KSh ${metrics.avgDailySpending.toLocaleString()}`,
      ],
    ];

    cashFlowData.forEach(([label, value]) => {
      summaryWorksheet.getCell(`A${currentRow}`).value = label;
      summaryWorksheet.getCell(`A${currentRow}`).font = { bold: true };
      summaryWorksheet.getCell(`B${currentRow}`).value = value;

      // Color coding for net cash flow
      if (label.includes("Net Cash Flow")) {
        summaryWorksheet.getCell(`B${currentRow}`).font = {
          color: { argb: metrics.netCashFlow >= 0 ? "FF008000" : "FFFF0000" },
          bold: true,
        };
      }
      currentRow++;
    });
    currentRow++;

    // Balance Analysis
    summaryWorksheet.getCell(`A${currentRow}`).value = "BALANCE ANALYSIS";
    summaryWorksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
    summaryWorksheet.getCell(`A${currentRow}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE7E6E6" },
    };
    summaryWorksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    currentRow++;

    const balanceData = [
      ["Starting Balance:", `KSh ${metrics.startingBalance.toLocaleString()}`],
      ["Ending Balance:", `KSh ${metrics.endingBalance.toLocaleString()}`],
      ["Highest Balance:", `KSh ${metrics.highestBalance.toLocaleString()}`],
      ["Lowest Balance:", `KSh ${metrics.lowestBalance.toLocaleString()}`],
      ["Average Balance:", `KSh ${metrics.avgBalance.toLocaleString()}`],
    ];

    balanceData.forEach(([label, value]) => {
      summaryWorksheet.getCell(`A${currentRow}`).value = label;
      summaryWorksheet.getCell(`A${currentRow}`).font = { bold: true };
      summaryWorksheet.getCell(`B${currentRow}`).value = value;
      currentRow++;
    });
    currentRow++;

    // Transaction Patterns
    summaryWorksheet.getCell(`A${currentRow}`).value = "TRANSACTION PATTERNS";
    summaryWorksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
    summaryWorksheet.getCell(`A${currentRow}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE7E6E6" },
    };
    summaryWorksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    currentRow++;

    const patternsData = [
      [
        "Highest Single Income:",
        `KSh ${metrics.highestSingleIncome.toLocaleString()}`,
      ],
      [
        "Highest Single Expense:",
        `KSh ${metrics.highestSingleExpense.toLocaleString()}`,
      ],
      ["Most Active Day:", metrics.mostActiveDay],
      ["Busiest Day of Week:", metrics.busiestDayOfWeek],
      ["Average Transactions/Day:", metrics.avgTransactionsPerDay.toFixed(1)],
    ];

    patternsData.forEach(([label, value]) => {
      summaryWorksheet.getCell(`A${currentRow}`).value = label;
      summaryWorksheet.getCell(`A${currentRow}`).font = { bold: true };
      summaryWorksheet.getCell(`B${currentRow}`).value = value;
      currentRow++;
    });
    currentRow++;

  

    // Format columns
    summaryWorksheet.getColumn("A").width = 25;
    summaryWorksheet.getColumn("B").width = 20;
    summaryWorksheet.getColumn("C").width = 15;

    // Add borders to all used cells
    for (let row = 1; row <= currentRow - 1; row++) {
      for (let col = 1; col <= 3; col++) {
        const cell = summaryWorksheet.getCell(row, col);
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }
    }
  }

  private static calculateFinancialMetrics(transactions: any[]) {
    // Sort transactions by date
    const sortedTransactions = [...transactions].sort(
      (a, b) =>
        new Date(a.completionTime).getTime() -
        new Date(b.completionTime).getTime()
    );

    const startDate = new Date(
      sortedTransactions[0].completionTime
    ).toDateString();
    const endDate = new Date(
      sortedTransactions[sortedTransactions.length - 1].completionTime
    ).toDateString();
    const totalDays =
      Math.ceil(
        (new Date(
          sortedTransactions[sortedTransactions.length - 1].completionTime
        ).getTime() -
          new Date(sortedTransactions[0].completionTime).getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    const totalMoneyIn = transactions.reduce(
      (sum, t) => sum + (t.paidIn || 0),
      0
    );
    const totalMoneyOut = transactions.reduce(
      (sum, t) => sum + (t.withdrawn || 0),
      0
    );
    const netCashFlow = totalMoneyIn - totalMoneyOut;

    const balances = transactions.map((t) => t.balance);
    const highestBalance = Math.max(...balances);
    const lowestBalance = Math.min(...balances);
    const avgBalance =
      balances.reduce((sum, b) => sum + b, 0) / balances.length;

    const incomes = transactions
      .filter((t) => t.paidIn > 0)
      .map((t) => t.paidIn);
    const expenses = transactions
      .filter((t) => t.withdrawn > 0)
      .map((t) => t.withdrawn);

    const highestSingleIncome = incomes.length > 0 ? Math.max(...incomes) : 0;
    const highestSingleExpense =
      expenses.length > 0 ? Math.max(...expenses) : 0;

    // Find most active day
    const dailyTransactions: { [key: string]: number } = {};
    const dayOfWeekCounts: { [key: string]: number } = {};
    const daysOfWeek = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    transactions.forEach((t) => {
      const date = new Date(t.completionTime);
      const dateStr = date.toDateString();
      const dayOfWeek = daysOfWeek[date.getDay()];

      dailyTransactions[dateStr] = (dailyTransactions[dateStr] || 0) + 1;
      dayOfWeekCounts[dayOfWeek] = (dayOfWeekCounts[dayOfWeek] || 0) + 1;
    });

    const mostActiveDay = Object.keys(dailyTransactions).reduce((a, b) =>
      dailyTransactions[a] > dailyTransactions[b] ? a : b
    );

    const busiestDayOfWeek = Object.keys(dayOfWeekCounts).reduce((a, b) =>
      dayOfWeekCounts[a] > dayOfWeekCounts[b] ? a : b
    );

    return {
      startDate,
      endDate,
      totalDays,
      totalTransactions: transactions.length,
      totalMoneyIn,
      totalMoneyOut,
      netCashFlow,
      avgDailyIncome: totalMoneyIn / totalDays,
      avgDailySpending: totalMoneyOut / totalDays,
      startingBalance: sortedTransactions[0].balance,
      endingBalance: sortedTransactions[sortedTransactions.length - 1].balance,
      highestBalance,
      lowestBalance,
      avgBalance,
      highestSingleIncome,
      highestSingleExpense,
      mostActiveDay,
      busiestDayOfWeek,
      avgTransactionsPerDay: transactions.length / totalDays,
    };
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
