// จัดรูปแบบเงินตามสกุลของบัญชีโฆษณา (THB แสดงเป็น ฿)
export function money(n: number, currency = "THB"): string {
  try {
    return new Intl.NumberFormat("th-TH", { style: "currency", currency: currency || "THB", maximumFractionDigits: 0 }).format(Math.round(n));
  } catch {
    return Math.round(n).toLocaleString("en-US") + " " + currency;
  }
}
