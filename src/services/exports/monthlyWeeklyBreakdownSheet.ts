import { MPesaStatement } from "../../types";
import * as ExcelJS from "exceljs";

interface AggregatedData {
  period: string;
  inflows: number;
  outflows: number;
  netChange: number;
  avgTransaction: number;
  transactionCount: number;
  weekStart?: Date;
}

export function addMonthlyWeeklyBreakdownSheet(
  workbook: ExcelJS.Workbook,
  statement: MPesaStatement
): void {
  if (statement.transactions.length === 0) return;

  const breakdownWorksheet = workbook.addWorksheet(
    "Monthly & Weekly Breakdown"
  );

  // Group transactions by month and week
  const monthlyData = aggregateTransactionsByMonth(statement.transactions);
  const weeklyData = aggregateTransactionsByWeek(statement.transactions);

  let currentRow = 1;

  // Title
  breakdownWorksheet.getCell(`A${currentRow}`).value =
    "MONTHLY & WEEKLY BREAKDOWN";
  breakdownWorksheet.getCell(`A${currentRow}`).font = {
    bold: true,
    size: 16,
  };
  breakdownWorksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2E75B6" },
  };
  breakdownWorksheet.getCell(`A${currentRow}`).font.color = {
    argb: "FFFFFFFF",
  };
  breakdownWorksheet.mergeCells(`A${currentRow}:F${currentRow}`);
  currentRow += 2;

  // Monthly Breakdown Section
  breakdownWorksheet.getCell(`A${currentRow}`).value = "MONTHLY BREAKDOWN";
  breakdownWorksheet.getCell(`A${currentRow}`).font = {
    bold: true,
    size: 14,
  };
  breakdownWorksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7E6E6" },
  };
  breakdownWorksheet.mergeCells(`A${currentRow}:F${currentRow}`);
  currentRow++;

  // Monthly headers
  const monthlyHeaders = [
    "Month",
    "Inflows (KES)",
    "Outflows (KES)",
    "Net Change (KES)",
    "Avg Transaction (KES)",
    "Transaction Count",
  ];
  monthlyHeaders.forEach((header, index) => {
    const cell = breakdownWorksheet.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9E2F3" },
    };
    cell.alignment = { horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  currentRow++;

  // Monthly data rows
  monthlyData.forEach((monthData) => {
    const rowData = [
      monthData.period,
      monthData.inflows,
      monthData.outflows,
      monthData.netChange,
      monthData.avgTransaction,
      monthData.transactionCount,
    ];

    rowData.forEach((value, index) => {
      const cell = breakdownWorksheet.getCell(currentRow, index + 1);
      cell.value = value;
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };

      // Format currency values
      if (index >= 1 && index <= 4) {
        cell.numFmt = "#,##0.00";
      }

      // Color code net change
      if (index === 3) {
        cell.font = {
          color: { argb: monthData.netChange >= 0 ? "FF008000" : "FFFF0000" },
          bold: true,
        };
      }
    });
    currentRow++;
  });

  currentRow += 2;

  // Weekly Breakdown Section
  breakdownWorksheet.getCell(`A${currentRow}`).value = "WEEKLY BREAKDOWN";
  breakdownWorksheet.getCell(`A${currentRow}`).font = {
    bold: true,
    size: 14,
  };
  breakdownWorksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7E6E6" },
  };
  breakdownWorksheet.mergeCells(`A${currentRow}:F${currentRow}`);
  currentRow++;

  // Weekly headers
  const weeklyHeaders = [
    "Week",
    "Inflows (KES)",
    "Outflows (KES)",
    "Net Change (KES)",
    "Avg Transaction (KES)",
    "Transaction Count",
  ];
  weeklyHeaders.forEach((header, index) => {
    const cell = breakdownWorksheet.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9E2F3" },
    };
    cell.alignment = { horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  currentRow++;

  // Weekly data rows (show only last 12 weeks to keep it manageable)
  const recentWeeks = weeklyData.slice(-12);
  recentWeeks.forEach((weekData) => {
    const rowData = [
      weekData.period,
      weekData.inflows,
      weekData.outflows,
      weekData.netChange,
      weekData.avgTransaction,
      weekData.transactionCount,
    ];

    rowData.forEach((value, index) => {
      const cell = breakdownWorksheet.getCell(currentRow, index + 1);
      cell.value = value;
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };

      // Format currency values
      if (index >= 1 && index <= 4) {
        cell.numFmt = "#,##0.00";
      }

      // Color code net change
      if (index === 3) {
        cell.font = {
          color: { argb: weekData.netChange >= 0 ? "FF008000" : "FFFF0000" },
          bold: true,
        };
      }
    });
    currentRow++;
  });

  // Set column widths
  breakdownWorksheet.columns = [
    { width: 20 }, // Period
    { width: 15 }, // Inflows
    { width: 15 }, // Outflows
    { width: 15 }, // Net Change
    { width: 18 }, // Avg Transaction
    { width: 15 }, // Transaction Count
  ];
}

function aggregateTransactionsByMonth(transactions: any[]): AggregatedData[] {
  const monthlyMap = new Map<
    string,
    {
      inflows: number;
      outflows: number;
      transactionCount: number;
      transactions: any[];
    }
  >();

  transactions.forEach((transaction) => {
    const date = new Date(transaction.completionTime);
    const monthKey = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}`;

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, {
        inflows: 0,
        outflows: 0,
        transactionCount: 0,
        transactions: [],
      });
    }

    const monthData = monthlyMap.get(monthKey)!;
    monthData.transactionCount++;
    monthData.transactions.push(transaction);

    if (transaction.paidIn && transaction.paidIn > 0) {
      monthData.inflows += transaction.paidIn;
    }
    if (transaction.withdrawn && transaction.withdrawn > 0) {
      monthData.outflows += transaction.withdrawn;
    }
  });

  return Array.from(monthlyMap.entries())
    .map(([monthKey, data]) => {
      const date = new Date(monthKey + "-01");
      const monthName = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      });
      const netChange = data.inflows - data.outflows;
      const avgTransaction =
        data.transactionCount > 0
          ? (data.inflows + data.outflows) / data.transactionCount
          : 0;

      return {
        period: monthName,
        inflows: data.inflows,
        outflows: data.outflows,
        netChange,
        avgTransaction,
        transactionCount: data.transactionCount,
      };
    })
    .sort((a, b) => a.period.localeCompare(b.period));
}

function aggregateTransactionsByWeek(transactions: any[]): AggregatedData[] {
  const weeklyMap = new Map<
    string,
    {
      inflows: number;
      outflows: number;
      transactionCount: number;
      weekStart: Date;
    }
  >();

  transactions.forEach((transaction) => {
    const date = new Date(transaction.completionTime);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0);

    const weekKey = weekStart.toISOString().split("T")[0];

    if (!weeklyMap.has(weekKey)) {
      weeklyMap.set(weekKey, {
        inflows: 0,
        outflows: 0,
        transactionCount: 0,
        weekStart: new Date(weekStart),
      });
    }

    const weekData = weeklyMap.get(weekKey)!;
    weekData.transactionCount++;

    if (transaction.paidIn && transaction.paidIn > 0) {
      weekData.inflows += transaction.paidIn;
    }
    if (transaction.withdrawn && transaction.withdrawn > 0) {
      weekData.outflows += transaction.withdrawn;
    }
  });

  return Array.from(weeklyMap.entries())
    .map(([, data]) => {
      const weekEnd = new Date(data.weekStart);
      weekEnd.setDate(data.weekStart.getDate() + 6);

      const periodLabel = `${data.weekStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })} - ${weekEnd.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`;

      const netChange = data.inflows - data.outflows;
      const avgTransaction =
        data.transactionCount > 0
          ? (data.inflows + data.outflows) / data.transactionCount
          : 0;

      return {
        period: periodLabel,
        inflows: data.inflows,
        outflows: data.outflows,
        netChange,
        avgTransaction,
        transactionCount: data.transactionCount,
        weekStart: data.weekStart,
      };
    })
    .sort((a, b) => a.weekStart!.getTime() - b.weekStart!.getTime());
}
