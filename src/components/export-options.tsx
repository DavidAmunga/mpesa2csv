import { ExportFormat, ExportOptions as ExportOptionsType } from "../types";
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

      {exportFormat === ExportFormat.XLSX && (
        <div>
          <Label className="block text-sm font-medium mb-3">
            Additional Sheets
          </Label>
          <div className="grid grid-cols-1 gap-3">
            {SHEET_OPTIONS.map((option) => (
              <div key={option.key} className="flex items-center space-x-2">
                <Checkbox
                  checked={exportOptions[option.key] || false}
                  onCheckedChange={(value) =>
                    handleOptionChange(option.key, Boolean(value))
                  }
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label className="flex-1 text-sm">{option.name}</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
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
