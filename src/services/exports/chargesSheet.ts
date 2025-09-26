import { MPesaStatement } from "../../types";
import * as ExcelJS from "exceljs";

export function addChargesSheet(
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
