import { MPesaStatement, Transaction } from "../../types";
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

  // Create a map of receipt numbers to all transactions for quick lookup
  const receiptMap = new Map<string, Transaction[]>();
  statement.transactions.forEach((transaction) => {
    if (!receiptMap.has(transaction.receiptNo)) {
      receiptMap.set(transaction.receiptNo, []);
    }
    receiptMap.get(transaction.receiptNo)!.push(transaction);
  });

  // Create the charges worksheet
  const chargesWorksheet = workbook.addWorksheet("Charges & Fees");

  // Define columns for charges sheet (updated with new columns)
  chargesWorksheet.columns = [
    { header: "Receipt No", key: "receiptNo", width: 12 },
    { header: "Date", key: "date", width: 12 },
    { header: "Full Details", key: "fullDetails", width: 40 },
    { header: "Charge Amount", key: "amount", width: 15 },
    { header: "Related Transaction Amount", key: "relatedAmount", width: 20 },
    { header: "Charge Percentage", key: "chargePercentage", width: 18 },
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
    const chargeAmount = transaction.withdrawn || transaction.paidIn || 0;

    // Find related transactions with the same receipt number
    const relatedTransactions = receiptMap.get(transaction.receiptNo) || [];
    const nonChargeTransactions = relatedTransactions.filter(
      (t) => !t.details.toLowerCase().includes("charge")
    );

    let relatedAmount = 0;
    let chargePercentage = 0;

    if (nonChargeTransactions.length > 0) {
      // If there are multiple non-charge transactions with the same receipt,
      // sum their amounts (this handles cases where there might be multiple related transactions)
      relatedAmount = nonChargeTransactions.reduce((sum, t) => {
        return sum + (t.withdrawn || t.paidIn || 0);
      }, 0);

      // Calculate charge percentage
      if (relatedAmount > 0) {
        chargePercentage =
          (Math.abs(chargeAmount) / Math.abs(relatedAmount)) * 100;
      }
    }

    chargesWorksheet.addRow({
      receiptNo: transaction.receiptNo,
      date: transaction.completionTime,
      fullDetails: transaction.details,
      amount: chargeAmount,
      relatedAmount: relatedAmount || "N/A",
      chargePercentage:
        chargePercentage > 0 ? `${chargePercentage.toFixed(2)}%` : "N/A",
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

  // Count transactions with related amounts
  const transactionsWithRelated = chargeTransactions.filter((transaction) => {
    const relatedTransactions = receiptMap.get(transaction.receiptNo) || [];
    const nonChargeTransactions = relatedTransactions.filter(
      (t) => !t.details.toLowerCase().includes("charge")
    );
    return nonChargeTransactions.length > 0;
  }).length;

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

  chargesWorksheet.getCell(`A${summaryStartRow + 2}`).value =
    "Charges with Related Transactions:";
  chargesWorksheet.getCell(`A${summaryStartRow + 2}`).font = { bold: true };
  chargesWorksheet.getCell(`D${summaryStartRow + 2}`).value =
    transactionsWithRelated;
  chargesWorksheet.getCell(`D${summaryStartRow + 2}`).font = { bold: true };
}
