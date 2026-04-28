/** Format kopecks as "1 500,00" (no currency symbol) */
export function formatAmount(kopecks: number): string {
  return (kopecks / 100).toLocaleString("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Display format: "01", "02", ..., "99", "101", "102", ... */
export function formatOffset(offset: number): string {
  if (offset < 100) return offset.toString().padStart(2, "0");
  return offset.toString();
}
