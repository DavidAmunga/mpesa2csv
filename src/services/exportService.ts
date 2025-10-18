import { MPesaStatement, ExportFormat, ExportOptions } from "../types";
import { CsvService } from "./csvService";
import { XlsxService } from "./xlsxService";
import { JsonService } from "./jsonService";
import { OfxService } from "./ofxService";
import { QifService } from "./qifService";

export class ExportService {
  static async createDownloadLink(
    statement: MPesaStatement,
    format: ExportFormat,
    options?: ExportOptions
  ): Promise<string> {
    switch (format) {
      case ExportFormat.CSV:
        return CsvService.createDownloadLink(statement, options);
      case ExportFormat.XLSX:
        return await XlsxService.createDownloadLink(statement, options);
      case ExportFormat.JSON:
        return JsonService.createDownloadLink(statement, options);
      case ExportFormat.OFX:
      case ExportFormat.QFX:
        return OfxService.createDownloadLink(statement, options);
      case ExportFormat.QIF:
        return QifService.createDownloadLink(statement, options);
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
      case ExportFormat.JSON:
        return JsonService.getFileName(statement, timestamp);
      case ExportFormat.OFX:
        return OfxService.getFileName(statement, timestamp, "ofx");
      case ExportFormat.QFX:
        return OfxService.getFileName(statement, timestamp, "qfx");
      case ExportFormat.QIF:
        return QifService.getFileName(statement, timestamp);
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
      case ExportFormat.JSON:
        return "json";
      case ExportFormat.OFX:
        return "ofx";
      case ExportFormat.QFX:
        return "qfx";
      case ExportFormat.QIF:
        return "qif";
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
      case ExportFormat.JSON:
        return "JSON";
      case ExportFormat.OFX:
        return "OFX (Open Financial Exchange) - (Experimental)";
      case ExportFormat.QFX:
        return "QFX (Quicken) - (Experimental)";
      case ExportFormat.QIF:
        return "QIF (Quicken Interchange) - (Experimental)";
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  static getAllFormats(): ExportFormat[] {
    return [
      ExportFormat.CSV,
      ExportFormat.XLSX,
      ExportFormat.JSON,
      ExportFormat.OFX,
      ExportFormat.QFX,
      ExportFormat.QIF,
    ];
  }

  static async getFileBuffer(
    statement: MPesaStatement,
    format: ExportFormat,
    options?: ExportOptions
  ): Promise<ArrayBuffer> {
    switch (format) {
      case ExportFormat.CSV:
        const csvContent = CsvService.convertStatementToCsv(statement, options);
        const BOM = "\uFEFF";
        const csvWithBOM = BOM + csvContent;
        return new TextEncoder().encode(csvWithBOM).buffer;
      case ExportFormat.XLSX:
        return await XlsxService.convertStatementToXlsx(statement, options);
      case ExportFormat.JSON:
        const jsonContent = JsonService.convertStatementToJson(
          statement,
          options
        );
        return new TextEncoder().encode(jsonContent).buffer;
      case ExportFormat.OFX:
      case ExportFormat.QFX:
        const ofxContent = OfxService.convertStatementToOfx(statement, options);
        return new TextEncoder().encode(ofxContent).buffer;
      case ExportFormat.QIF:
        const qifContent = QifService.convertStatementToQif(statement, options);
        return new TextEncoder().encode(qifContent).buffer;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
}
