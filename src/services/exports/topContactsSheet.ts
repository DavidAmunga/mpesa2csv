import { MPesaStatement, Transaction } from "../../types";
import * as ExcelJS from "exceljs";

interface PartyData {
  party: string;
  totalAmount: number;
  transactionCount: number;
}

export function addTopContactsSheet(
  workbook: ExcelJS.Workbook,
  statement: MPesaStatement
): void {
  if (statement.transactions.length === 0) return;

  const nonChargeTransactions = statement.transactions.filter(
    (transaction) => !transaction.details.toLowerCase().includes("charge")
  );

  if (nonChargeTransactions.length === 0) return;

  const sentData = extractPartiesData(nonChargeTransactions, "sent");
  const receivedData = extractPartiesData(nonChargeTransactions, "received");

  const topSent = sentData.slice(0, 20);
  const topReceived = receivedData.slice(0, 20);

  if (topSent.length === 0 && topReceived.length === 0) return;

  const worksheet = workbook.addWorksheet("Top Contacts");

  worksheet.columns = [
    { header: "Party Sent To", key: "sentParty", width: 35 },
    { header: "Amount (KSh)", key: "sentAmount", width: 18 },
    { header: "Count", key: "sentCount", width: 10 },
    { header: "", key: "spacer", width: 3 },
    { header: "Party Received From", key: "receivedParty", width: 35 },
    { header: "Amount (KSh)", key: "receivedAmount", width: 18 },
    { header: "Count", key: "receivedCount", width: 10 },
  ];

  let currentRow = 1;

  worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = "TOP CONTACTS";
  worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 16 };
  worksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  worksheet.getCell(`A${currentRow}`).font.color = { argb: "FFFFFFFF" };
  worksheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
  currentRow += 2;

  worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = "TOP 20 MONEY SENT TO";
  worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
  worksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7E6E6" },
  };
  worksheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };

  worksheet.mergeCells(`E${currentRow}:G${currentRow}`);
  worksheet.getCell(`E${currentRow}`).value = "TOP 20 MONEY RECEIVED FROM";
  worksheet.getCell(`E${currentRow}`).font = { bold: true, size: 14 };
  worksheet.getCell(`E${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7E6E6" },
  };
  worksheet.getCell(`E${currentRow}`).alignment = { horizontal: "center" };
  currentRow++;

  worksheet.getCell(`A${currentRow}`).value = "Party";
  worksheet.getCell(`A${currentRow}`).font = { bold: true };
  worksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  worksheet.getCell(`B${currentRow}`).value = "Total Amount";
  worksheet.getCell(`B${currentRow}`).font = { bold: true };
  worksheet.getCell(`B${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  worksheet.getCell(`C${currentRow}`).value = "Transactions";
  worksheet.getCell(`C${currentRow}`).font = { bold: true };
  worksheet.getCell(`C${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  worksheet.getCell(`E${currentRow}`).value = "Party";
  worksheet.getCell(`E${currentRow}`).font = { bold: true };
  worksheet.getCell(`E${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  worksheet.getCell(`F${currentRow}`).value = "Total Amount";
  worksheet.getCell(`F${currentRow}`).font = { bold: true };
  worksheet.getCell(`F${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  worksheet.getCell(`G${currentRow}`).value = "Transactions";
  worksheet.getCell(`G${currentRow}`).font = { bold: true };
  worksheet.getCell(`G${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };
  currentRow++;

  const maxRows = Math.max(topSent.length, topReceived.length);
  for (let i = 0; i < maxRows; i++) {
    if (i < topSent.length) {
      worksheet.getCell(`A${currentRow}`).value = topSent[i].party;
      worksheet.getCell(`B${currentRow}`).value = `KSh ${topSent[
        i
      ].totalAmount.toLocaleString()}`;
      worksheet.getCell(`C${currentRow}`).value = topSent[i].transactionCount;
    }

    if (i < topReceived.length) {
      worksheet.getCell(`E${currentRow}`).value = topReceived[i].party;
      worksheet.getCell(`F${currentRow}`).value = `KSh ${topReceived[
        i
      ].totalAmount.toLocaleString()}`;
      worksheet.getCell(`G${currentRow}`).value =
        topReceived[i].transactionCount;
    }

    currentRow++;
  }

  currentRow++;
  const totalSent = topSent.reduce((sum, item) => sum + item.totalAmount, 0);
  const totalSentCount = topSent.reduce(
    (sum, item) => sum + item.transactionCount,
    0
  );
  const totalReceived = topReceived.reduce(
    (sum, item) => sum + item.totalAmount,
    0
  );
  const totalReceivedCount = topReceived.reduce(
    (sum, item) => sum + item.transactionCount,
    0
  );

  worksheet.getCell(`A${currentRow}`).value = "TOTAL:";
  worksheet.getCell(`A${currentRow}`).font = { bold: true };
  worksheet.getCell(
    `B${currentRow}`
  ).value = `KSh ${totalSent.toLocaleString()}`;
  worksheet.getCell(`B${currentRow}`).font = { bold: true };
  worksheet.getCell(`B${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFE4B5" },
  };
  worksheet.getCell(`C${currentRow}`).value = totalSentCount;
  worksheet.getCell(`C${currentRow}`).font = { bold: true };

  worksheet.getCell(`E${currentRow}`).value = "TOTAL:";
  worksheet.getCell(`E${currentRow}`).font = { bold: true };
  worksheet.getCell(
    `F${currentRow}`
  ).value = `KSh ${totalReceived.toLocaleString()}`;
  worksheet.getCell(`F${currentRow}`).font = { bold: true };
  worksheet.getCell(`F${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFE4B5" },
  };
  worksheet.getCell(`G${currentRow}`).value = totalReceivedCount;
  worksheet.getCell(`G${currentRow}`).font = { bold: true };

  for (let row = 1; row <= currentRow; row++) {
    for (let col = 1; col <= 7; col++) {
      if (col === 4) continue;
      const cell = worksheet.getCell(row, col);
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }
  }
}

function extractPartiesData(
  transactions: Transaction[],
  type: "sent" | "received"
): PartyData[] {
  const partiesMap = new Map<string, PartyData>();

  transactions.forEach((transaction) => {
    let party: string | null = null;

    if (type === "sent" && transaction.withdrawn && transaction.withdrawn > 0) {
      party = extractPartyFromDetails(transaction.details, "sent");
      if (!party && transaction.otherParty) {
        party = transaction.otherParty;
      }
    } else if (
      type === "received" &&
      transaction.paidIn &&
      transaction.paidIn > 0
    ) {
      party = extractPartyFromDetails(transaction.details, "received");
      if (!party && transaction.otherParty) {
        party = transaction.otherParty;
      }
    }

    if (party) {
      const amount =
        type === "sent" ? transaction.withdrawn || 0 : transaction.paidIn || 0;

      if (partiesMap.has(party)) {
        const existing = partiesMap.get(party)!;
        existing.totalAmount += amount;
        existing.transactionCount += 1;
      } else {
        partiesMap.set(party, {
          party,
          totalAmount: amount,
          transactionCount: 1,
        });
      }
    }
  });

  const partiesArray = Array.from(partiesMap.values());
  partiesArray.sort((a, b) => b.totalAmount - a.totalAmount);

  return partiesArray;
}

function extractPartyFromDetails(
  details: string,
  type: "sent" | "received"
): string | null {
  const sentPatterns = [
    /Customer Transfer (?:Fuliza M-Pesa )?to (.+)/i,
    /Merchant Payment(?: Online| Fuliza M-Pesa Online)? to (.+)/i,
    /Merchant Customer Payment to - (.+)/i,
    /Pay Bill(?: Online| Fuliza M-Pesa)? to (.+) Acc\./i,
    /Customer Withdrawal At Agent Till \d+ - (.+)/i,
  ];

  const receivedPatterns = [
    /Funds received from (.+)/i,
    /Customer Transfer from (.+)/i,
    /Merchant Payment(?:\s+with OD)? from - (.+)/i,
    /Business Payment from (.+?) via API/i,
    /Salary Payment from (.+?) via API/i,
    /Send Money Reversal via API to (.+)/i,
  ];

  const patterns = type === "sent" ? sentPatterns : receivedPatterns;

  for (const pattern of patterns) {
    const match = details.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}
