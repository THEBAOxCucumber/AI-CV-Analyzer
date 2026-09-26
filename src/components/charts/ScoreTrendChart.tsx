import {
  useState,
} from "react"

import "../../styles/components/ScoreTrendChart.css"

export interface TrendPoint {
  id: number
  label: string
  value: number
  tooltip: string
}

interface ScoreTrendChartProps {
  points: TrendPoint[]
  ariaLabel: string
  max?: number
}

const WIDTH = 720
const HEIGHT = 260
const PADDING = {
  top: 24,
  right: 40,
  bottom: 36,
  left: 40,
}
const GRID_STEPS = [0, 0.25, 0.5, 0.75, 1]

/*
 * กราฟเส้นคะแนนตามเวลา
 * แกน y คงที่ 0–max ไม่ย่อแกนให้ดูชันเกินจริง
 */
export function ScoreTrendChart({
  points,
  ariaLabel,
  max = 100,
}: ScoreTrendChartProps) {
  const [activeIndex, setActiveIndex] =
    useState<number | null>(null)

  const plotWidth =
    WIDTH - PADDING.left - PADDING.right

  const plotHeight =
    HEIGHT - PADDING.top - PADDING.bottom

  const stepX =
    points.length > 1
      ? plotWidth / (points.length - 1)
      : 0

  const toX = (index: number) =>
    points.length > 1
      ? PADDING.left + index * stepX
      : PADDING.left + plotWidth / 2

  const toY = (value: number) =>
    PADDING.top +
    plotHeight *
      (1 - Math.min(max, Math.max(0, value)) / max)

  const coords = points.map((point, index) => ({
    x: toX(index),
    y: toY(point.value),
  }))

  const linePath = coords
    .map(
      (coord, index) =>
        `${index === 0 ? "M" : "L"}${coord.x.toFixed(1)},${coord.y.toFixed(1)}`,
    )
    .join(" ")

  const baselineY = PADDING.top + plotHeight

  const areaPath =
    coords.length > 1
      ? `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${baselineY} L${coords[0].x.toFixed(1)},${baselineY} Z`
      : ""

  /*
   * พื้นที่ hover: แถบเต็มความสูงรอบแต่ละจุด
   */
  const hitWidth =
    points.length > 1
      ? stepX
      : plotWidth

  const lastIndex = points.length - 1
  const active =
    activeIndex !== null
      ? coords[activeIndex]
      : null

  return (
    <div className="trend-chart">
      <svg
        className="trend-chart__svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="group"
        aria-label={ariaLabel}
      >
        <g aria-hidden="true">
          {GRID_STEPS.map((step) => {
            const y = toY(max * step)

            return (
              <g key={step}>
                <line
                  className="trend-chart__grid"
                  x1={PADDING.left}
                  x2={WIDTH - PADDING.right}
                  y1={y}
                  y2={y}
                />

                <text
                  className="trend-chart__axis-label"
                  x={PADDING.left - 10}
                  y={y + 4}
                  textAnchor="end"
                >
                  {max * step}
                </text>
              </g>
            )
          })}

          {points.map((point, index) => (
            <text
              key={point.id}
              className="trend-chart__axis-label"
              x={coords[index].x}
              y={HEIGHT - 10}
              textAnchor="middle"
            >
              {point.label}
            </text>
          ))}

          {areaPath && (
            <path
              className="trend-chart__area"
              d={areaPath}
            />
          )}

          {coords.length > 1 && (
            <path
              className="trend-chart__line"
              d={linePath}
            />
          )}

          {active && (
            <line
              className="trend-chart__crosshair"
              x1={active.x}
              x2={active.x}
              y1={PADDING.top}
              y2={baselineY}
            />
          )}

          {coords.map((coord, index) => (
            <circle
              key={points[index].id}
              className={
                index === activeIndex
                  ? "trend-chart__dot trend-chart__dot--active"
                  : "trend-chart__dot"
              }
              cx={coord.x}
              cy={coord.y}
              r={4.5}
            />
          ))}

          {/*
            * ป้ายตัวเลขเฉพาะจุดล่าสุด
            */}
          {lastIndex >= 0 && activeIndex === null && (
            <text
              className="trend-chart__value-label"
              x={coords[lastIndex].x}
              y={coords[lastIndex].y - 12}
              textAnchor="middle"
            >
              {points[lastIndex].value}
            </text>
          )}
        </g>

        {coords.map((coord, index) => (
          <rect
            key={points[index].id}
            className="trend-chart__hit"
            x={coord.x - hitWidth / 2}
            y={PADDING.top}
            width={hitWidth}
            height={plotHeight}
            role="img"
            tabIndex={0}
            aria-label={points[index].tooltip}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex(index)}
            onBlur={() => setActiveIndex(null)}
          />
        ))}
      </svg>

      {active && activeIndex !== null && (
        <div
          className="trend-chart__tooltip"
          aria-hidden="true"
          style={{
            left: `${(active.x / WIDTH) * 100}%`,
            top: `${(active.y / HEIGHT) * 100}%`,
          }}
        >
          {points[activeIndex].tooltip}
        </div>
      )}
    </div>
  )
}
