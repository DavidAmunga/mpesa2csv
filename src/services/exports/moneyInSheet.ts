import { MPesaStatement, } from "../../types";
import * as ExcelJS from "exceljs";

/**
 * Adds a "Money In" sheet to the workbook
 * This sheet contains all transactions where money was received (paidIn > 0)
 */
export function addMoneyInSheet(
  workbook: ExcelJS.Workbook,
  statement: MPesaStatement
): void {
  if (statement.transactions.length === 0) return;

  // Filter transactions where money came in
  const moneyInTransactions = statement.transactions.filter(
    (t) => t.paidIn !== null && t.paidIn > 0
  );

  if (moneyInTransactions.length === 0) return;

  // Sort by completion time (most recent first)
  const sortedTransactions = [...moneyInTransactions].sort(
    (a, b) =>
      new Date(b.completionTime).getTime() -
      new Date(a.completionTime).getTime()
  );

  // Create worksheet
  const worksheet = workbook.addWorksheet("Money In");

  // Check if this is a paybill statement
  const isPaybillStatement = sortedTransactions.some(
    (t) => t.transactionType !== undefined || t.otherParty !== undefined
  );

  // Define columns
  const columns: any[] = [
    { header: "Receipt No", key: "receiptNo", width: 12 },
    { header: "Date & Time", key: "completionTime", width: 20 },
    { header: "Details", key: "details", width: 50 },
    { header: "Amount Received", key: "paidIn", width: 15 },
    { header: "Balance After", key: "balance", width: 15 },
    { header: "Status", key: "transactionStatus", width: 18 },
  ];

  // Add paybill-specific columns if needed
  if (isPaybillStatement) {
    columns.push(
      { header: "Transaction Type", key: "transactionType", width: 18 },
      { header: "From", key: "otherParty", width: 30 }
    );
  }

  worksheet.columns = columns;

  // Style the header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2E7D32" }, // Green color for money in
  };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.height = 20;

  // Add data rows
  sortedTransactions.forEach((transaction) => {
    const rowData: any = {
      receiptNo: transaction.receiptNo,
      completionTime: transaction.completionTime,
      details: transaction.details,
      paidIn: transaction.paidIn,
      balance: transaction.balance,
      transactionStatus: transaction.transactionStatus,
    };

    // Add paybill-specific fields if present
    if (isPaybillStatement) {
      rowData.transactionType = transaction.transactionType || "";
      rowData.otherParty = transaction.otherParty || "";
    }

    const row = worksheet.addRow(rowData);

    // Format the amount column with currency style and light green background
    const amountCell = row.getCell("paidIn");
    amountCell.numFmt = '#,##0.00';
    amountCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8F5E9" }, // Light green
    };
    amountCell.font = { bold: true, color: { argb: "FF2E7D32" } };

    // Format the balance column
    const balanceCell = row.getCell("balance");
    balanceCell.numFmt = '#,##0.00';
  });

  // Add summary row at the top (after headers)
  const totalReceived = moneyInTransactions.reduce(
    (sum, t) => sum + (t.paidIn || 0),
    0
  );
  
  worksheet.insertRow(2, {});
  const summaryRow = worksheet.getRow(2);
  summaryRow.getCell(1).value = "SUMMARY";
  summaryRow.getCell(1).font = { bold: true, size: 12 };
  summaryRow.getCell(3).value = `Total Received:`;
  summaryRow.getCell(3).font = { bold: true };
  summaryRow.getCell(3).alignment = { horizontal: "right" };
  summaryRow.getCell(4).value = totalReceived;
  summaryRow.getCell(4).numFmt = '#,##0.00';
  summaryRow.getCell(4).font = { bold: true, color: { argb: "FF2E7D32" }, size: 12 };
  summaryRow.getCell(4).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFC8E6C9" },
  };
  summaryRow.getCell(5).value = `Transaction Count: ${moneyInTransactions.length}`;
  summaryRow.getCell(5).font = { bold: true };
  summaryRow.height = 25;

  // Add borders to all cells
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  // Freeze the header rows
  worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 2 }];
}
