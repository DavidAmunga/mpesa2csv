import { MPesaStatement, ExportOptions } from "../types";
import { applyTransactionFilters } from "./transactionFilters";

export class OfxService {
  /**
   * Generates OFX 2.0 (SGML-based) format for M-Pesa transactions
   * OFX and QFX use the same format, just different file extensions
   */
  static convertStatementToOfx(
    statement: MPesaStatement,
    options?: ExportOptions
  ): string {
    const filteredStatement = applyTransactionFilters(statement, options);
    const now = new Date();
    const dtserver = this.formatOfxDate(now);

    // Get first and last transaction dates
    const firstTransaction = filteredStatement.transactions[0];
    const lastTransaction =
      filteredStatement.transactions[filteredStatement.transactions.length - 1];
    const endBalance = lastTransaction ? lastTransaction.balance : 0;

    const ofxHeader = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

`;

    const ofxBody = `<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>${dtserver}
<LANGUAGE>ENG
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>KES
<BANKACCTFROM>
<BANKID>MPESA
<ACCTID>MPESA_STATEMENT
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>${this.formatOfxDate(
      new Date(firstTransaction?.completionTime || now)
    )}
<DTEND>${this.formatOfxDate(new Date(lastTransaction?.completionTime || now))}
${this.generateTransactions(filteredStatement)}
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>${endBalance.toFixed(2)}
<DTASOF>${dtserver}
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    return ofxHeader + ofxBody;
  }

  private static generateTransactions(
    statement: MPesaStatement,
    _options?: ExportOptions
  ): string {
    return statement.transactions
      .map((transaction, index) => {
        const date = this.formatOfxDate(new Date(transaction.completionTime));
        const amount =
          transaction.paidIn !== null
            ? transaction.paidIn
            : transaction.withdrawn !== null
            ? -transaction.withdrawn
            : 0;
        const trntype = transaction.paidIn !== null ? "CREDIT" : "DEBIT";

        // Clean up details for use as name
        const name =
          transaction.otherParty ||
          transaction.details.substring(0, 32).replace(/[<>&]/g, "");
        const memo = transaction.details.replace(/[<>&]/g, "");

        return `<STMTTRN>
<TRNTYPE>${trntype}
<DTPOSTED>${date}
<TRNAMT>${amount.toFixed(2)}
<FITID>${transaction.receiptNo || `TXN${index + 1}`}
<NAME>${name}
<MEMO>${memo}
</STMTTRN>`;
      })
      .join("\n");
  }

  /**
   * Format date as YYYYMMDDHHMMSS for OFX
   */
  private static formatOfxDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  static createDownloadLink(
    statement: MPesaStatement,
    options?: ExportOptions
  ): string {
    const content = this.convertStatementToOfx(statement, options);
    const blob = new Blob([content], {
      type: "application/x-ofx",
    });
    return URL.createObjectURL(blob);
  }

  static getFileName(
    statement: MPesaStatement,
    timestamp?: string,
    extension: "ofx" | "qfx" = "ofx"
  ): string {
    const baseFileName = statement.fileName
      ? statement.fileName.replace(/\.[^/.]+$/, "")
      : "mpesa-statement";

    const timeStamp =
      timestamp || new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    return `${baseFileName}_${timeStamp}.${extension}`;
  }
}
