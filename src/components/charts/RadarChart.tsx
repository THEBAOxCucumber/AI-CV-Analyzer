import {
  useState,
} from "react"

import "../../styles/components/SectionScores.css"

export interface RadarAxis {
  key: string
  label: string
  sublabel?: string

  /*
   * 0–1 (สัดส่วนของค่าเต็ม)
   */
  value: number
  tooltip: string

  /*
   * บรรทัดที่สองของ tooltip (ไม่บังคับ)
   */
  detail?: string
}

interface RadarChartProps {
  axes: RadarAxis[]
  ariaLabel: string
}

const WIDTH = 440
const HEIGHT = 400
const CENTER_X = WIDTH / 2
const CENTER_Y = 205
const RADIUS = 120
const LABEL_RADIUS = 146
const RINGS = [0.25, 0.5, 0.75, 1]

interface Point {
  x: number
  y: number
  cos: number
  sin: number
}

/*
 * แกนแรกชี้ขึ้น แล้ววนตามเข็มนาฬิกา
 */
function getPoint(
  index: number,
  count: number,
  ratio: number,
): Point {
  const angle =
    -Math.PI / 2 +
    (2 * Math.PI * index) / count

  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  return {
    x: CENTER_X + cos * RADIUS * ratio,
    y: CENTER_Y + sin * RADIUS * ratio,
    cos,
    sin,
  }
}

function toPolygonPoints(
  points: Point[],
): string {
  return points
    .map(
      (point) =>
        `${point.x.toFixed(1)},${point.y.toFixed(1)}`,
    )
    .join(" ")
}

function clampRatio(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function RadarChart({
  axes,
  ariaLabel,
}: RadarChartProps) {
  const [activeIndex, setActiveIndex] =
    useState<number | null>(null)

  const count = axes.length

  const dataPoints = axes.map((axis, index) =>
    getPoint(
      index,
      count,
      clampRatio(axis.value),
    ),
  )

  const activePoint =
    activeIndex !== null
      ? dataPoints[activeIndex]
      : null

  return (
    <div className="radar-chart">
      <svg
        className="radar-chart__svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="group"
        aria-label={ariaLabel}
      >
        <g aria-hidden="true">
          {RINGS.map((ring) => (
            <polygon
              key={ring}
              className="radar-chart__ring"
              points={toPolygonPoints(
                axes.map((_, index) =>
                  getPoint(index, count, ring),
                ),
              )}
            />
          ))}

          {axes.map((axis, index) => {
            const end = getPoint(index, count, 1)

            return (
              <line
                key={axis.key}
                className="radar-chart__spoke"
                x1={CENTER_X}
                y1={CENTER_Y}
                x2={end.x}
                y2={end.y}
              />
            )
          })}

          {[0.5, 1].map((ring) => (
            <text
              key={ring}
              className="radar-chart__ring-label"
              x={CENTER_X + 4}
              y={CENTER_Y - RADIUS * ring + 11}
            >
              {ring * 100}%
            </text>
          ))}

          <polygon
            className="radar-chart__area"
            points={toPolygonPoints(dataPoints)}
          />

          {dataPoints.map((point, index) => (
            <circle
              key={axes[index].key}
              className={
                index === activeIndex
                  ? "radar-chart__dot radar-chart__dot--active"
                  : "radar-chart__dot"
              }
              cx={point.x}
              cy={point.y}
              r={4.5}
            />
          ))}

          {axes.map((axis, index) => {
            const point = getPoint(
              index,
              count,
              LABEL_RADIUS / RADIUS,
            )

            const anchor =
              point.cos > 0.25
                ? "start"
                : point.cos < -0.25
                  ? "end"
                  : "middle"

            /*
             * ป้ายบนสุดยกขึ้น (มี 2 บรรทัด)
             * ป้ายล่างดันลง
             */
            const offsetY =
              point.sin < -0.5
                ? -18
                : point.sin > 0.5
                  ? 12
                  : -4

            return (
              <text
                key={axis.key}
                className="radar-chart__label"
                x={point.x}
                y={point.y + offsetY}
                textAnchor={anchor}
              >
                <tspan>{axis.label}</tspan>

                {axis.sublabel && (
                  <tspan
                    className="radar-chart__sublabel"
                    x={point.x}
                    dy="1.3em"
                  >
                    {axis.sublabel}
                  </tspan>
                )}
              </text>
            )
          })}
        </g>

        {/*
          * พื้นที่ hover/focus ใหญ่กว่าจุด
          */}
        {dataPoints.map((point, index) => (
          <circle
            key={axes[index].key}
            className="radar-chart__hit"
            cx={point.x}
            cy={point.y}
            r={16}
            role="img"
            tabIndex={0}
            aria-label={
              axes[index].detail
                ? `${axes[index].tooltip}. ${axes[index].detail}`
                : axes[index].tooltip
            }
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex(index)}
            onBlur={() => setActiveIndex(null)}
          />
        ))}
      </svg>

      {activePoint && activeIndex !== null && (
        <div
          className="radar-chart__tooltip"
          aria-hidden="true"
          style={{
            left: `${(activePoint.x / WIDTH) * 100}%`,
            top: `${(activePoint.y / HEIGHT) * 100}%`,
          }}
        >
          <strong>
            {axes[activeIndex].tooltip}
          </strong>

          {axes[activeIndex].detail && (
            <span>
              {axes[activeIndex].detail}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
