import { MPesaStatement } from "../../types";
import * as ExcelJS from "exceljs";

interface SizeDistributionBucket {
  range: string;
  minAmount: number;
  maxAmount: number | null;
  inflowCount: number;
  inflowTotal: number;
  inflowPercentage: number;
  outflowCount: number;
  outflowTotal: number;
  outflowPercentage: number;
}

interface SizeDistributionSummary {
  totalInflows: number;
  totalOutflows: number;
  totalInflowTransactions: number;
  totalOutflowTransactions: number;
  buckets: SizeDistributionBucket[];
}

export function addTransactionAmountDistributionSheet(
  workbook: ExcelJS.Workbook,
  statement: MPesaStatement
): void {
  // Filter out charge transactions for this analysis
  const nonChargeTransactions = statement.transactions.filter(
    (transaction) => !transaction.details.toLowerCase().includes("charge")
  );

  if (nonChargeTransactions.length === 0) {
    return; // No non-charge transactions found, don't create the sheet
  }

  // Calculate size distribution
  const sizeDistribution = calculateSizeDistribution(nonChargeTransactions);

  // Create the worksheet
  const worksheet = workbook.addWorksheet("Transaction Amount Distribution");

  // Add title
  worksheet.mergeCells("A1:I1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "Transaction Amount Distribution Analysis";
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: "center" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };

  // Add subtitle
  worksheet.mergeCells("A2:I2");
  const subtitleCell = worksheet.getCell("A2");
  subtitleCell.value = "Excludes transaction charges and fees";
  subtitleCell.font = { italic: true, size: 12 };
  subtitleCell.alignment = { horizontal: "center" };

  // Set up headers starting from row 4
  const headerRow = 4;
  const headers = [
    "Amount Range",
    "Inflow Count",
    "Inflow Total (KES)",
    "Inflow %",
    "Outflow Count",
    "Outflow Total (KES)",
    "Outflow %",
    "Total Count",
    "Total Amount (KES)",
  ];

  headers.forEach((header, index) => {
    const cell = worksheet.getCell(headerRow, index + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
    cell.alignment = { horizontal: "center" };
  });

  // Add data rows
  let currentRow = headerRow + 1;
  sizeDistribution.buckets.forEach((bucket) => {
    const totalCount = bucket.inflowCount + bucket.outflowCount;
    const totalAmount = bucket.inflowTotal + bucket.outflowTotal;

    worksheet.getCell(currentRow, 1).value = bucket.range;
    worksheet.getCell(currentRow, 2).value = bucket.inflowCount;
    worksheet.getCell(currentRow, 3).value = bucket.inflowTotal;
    worksheet.getCell(currentRow, 4).value = `${bucket.inflowPercentage.toFixed(
      1
    )}%`;
    worksheet.getCell(currentRow, 5).value = bucket.outflowCount;
    worksheet.getCell(currentRow, 6).value = bucket.outflowTotal;
    worksheet.getCell(
      currentRow,
      7
    ).value = `${bucket.outflowPercentage.toFixed(1)}%`;
    worksheet.getCell(currentRow, 8).value = totalCount;
    worksheet.getCell(currentRow, 9).value = totalAmount;

    // Format currency cells
    worksheet.getCell(currentRow, 3).numFmt = "#,##0.00";
    worksheet.getCell(currentRow, 6).numFmt = "#,##0.00";
    worksheet.getCell(currentRow, 9).numFmt = "#,##0.00";

    currentRow++;
  });

  // Add summary section
  currentRow += 2;
  worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
  const summaryTitleCell = worksheet.getCell(`A${currentRow}`);
  summaryTitleCell.value = "Summary";
  summaryTitleCell.font = { bold: true, size: 14 };
  summaryTitleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFD700" },
  };

  currentRow++;
  worksheet.getCell(currentRow, 1).value = "Total Inflow Transactions:";
  worksheet.getCell(currentRow, 2).value =
    sizeDistribution.totalInflowTransactions;
  worksheet.getCell(currentRow, 1).font = { bold: true };

  currentRow++;
  worksheet.getCell(currentRow, 1).value = "Total Inflow Amount:";
  worksheet.getCell(currentRow, 2).value = sizeDistribution.totalInflows;
  worksheet.getCell(currentRow, 2).numFmt = "#,##0.00";
  worksheet.getCell(currentRow, 1).font = { bold: true };

  currentRow++;
  worksheet.getCell(currentRow, 1).value = "Total Outflow Transactions:";
  worksheet.getCell(currentRow, 2).value =
    sizeDistribution.totalOutflowTransactions;
  worksheet.getCell(currentRow, 1).font = { bold: true };

  currentRow++;
  worksheet.getCell(currentRow, 1).value = "Total Outflow Amount:";
  worksheet.getCell(currentRow, 2).value = sizeDistribution.totalOutflows;
  worksheet.getCell(currentRow, 2).numFmt = "#,##0.00";
  worksheet.getCell(currentRow, 1).font = { bold: true };

  // Set column widths
  worksheet.columns = [
    { width: 20 }, // Amount Range
    { width: 12 }, // Inflow Count
    { width: 18 }, // Inflow Total
    { width: 10 }, // Inflow %
    { width: 12 }, // Outflow Count
    { width: 18 }, // Outflow Total
    { width: 10 }, // Outflow %
    { width: 12 }, // Total Count
    { width: 18 }, // Total Amount
  ];

  // Add borders to all data cells
  const dataRange = worksheet.getRows(headerRow, currentRow);
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
}

function calculateSizeDistribution(
  transactions: any[]
): SizeDistributionSummary {
  // Define amount ranges (in KES)
  const ranges = [
    { range: "< 100 KES", minAmount: 0, maxAmount: 99.99 },
    { range: "100 - 500 KES", minAmount: 100, maxAmount: 500 },
    { range: "501 - 1,000 KES", minAmount: 501, maxAmount: 1000 },
    { range: "1,001 - 5,000 KES", minAmount: 1001, maxAmount: 5000 },
    { range: "5,001 - 10,000 KES", minAmount: 5001, maxAmount: 10000 },
    { range: "10,001 - 50,000 KES", minAmount: 10001, maxAmount: 50000 },
    { range: "> 50,000 KES", minAmount: 50001, maxAmount: null },
  ];

  // Initialize buckets
  const buckets: SizeDistributionBucket[] = ranges.map((range) => ({
    range: range.range,
    minAmount: range.minAmount,
    maxAmount: range.maxAmount,
    inflowCount: 0,
    inflowTotal: 0,
    inflowPercentage: 0,
    outflowCount: 0,
    outflowTotal: 0,
    outflowPercentage: 0,
  }));

  let totalInflows = 0;
  let totalOutflows = 0;
  let totalInflowTransactions = 0;
  let totalOutflowTransactions = 0;

  // Process each transaction
  transactions.forEach((transaction) => {
    const amount = Math.abs(transaction.paidIn || transaction.withdrawn || 0);
    const isInflow = transaction.paidIn !== null && transaction.paidIn > 0;
    const isOutflow =
      transaction.withdrawn !== null && transaction.withdrawn > 0;

    if (!isInflow && !isOutflow) return;

    // Find the appropriate bucket
    const bucket = buckets.find((b) => {
      if (b.maxAmount === null) {
        return amount >= b.minAmount;
      }
      return amount >= b.minAmount && amount <= b.maxAmount;
    });

    if (bucket) {
      if (isInflow) {
        bucket.inflowCount++;
        bucket.inflowTotal += amount;
        totalInflows += amount;
        totalInflowTransactions++;
      } else if (isOutflow) {
        bucket.outflowCount++;
        bucket.outflowTotal += amount;
        totalOutflows += amount;
        totalOutflowTransactions++;
      }
    }
  });

  // Calculate percentages
  buckets.forEach((bucket) => {
    bucket.inflowPercentage =
      totalInflowTransactions > 0
        ? (bucket.inflowCount / totalInflowTransactions) * 100
        : 0;
    bucket.outflowPercentage =
      totalOutflowTransactions > 0
        ? (bucket.outflowCount / totalOutflowTransactions) * 100
        : 0;
  });

  return {
    totalInflows,
    totalOutflows,
    totalInflowTransactions,
    totalOutflowTransactions,
    buckets,
  };
}
