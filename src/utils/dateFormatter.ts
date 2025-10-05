import dayjs from "dayjs";
import { DateFormat } from "../types";

export function formatDate(
  dateString: string,
  format: DateFormat = DateFormat.ISO_FORMAT
): string {
  const date = dayjs(dateString);

  if (!date.isValid()) {
    return dateString;
  }

  switch (format) {
    case DateFormat.ISO_FORMAT:
      return date.format("YYYY-MM-DD HH:mm:ss");
    case DateFormat.DD_MMM_YYYY:
      return date.format("DD-MMM-YYYY hh:mm A");
    case DateFormat.DD_MMM_YYYY_SLASH:
      return date.format("DD/MMM/YYYY hh:mm A");
    default:
      return dateString;
  }
}

export function getDateFormatDisplayName(format: DateFormat): string {
  const now = dayjs();

  switch (format) {
    case DateFormat.ISO_FORMAT:
      return now.format("YYYY-MM-DD HH:mm");
    case DateFormat.DD_MMM_YYYY:
      return now.format("DD-MMM-YYYY hh:mm A");
    case DateFormat.DD_MMM_YYYY_SLASH:
      return now.format("DD/MMM/YYYY hh:mm A");
    default:
      return now.format("YYYY-MM-DD HH:mm");
  }
}

export function getAllDateFormats(): DateFormat[] {
  return [
    DateFormat.ISO_FORMAT,
    DateFormat.DD_MMM_YYYY,
    DateFormat.DD_MMM_YYYY_SLASH,
  ];
}
