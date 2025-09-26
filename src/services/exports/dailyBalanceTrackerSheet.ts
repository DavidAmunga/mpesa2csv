import { MPesaStatement } from "../../types";
import * as ExcelJS from "exceljs";

interface DailyBalanceData {
  date: string;
  endBalance: number;
  transactionCount: number;
  rawDate: Date;
}

interface BalanceAnalysis {
  startDate: string;
  endDate: string;
  totalDays: number;
  highestBalance: number;
  lowestBalance: number;
  averageBalance: number;
  bestDay: string;
  worstDay: string;
  volatilityPercentage: number;
}

export function addDailyBalanceTrackerSheet(
  workbook: ExcelJS.Workbook,
  statement: MPesaStatement
): void {
  if (statement.transactions.length === 0) return;

  const balanceWorksheet = workbook.addWorksheet("Daily Balance Tracker");

  // Generate daily balance data
  const dailyBalanceData = generateDailyBalanceData(statement.transactions);
  const balanceAnalysis = analyzeDailyBalances(dailyBalanceData);

  let currentRow = 1;

  // Title
  balanceWorksheet.getCell(`A${currentRow}`).value = "DAILY BALANCE TRACKER";
  balanceWorksheet.getCell(`A${currentRow}`).font = { bold: true, size: 16 };
  balanceWorksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF8E44AD" },
  };
  balanceWorksheet.getCell(`A${currentRow}`).font.color = {
    argb: "FFFFFFFF",
  };
  balanceWorksheet.mergeCells(`A${currentRow}:F${currentRow}`);
  currentRow += 2;

  // Summary Section
  balanceWorksheet.getCell(`A${currentRow}`).value = "BALANCE ANALYSIS SUMMARY";
  balanceWorksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
  balanceWorksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7E6E6" },
  };
  balanceWorksheet.mergeCells(`A${currentRow}:F${currentRow}`);
  currentRow++;

  const summaryData = [
    ["Period:", `${balanceAnalysis.startDate} to ${balanceAnalysis.endDate}`],
    ["Total Days Tracked:", balanceAnalysis.totalDays],
    [
      "Highest Balance:",
      `KES ${balanceAnalysis.highestBalance.toLocaleString()}`,
    ],
    [
      "Lowest Balance:",
      `KES ${balanceAnalysis.lowestBalance.toLocaleString()}`,
    ],
    [
      "Average Daily Balance:",
      `KES ${balanceAnalysis.averageBalance.toLocaleString()}`,
    ],
    ["Best Day:", balanceAnalysis.bestDay],
    ["Worst Day:", balanceAnalysis.worstDay],
    ["Balance Volatility:", `${balanceAnalysis.volatilityPercentage}%`],
  ];

  summaryData.forEach(([label, value]) => {
    balanceWorksheet.getCell(`A${currentRow}`).value = label;
    balanceWorksheet.getCell(`A${currentRow}`).font = { bold: true };
    balanceWorksheet.getCell(`B${currentRow}`).value = value;

    // Color code high and low indicators
    if (typeof label === "string" && label.includes("Highest Balance")) {
      balanceWorksheet.getCell(`B${currentRow}`).font = {
        color: { argb: "FF008000" },
        bold: true,
      };
    } else if (typeof label === "string" && label.includes("Lowest Balance")) {
      balanceWorksheet.getCell(`B${currentRow}`).font = {
        color: { argb: "FFFF0000" },
        bold: true,
      };
    }
    currentRow++;
  });

  currentRow += 2;

  // Daily Balance Table
  balanceWorksheet.getCell(`A${currentRow}`).value = "DAILY BALANCE HISTORY";
  balanceWorksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
  balanceWorksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7E6E6" },
  };
  balanceWorksheet.mergeCells(`A${currentRow}:F${currentRow}`);
  currentRow++;

  // Table headers
  const headers = [
    "Date",
    "End of Day Balance (KES)",
    "Daily Change (KES)",
    "Transactions Count",
    "High/Low",
    "Notes",
  ];
  headers.forEach((header, index) => {
    const cell = balanceWorksheet.getCell(currentRow, index + 1);
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

  // Daily balance rows
  dailyBalanceData.forEach((dayData, index) => {
    const previousBalance =
      index > 0 ? dailyBalanceData[index - 1].endBalance : dayData.endBalance;
    const dailyChange = dayData.endBalance - previousBalance;

    let highLowIndicator = "";
    let notes = "";

    if (dayData.endBalance === balanceAnalysis.highestBalance) {
      highLowIndicator = "HIGHEST";
      notes = "Best balance recorded";
    } else if (dayData.endBalance === balanceAnalysis.lowestBalance) {
      highLowIndicator = "LOWEST";
      notes = "Lowest balance recorded";
    } else if (Math.abs(dailyChange) > balanceAnalysis.averageBalance * 0.1) {
      notes = dailyChange > 0 ? "Big increase" : "Big decrease";
    }

    const rowData = [
      dayData.date,
      dayData.endBalance,
      index > 0 ? dailyChange : 0,
      dayData.transactionCount,
      highLowIndicator,
      notes,
    ];

    rowData.forEach((value, colIndex) => {
      const cell = balanceWorksheet.getCell(currentRow, colIndex + 1);
      cell.value = value;
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };

      // Format currency values
      if (colIndex === 1 || colIndex === 2) {
        cell.numFmt = "#,##0.00";
      }

      // Color code high/low indicators
      if (colIndex === 4 && highLowIndicator) {
        cell.font = {
          color: {
            argb: highLowIndicator === "HIGHEST" ? "FF008000" : "FFFF0000",
          },
          bold: true,
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: highLowIndicator === "HIGHEST" ? "FFE8F5E8" : "FFFFEAEA",
          },
        };
      }

      // Color code daily changes
      if (colIndex === 2 && index > 0) {
        cell.font = {
          color: { argb: dailyChange >= 0 ? "FF008000" : "FFFF0000" },
        };
      }
    });
    currentRow++;
  });

  // Set column widths
  balanceWorksheet.columns = [
    { width: 12 }, // Date
    { width: 20 }, // End of Day Balance
    { width: 18 }, // Daily Change
    { width: 16 }, // Transaction Count
    { width: 15 }, // High/Low
    { width: 25 }, // Notes
  ];
}

function generateDailyBalanceData(transactions: any[]): DailyBalanceData[] {
  // Sort transactions by completion time
  const sortedTransactions = [...transactions].sort(
    (a, b) =>
      new Date(a.completionTime).getTime() -
      new Date(b.completionTime).getTime()
  );

  const dailyMap = new Map<
    string,
    {
      endBalance: number;
      transactionCount: number;
      transactions: any[];
    }
  >();

  // Group transactions by date and track end-of-day balances
  sortedTransactions.forEach((transaction) => {
    const date = new Date(transaction.completionTime);
    const dateKey = date.toISOString().split("T")[0];

    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, {
        endBalance: 0,
        transactionCount: 0,
        transactions: [],
      });
    }

    const dayData = dailyMap.get(dateKey)!;
    dayData.transactionCount++;
    dayData.transactions.push(transaction);
    // Use the balance from this transaction as it represents the balance after this transaction
    dayData.endBalance = transaction.balance;
  });

  // Convert to array and sort by date
  return Array.from(dailyMap.entries())
    .map(([dateKey, data]) => ({
      date: new Date(dateKey).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      endBalance: data.endBalance,
      transactionCount: data.transactionCount,
      rawDate: new Date(dateKey),
    }))
    .sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
}

function analyzeDailyBalances(
  dailyBalanceData: DailyBalanceData[]
): BalanceAnalysis {
  if (dailyBalanceData.length === 0) {
    return {
      startDate: "",
      endDate: "",
      totalDays: 0,
      highestBalance: 0,
      lowestBalance: 0,
      averageBalance: 0,
      bestDay: "",
      worstDay: "",
      volatilityPercentage: 0,
    };
  }

  const balances = dailyBalanceData.map((d) => d.endBalance);
  const highestBalance = Math.max(...balances);
  const lowestBalance = Math.min(...balances);
  const averageBalance =
    balances.reduce((sum, balance) => sum + balance, 0) / balances.length;

  const bestEntry = dailyBalanceData.find(
    (d) => d.endBalance === highestBalance
  );
  const worstEntry = dailyBalanceData.find(
    (d) => d.endBalance === lowestBalance
  );

  // Calculate volatility as coefficient of variation
  const variance =
    balances.reduce(
      (sum, balance) => sum + Math.pow(balance - averageBalance, 2),
      0
    ) / balances.length;
  const standardDeviation = Math.sqrt(variance);
  const volatilityPercentage =
    averageBalance > 0
      ? Math.round((standardDeviation / averageBalance) * 100)
      : 0;

  return {
    startDate: dailyBalanceData[0].date,
    endDate: dailyBalanceData[dailyBalanceData.length - 1].date,
    totalDays: dailyBalanceData.length,
    highestBalance,
    lowestBalance,
    averageBalance: Math.round(averageBalance),
    bestDay: bestEntry?.date || "",
    worstDay: worstEntry?.date || "",
    volatilityPercentage,
  };
}
