import {
  MPesaStatement,
  Transaction,
  ExportOptions,
  SortOrder,
} from "../types";

/**
 * Applies filters and sorting to transactions based on export options
 */
export function applyTransactionFilters(
  statement: MPesaStatement,
  options?: ExportOptions
): MPesaStatement {
  let filteredTransactions = [...statement.transactions];

  // Apply charge filter if requested
  if (options?.filterOutCharges) {
    filteredTransactions = filteredTransactions.filter(
      (transaction) => !transaction.details.toLowerCase().includes("charge")
    );
  }

  // Apply sorting
  if (options?.sortOrder) {
    filteredTransactions.sort((a, b) => {
      const dateA = new Date(a.completionTime);
      const dateB = new Date(b.completionTime);

      if (options.sortOrder === SortOrder.DESC) {
        return dateB.getTime() - dateA.getTime();
      } else {
        return dateA.getTime() - dateB.getTime();
      }
    });
  }

  return {
    ...statement,
    transactions: filteredTransactions,
  };
}

/**
 * Checks if a transaction is a charge transaction
 * Uses the same logic as the chargesSheet
 */
export function isChargeTransaction(transaction: Transaction): boolean {
  return transaction.details.toLowerCase().includes("charge");
}
