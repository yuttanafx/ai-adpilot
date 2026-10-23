import { DAYS } from "@/lib/data";
import { money } from "@/lib/format";

const X0 = 72;
const X1 = 764;
const Y_TOP = 16;
const Y_BOT = 210;

const short = (v: number) => (v >= 1_000_000 ? Math.round(v / 100_000) / 10 + "M" : v >= 1000 ? Math.round(v / 100) / 10 + "k" : String(Math.round(v)));

// ขั้นของแกน Y แบบ 1 / 2 / 5 × 10^n เพื่อให้ใช้ได้กับทั้งบัญชีเล็กและใหญ่
function niceStep(raw: number): number {
  if (!(raw > 0)) return 1000;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
}

export default function TrendChart({ spend, sales, days = DAYS, currency = "THB" }: { spend: number[]; sales: number[]; days?: string[]; currency?: string }) {
  const baht = (v: number) => money(v, currency);
  const DAYS_ = days;
  const step = niceStep(Math.max(...sales, ...spend, 1) / 4);
  const top = step * 4;
  const x = (i: number) => Math.round(X0 + (i * (X1 - X0)) / Math.max(DAYS_.length - 1, 1));
  const y = (v: number) => Math.round(Y_BOT - (v / top) * (Y_BOT - Y_TOP));
  const line = (arr: number[]) => arr.map((v, i) => `${x(i)},${y(v)}`).join(" ");

  return (
    <svg
      className="chart"
      viewBox="0 0 800 250"
      role="img"
      aria-label={`ค่าโฆษณาและยอดขายรายวัน (${currency}) ${DAYS_[0]} ถึง ${DAYS_[DAYS_.length - 1]} ยอดขายสูงสุด ${baht(Math.max(...sales))}`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const v = (top / 4) * i;
        return (
          <g key={i}>
            <line x1={56} x2={780} y1={y(v)} y2={y(v)} stroke="#222a3b" />
            <text x={48} y={y(v) + 4} textAnchor="end">{short(v)}</text>
          </g>
        );
      })}
      {DAYS_.map((d, i) => (
        <text key={d} x={x(i)} y={236} textAnchor="middle">{d}</text>
      ))}
      <polyline points={line(sales)} fill="none" stroke="#3ddc84" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={line(spend)} fill="none" stroke="#4c8dff" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {sales.map((v, i) => (
        <circle key={"s" + i} cx={x(i)} cy={y(v)} r={4} fill="#3ddc84" stroke="#141821" strokeWidth={2}>
          <title>{`${DAYS_[i]} ยอดขาย ${baht(v)}`}</title>
        </circle>
      ))}
      {spend.map((v, i) => (
        <circle key={"p" + i} cx={x(i)} cy={y(v)} r={4} fill="#4c8dff" stroke="#141821" strokeWidth={2}>
          <title>{`${DAYS_[i]} ค่าโฆษณา ${baht(v)}`}</title>
        </circle>
      ))}
    </svg>
  );
}
