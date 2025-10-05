import dayjs from "dayjs";

export const formatDateForFilename = (): string => {
  return dayjs().format("YYYY-MM-DD_HH-mm-ss");
};
