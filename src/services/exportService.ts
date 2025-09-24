import { MPesaStatement, ExportFormat } from "../types";
import { CsvService } from "./csvService";
import { XlsxService } from "./xlsxService";

export class ExportService {
  static async createDownloadLink(
    statement: MPesaStatement,
    format: ExportFormat
  ): Promise<string> {
    switch (format) {
      case ExportFormat.CSV:
        return CsvService.createDownloadLink(statement);
      case ExportFormat.XLSX:
        return await XlsxService.createDownloadLink(statement);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  static getFileName(
    statement: MPesaStatement,
    format: ExportFormat,
    timestamp?: string
  ): string {
    switch (format) {
      case ExportFormat.CSV:
        return CsvService.getFileName(statement, timestamp);
      case ExportFormat.XLSX:
        return XlsxService.getFileName(statement, timestamp);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  static getFileExtension(format: ExportFormat): string {
    switch (format) {
      case ExportFormat.CSV:
        return "csv";
      case ExportFormat.XLSX:
        return "xlsx";
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  static getFormatDisplayName(format: ExportFormat): string {
    switch (format) {
      case ExportFormat.CSV:
        return "CSV";
      case ExportFormat.XLSX:
        return "Excel (XLSX)";
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  static getAllFormats(): ExportFormat[] {
    return [ExportFormat.CSV, ExportFormat.XLSX];
  }

  static async getFileBuffer(
    statement: MPesaStatement,
    format: ExportFormat
  ): Promise<ArrayBuffer> {
    switch (format) {
      case ExportFormat.CSV:
        const csvContent = CsvService.convertStatementToCsv(statement);
        const BOM = "\uFEFF";
        const csvWithBOM = BOM + csvContent;
        return new TextEncoder().encode(csvWithBOM).buffer;
      case ExportFormat.XLSX:
        return await XlsxService.convertStatementToXlsx(statement);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
}
