"use client";

import { useId, useState } from "react";

export interface BarChartDatum {
  label: string;
  value: number;
}

const MUTED = "#898781"; // axis/gridline ink, one step off the white surface
const BASELINE = "#c3c2b7";
const TEXT_SECONDARY = "#52514e";
const MAX_BAR_THICKNESS = 24;
const CORNER_RADIUS = 4;

/** Top-rounded, bottom-square bar path — SVG <rect> has no per-corner radius. */
function roundedTopRectPath(x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height);
  if (height <= 0) return "";
  return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
}

export function BarChart({
  title,
  data,
  color = "var(--color-chart-gold)",
  height = 180,
  formatValue = (v: number) => String(v),
}: {
  title: string;
  data: BarChartDatum[];
  color?: string;
  height?: number;
  formatValue?: (value: number) => string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const tableId = useId();

  const width = 600;
  const padding = { top: 24, right: 8, bottom: 28, left: 8 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...data.map((d) => d.value));

  const slotWidth = data.length > 0 ? plotWidth / data.length : plotWidth;
  const barWidth = Math.min(MAX_BAR_THICKNESS, slotWidth - 8);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-teal-700">
        No data for this period.
      </div>
    );
  }

  const hovered = hoverIndex != null ? data[hoverIndex] : null;
  const hoveredSlotCenterPct =
    hoverIndex != null ? ((hoverIndex + 0.5) * slotWidth + padding.left) / width : 0;

  return (
    <div className="relative">
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-teal-900 px-2.5 py-1.5 text-xs text-white shadow-md"
          style={{ left: `${hoveredSlotCenterPct * 100}%`, top: 4 }}
        >
          <span className="font-semibold">{formatValue(hovered.value)}</span>
          <span className="ml-1.5 text-teal-50/70">{hovered.label}</span>
        </div>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby={`${tableId}-title`}
        className="w-full"
        style={{ maxHeight: height }}
      >
        <title id={`${tableId}-title`}>{title}</title>

        {/* baseline */}
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke={BASELINE}
          strokeWidth={1}
        />

        {data.map((d, i) => {
          const slotX = padding.left + i * slotWidth;
          const barX = slotX + (slotWidth - barWidth) / 2;
          const barHeight = maxValue > 0 ? (d.value / maxValue) * plotHeight : 0;
          const barY = height - padding.bottom - barHeight;
          const isHovered = hoverIndex === i;
          const valueLabel = formatValue(d.value);
          const labelFitsAbove = barY - 4 >= padding.top - 8;

          return (
            <g
              key={d.label}
              tabIndex={0}
              role="graphics-symbol"
              aria-label={`${d.label}: ${valueLabel}`}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              onFocus={() => setHoverIndex(i)}
              onBlur={() => setHoverIndex(null)}
              style={{ cursor: "pointer", outline: "none" }}
            >
              {/* transparent full-slot hit target, bigger than the bar itself */}
              <rect
                x={slotX}
                y={padding.top - 8}
                width={slotWidth}
                height={plotHeight + 8}
                fill="transparent"
              />
              <title>{`${d.label}: ${valueLabel}`}</title>
              <path
                d={roundedTopRectPath(barX, barY, barWidth, barHeight, CORNER_RADIUS)}
                fill={color}
                opacity={isHovered ? 1 : 0.85}
              />
              {labelFitsAbove && (
                <text
                  x={barX + barWidth / 2}
                  y={barY - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fill={TEXT_SECONDARY}
                >
                  {valueLabel}
                </text>
              )}
              <text
                x={slotX + slotWidth / 2}
                y={height - padding.bottom + 16}
                textAnchor="middle"
                fontSize={11}
                fill={MUTED}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Accessible/no-JS data table — same values, always reachable without hovering. */}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Category</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{d.label}</td>
              <td>{formatValue(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
