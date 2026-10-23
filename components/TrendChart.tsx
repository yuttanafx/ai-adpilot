import { DAYS } from "@/lib/data";

const X0 = 72;
const X1 = 764;
const Y_TOP = 16;
const Y_BOT = 210;

const short = (v: number) => (v >= 1000 ? "฿" + Math.round(v / 1000) + "k" : "฿" + v);
const baht = (v: number) => "฿" + Math.round(v).toLocaleString("en-US");

export default function TrendChart({ spend, sales }: { spend: number[]; sales: number[] }) {
  const top = Math.ceil(Math.max(...sales) / 4 / 5000) * 5000 * 4;
  const x = (i: number) => Math.round(X0 + (i * (X1 - X0)) / (DAYS.length - 1));
  const y = (v: number) => Math.round(Y_BOT - (v / top) * (Y_BOT - Y_TOP));
  const line = (arr: number[]) => arr.map((v, i) => `${x(i)},${y(v)}`).join(" ");

  return (
    <svg
      className="chart"
      viewBox="0 0 800 250"
      role="img"
      aria-label={`Daily spend and sales in baht, ${DAYS[0]} to ${DAYS[DAYS.length - 1]}. Sales peak at ${baht(Math.max(...sales))}.`}
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
      {DAYS.map((d, i) => (
        <text key={d} x={x(i)} y={236} textAnchor="middle">{d}</text>
      ))}
      <polyline points={line(sales)} fill="none" stroke="#3ddc84" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={line(spend)} fill="none" stroke="#4c8dff" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {sales.map((v, i) => (
        <circle key={"s" + i} cx={x(i)} cy={y(v)} r={4} fill="#3ddc84" stroke="#141821" strokeWidth={2}>
          <title>{`${DAYS[i]} sales ${baht(v)}`}</title>
        </circle>
      ))}
      {spend.map((v, i) => (
        <circle key={"p" + i} cx={x(i)} cy={y(v)} r={4} fill="#4c8dff" stroke="#141821" strokeWidth={2}>
          <title>{`${DAYS[i]} spend ${baht(v)}`}</title>
        </circle>
      ))}
    </svg>
  );
}
