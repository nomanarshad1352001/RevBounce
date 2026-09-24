"use client";
// RevBounce — bespoke SVG data-viz (no chart dependency)
import React, { useMemo, useState } from "react";

/* ── Smooth area / line chart with hover crosshair ─────────── */
export function AreaChart({
  data, height = 240, color = "#d9b380", format = (v: number) => `${v}`, label = "",
}: {
  data: { day: string; value: number }[];
  height?: number; color?: string;
  format?: (v: number) => string; label?: string;
}) {
  const w = 720, pad = { t: 14, r: 10, b: 22, l: 10 };
  const [hover, setHover] = useState<number | null>(null);

  const { path, area, pts, max } = useMemo(() => {
    const max = Math.max(...data.map((d) => d.value), 1);
    const innerW = w - pad.l - pad.r, innerH = height - pad.t - pad.b;
    const pts = data.map((d, i) => ({
      x: pad.l + (i / (data.length - 1)) * innerW,
      y: pad.t + innerH - (d.value / max) * innerH,
      ...d,
    }));
    // Catmull-Rom → bezier smoothing
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
    const area = `${path} L ${pts[pts.length - 1].x} ${height - pad.b} L ${pts[0].x} ${height - pad.b} Z`;
    return { path, area, pts, max };
  }, [data, height]);

  const gid = useMemo(() => `g${Math.random().toString(36).slice(2, 7)}`, []);

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * w;
          let best = 0, bd = Infinity;
          pts.forEach((p, i) => { const d = Math.abs(p.x - x); if (d < bd) { bd = d; best = i; } });
          setHover(best);
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.34" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={pad.l} x2={w - pad.r} y1={pad.t + (height - pad.t - pad.b) * f} y2={pad.t + (height - pad.t - pad.b) * f} stroke="rgba(232,211,168,.07)" strokeDasharray="3 6" />
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        {hover !== null && pts[hover] && (
          <g>
            <line x1={pts[hover].x} x2={pts[hover].x} y1={pad.t} y2={height - pad.b} stroke={color} strokeOpacity="0.45" />
            <circle cx={pts[hover].x} cy={pts[hover].y} r="5" fill="#0c0a13" stroke={color} strokeWidth="2.4" />
          </g>
        )}
        {pts.filter((_, i) => i % Math.ceil(pts.length / 6) === 0).map((p, i) => (
          <text key={i} x={p.x} y={height - 4} textAnchor="middle" fontSize="10" fill="#5d5867">{p.day}</text>
        ))}
      </svg>
      {hover !== null && pts[hover] && (
        <div
          className="absolute pointer-events-none glass rounded-lg px-3 py-2 text-xs whitespace-nowrap z-10"
          style={{ left: `${(pts[hover].x / w) * 100}%`, top: 0, transform: `translateX(${hover > data.length * 0.7 ? "-110%" : "10px"})` }}
        >
          <p className="text-[10px] uppercase tracking-widest text-[#97919f]">{pts[hover].day}{label ? ` · ${label}` : ""}</p>
          <p className="font-semibold text-[#f0d9ae] text-sm">{format(pts[hover].value)}</p>
        </div>
      )}
      <span className="absolute right-2 bottom-5 text-[10px] text-[#5d5867]">peak {format(max)}</span>
    </div>
  );
}

/* ── Bar chart ─────────────────────────────────────────────── */
export function BarChart({ data, height = 200, color = "#d9b380", format = (v: number) => `${v}` }: {
  data: { day: string; value: number }[]; height?: number; color?: string; format?: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="w-full">
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="relative flex-1 group" style={{ height: "100%" }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div className="absolute bottom-0 left-0 right-0 rounded-t-[3px] transition-all duration-300"
              style={{
                height: `${(d.value / max) * 100}%`,
                background: hover === i ? `linear-gradient(180deg, #f0d9ae, ${color})` : `${color}55`,
                boxShadow: hover === i ? "0 0 18px rgba(217,179,128,.35)" : "none",
              }} />
            {hover === i && (
              <div className="absolute -top-11 left-1/2 -translate-x-1/2 glass rounded-md px-2 py-1 text-[10px] whitespace-nowrap z-10">
                <span className="text-[#f0d9ae] font-semibold">{format(d.value)}</span>
                <span className="text-[#97919f] ml-1">{d.day}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-[#5d5867]">
        <span>{data[0]?.day}</span><span>{data[Math.floor(data.length / 2)]?.day}</span><span>{data[data.length - 1]?.day}</span>
      </div>
    </div>
  );
}

/* ── Donut ─────────────────────────────────────────────────── */
export function Donut({ slices, size = 190 }: { slices: { label: string; value: number; color: string }[]; size?: number }) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const r = 44, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox="0 0 120 120" className="-rotate-90 flex-none">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#1c1827" strokeWidth="13" />
        {slices.map((s, i) => {
          const frac = s.value / total;
          const el = (
            <circle key={i} cx="60" cy="60" r={r} fill="none" stroke={s.color} strokeWidth="13"
              strokeDasharray={`${frac * c} ${c}`} strokeDashoffset={-acc * c} strokeLinecap="butt"
              style={{ transition: "stroke-dasharray .8s ease" }} />
          );
          acc += frac;
          return el;
        })}
        <text x="60" y="57" textAnchor="middle" fontSize="17" fill="#f2ecdf" fontWeight="600" transform="rotate(90 60 60)">
          {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total}
        </text>
        <text x="60" y="72" textAnchor="middle" fontSize="8.5" fill="#97919f" transform="rotate(90 60 60)">total</text>
      </svg>
      <div className="space-y-2 min-w-0">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-[4px] flex-none" style={{ background: s.color }} />
            <span className="text-[#c9c4b8] truncate">{s.label}</span>
            <span className="ml-auto pl-4 text-[#97919f] tabular-nums">{Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Sparkline ─────────────────────────────────────────────── */
export function Spark({ data, color = "#8fe3b0", width = 96, height = 30 }: { data: number[]; color?: string; width?: number; height?: number }) {
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - 3 - ((v - min) / (max - min || 1)) * (height - 6)}`).join(" ");
  return (
    <svg width={width} height={height} className="flex-none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
