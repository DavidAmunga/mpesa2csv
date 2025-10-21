import {
  ExportFormat,
  ExportOptions as ExportOptionsType,
  SortOrder,
  DateFormat,
} from "../types";
import { ExportService } from "../services/exportService";
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
import { Info } from "lucide-react";
import {
  getDateFormatDisplayName,
  getAllDateFormats,
} from "../utils/dateFormatter";

interface ExportOptionsProps {
  exportFormat: ExportFormat;
  exportOptions: ExportOptionsType;
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
];

export default function ExportOptions({
  exportFormat,
  exportOptions,
  onFormatChange,
  onOptionsChange,
}: ExportOptionsProps) {
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
