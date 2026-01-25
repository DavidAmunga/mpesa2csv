import { useState } from "react";
import {
  ExportFormat,
  ExportOptions as ExportOptionsType,
  SortOrder,
  DateFormat,
  MPesaStatement,
} from "../types";
import { ExportService } from "../services/exportService";
import { WebhookService, WebhookResult } from "../services/webhookService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Info,
  Send,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  getDateFormatDisplayName,
  getAllDateFormats,
} from "../utils/dateFormatter";

interface ExportOptionsProps {
  exportFormat: ExportFormat;
  exportOptions: ExportOptionsType;
  statement: MPesaStatement;
  onFormatChange: (format: ExportFormat) => void;
  onOptionsChange: (options: ExportOptionsType) => void;
}

// Sheet option configuration with short names and descriptions
const SHEET_OPTIONS = [
  {
    key: "includeChargesSheet" as keyof ExportOptionsType,
    name: "Charges & Fees",
    description: "Separate sheet with all transaction charges and fees",
  },
  {
    key: "includeSummarySheet" as keyof ExportOptionsType,
    name: "Financial Summary",
    description:
      "Comprehensive financial analysis with cash flow, spending patterns, and insights",
  },
  {
    key: "includeBreakdownSheet" as keyof ExportOptionsType,
    name: "Monthly & Weekly Breakdown",
    description:
      "Pivot-like table with monthly and weekly aggregations showing inflows, outflows, net change, and average transaction size",
  },
  {
    key: "includeDailyBalanceSheet" as keyof ExportOptionsType,
    name: "Daily Balance Tracker",
    description:
      "Day-by-day balance tracker showing highest and lowest balances with spending pattern insights",
  },
  {
    key: "includeAmountDistributionSheet" as keyof ExportOptionsType,
    name: "Transaction Amount Distribution",
    description:
      "Groups transactions by amount ranges (e.g., <100 KES, 100-500 KES, >500 KES), showing counts, totals, and percentages for inflows and outflows separately. Excludes charges and fees.",
  },
  {
    key: "includeTopContactsSheet" as keyof ExportOptionsType,
    name: "Top Contacts",
    description:
      "Top 20 people/entities you send money to and receive money from, with totals and transaction counts. Excludes charges and fees.",
  },
  {
    key: "includeMoneyInSheet" as keyof ExportOptionsType,
    name: "Money In",
    description: "Separate sheet with all transactions where money was received",
  },
  {
    key: "includeMoneyOutSheet" as keyof ExportOptionsType,
    name: "Money Out",
    description: "Separate sheet with all transactions where money was spent",
  },
  
];

export default function ExportOptions({
  exportFormat,
  exportOptions,
  statement,
  onFormatChange,
  onOptionsChange,
}: ExportOptionsProps) {
  const [isWebhookOpen, setIsWebhookOpen] = useState(false);
  const [endpoint, setEndpoint] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [result, setResult] = useState<WebhookResult | null>(null);

  const handleFormatChange = (value: ExportFormat) => {
    onFormatChange(value);
  };

  const handleOptionChange = (
    optionKey: keyof ExportOptionsType,
    value: boolean
  ) => {
    const newOptions = {
      ...exportOptions,
      [optionKey]: value,
    };
    onOptionsChange(newOptions);
  };

  const handleFilterChange = (
    filterKey: keyof ExportOptionsType,
    value: boolean
  ) => {
    const newOptions = {
      ...exportOptions,
      [filterKey]: value,
    };
    onOptionsChange(newOptions);
  };

  const handleSortChange = (value: SortOrder) => {
    const newOptions = {
      ...exportOptions,
      sortOrder: value,
    };
    onOptionsChange(newOptions);
  };

  const handleDateFormatChange = (value: DateFormat) => {
    const newOptions = {
      ...exportOptions,
      dateFormat: value,
    };
    onOptionsChange(newOptions);
  };

  const handleSend = async () => {
    if (!endpoint.trim()) {
      setResult({
        success: false,
        error: "Please enter a webhook URL",
      });
      return;
    }

    setIsSending(true);
    setResult(null);

    try {
      const webhookResult = await WebhookService.sendToWebhook(
        statement,
        endpoint,
        exportOptions
      );
      setResult(webhookResult);
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message || "An unexpected error occurred",
      });
    } finally {
      setIsSending(false);
    }
  };

  const isValidUrl = endpoint.trim() && WebhookService.isValidUrl(endpoint);

  return (
    <div className="space-y-4">
      <div>
        <Label className="block text-sm font-medium mb-2">Export Format</Label>
        <Select value={exportFormat} onValueChange={handleFormatChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select export format">
              {ExportService.getFormatDisplayName(exportFormat)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ExportService.getAllFormats().map((format) => (
              <SelectItem key={format} value={format}>
                {ExportService.getFormatDisplayName(format)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filter Area */}
      <div>
        <div className="space-y-3">
          {/* Filter out charges */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="filter-charges"
              checked={exportOptions.filterOutCharges || false}
              onCheckedChange={(value) =>
                handleFilterChange("filterOutCharges", Boolean(value))
              }
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label
              htmlFor="filter-charges"
              className="flex-1 text-sm cursor-pointer"
            >
              Filter out charges and fees
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Excludes transactions containing "charge" in the details from
                  the main transactions sheet
                </p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Sort order */}
          <div>
            <Label className="block text-sm font-medium mb-2">Sort By</Label>
            <Select
              value={exportOptions.sortOrder || SortOrder.DESC}
              onValueChange={handleSortChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select sort order">
                  {exportOptions.sortOrder === SortOrder.DESC
                    ? "Most Recent First"
                    : "Oldest First"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SortOrder.DESC}>
                  Most Recent First
                </SelectItem>
                <SelectItem value={SortOrder.ASC}>Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Format */}
          <div>
            <Label className="block text-sm font-medium mb-2">
              Date Format
            </Label>
            <Select
              value={exportOptions.dateFormat || DateFormat.ISO_FORMAT}
              onValueChange={handleDateFormatChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select date format">
                  {getDateFormatDisplayName(
                    exportOptions.dateFormat || DateFormat.ISO_FORMAT
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {getAllDateFormats().map((format) => (
                  <SelectItem key={format} value={format}>
                    {getDateFormatDisplayName(format)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setIsWebhookOpen(!isWebhookOpen)}
          className="w-full flex items-center justify-between py-2 px-3 bg-muted/10 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            <Label className="text-sm font-medium cursor-pointer">
              Send to Webhook
            </Label>
          </div>
          {isWebhookOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {isWebhookOpen && (
          <div className="p-4 space-y-3 border-t border-border">
            <p className="text-xs">
              Send your transaction data as JSON to a webhook endpoint for
              reconciliation or integration with external systems.
            </p>

            <div className="space-y-2">
              <Label htmlFor="endpoint-url" className="text-sm">
                Webhook URL
              </Label>
              <Input
                id="endpoint-url"
                type="url"
                placeholder="https://api.example.com/webhooks/transactions"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                disabled={isSending}
                className="w-full"
              />
            </div>

            {result && (
              <div
                className={`rounded-lg border px-2 py-2 ${
                  result.success
                    ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
                    : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900"
                }`}
              >
                <div className="flex items-start gap-2">
                  {result.success ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-1.5">
                    <p
                      className={`text-xs font-medium ${
                        result.success
                          ? "text-green-800 dark:text-green-300"
                          : "text-red-800 dark:text-red-300"
                      }`}
                    >
                      {result.success
                        ? "Successfully sent to webhook"
                        : "Failed to send data"}
                    </p>

                    {result.statusCode && (
                      <p className="text-xs text-muted-foreground">
                        Status: {result.statusCode} {result.statusText}
                      </p>
                    )}

                    {result.error && (
                      <p className="text-xs text-red-700 dark:text-red-400 break-words">
                        {result.error}
                      </p>
                    )}

                    {result.responseBody && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          View response
                        </summary>
                        <pre className="mt-1.5 p-2 bg-zinc-900 rounded text-xs overflow-x-auto max-h-32">
                          {result.responseBody}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground rounded-md">
              <p>
                Ready to send {statement.transactions.length} transaction
                {statement.transactions.length !== 1 ? "s" : ""} as JSON
              </p>
            </div>

            <Button
              onClick={handleSend}
              disabled={isSending || !isValidUrl}
              className="w-full"
              size="sm"
            >
              {isSending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send to Webhook
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {exportFormat === ExportFormat.XLSX && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-medium">Additional Sheets</Label>
            <button
              type="button"
              onClick={() => {
                const allSelected = SHEET_OPTIONS.every(
                  (opt) => exportOptions[opt.key]
                );
                const newOptions: ExportOptionsType = { ...exportOptions };
                SHEET_OPTIONS.forEach((opt) => {
                  (newOptions as any)[opt.key] = !allSelected;
                });
                onOptionsChange(newOptions);
              }}
              className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
            >
              {SHEET_OPTIONS.every((opt) => exportOptions[opt.key])
                ? "Deselect All"
                : "Select All"}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SHEET_OPTIONS.map((option) => (
              <div
                key={option.key}
                className="flex items-start space-x-2 p-2.5 rounded-lg border border-border/50 hover:border-border hover:bg-muted/30 transition-colors"
              >
                <Checkbox
                  id={`sheet-${option.key}`}
                  checked={Boolean(exportOptions[option.key]) || false}
                  onCheckedChange={(value) =>
                    handleOptionChange(option.key, Boolean(value))
                  }
                  className="rounded border-gray-300 text-primary focus:ring-primary mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <Label
                    htmlFor={`sheet-${option.key}`}
                    className="text-sm cursor-pointer font-medium block leading-tight"
                  >
                    {option.name}
                  </Label>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help flex-shrink-0 mt-0.5" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>{option.description}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
