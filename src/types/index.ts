export interface MPesaStatement {
  transactions: Transaction[];
  fileName?: string;
}

export interface Transaction {
  receiptNo: string;
  completionTime: string;
  details: string;
  transactionStatus: string;
  paidIn: number | null;
  withdrawn: number | null;
  balance: number;
  raw: string;
}

export enum FileStatus {
  IDLE = "idle",
  LOADING = "loading",
  PROTECTED = "protected",
  PROCESSING = "processing",
  SUCCESS = "success",
  ERROR = "error",
}

export enum ExportFormat {
  CSV = "csv",
  XLSX = "xlsx",
}

export enum SortOrder {
  DESC="desc",
  ASC="asc",
}

export interface ExportOptions {
  includeChargesSheet?: boolean;
  includeSummarySheet?: boolean;
  includeBreakdownSheet?: boolean;
  includeDailyBalanceSheet?: boolean;
  includeAmountDistributionSheet?: boolean;
  // Filter options
  filterOutCharges?: boolean;
  sortOrder?: SortOrder;
}
