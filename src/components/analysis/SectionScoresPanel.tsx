import {
  RadarChart,
  type RadarAxis,
} from "../charts/RadarChart"

import {
  SCORE_LEVEL_LABEL,
  type SectionScore,
} from "../../utils/section-scores"

import "../../styles/components/SectionScores.css"

export function SectionScoresPanel({
  sections,
}: {
  sections: SectionScore[]
}) {
  const axes: RadarAxis[] = sections.map(
    (section) => ({
      key: section.key,
      label: section.labelTh,
      sublabel: `${section.score}/${section.maxScore}`,
      value: section.percent / 100,
      tooltip: `${section.labelTh} · ${section.score}/${section.maxScore} (${section.percent}%) · ${SCORE_LEVEL_LABEL[section.level]}`,
      detail: section.description,
    }),
  )

  const chartLabel =
    `กราฟเรดาร์คะแนน ${sections.length} หมวด (% ของคะแนนเต็ม): ` +
    sections
      .map(
        (section) =>
          `${section.labelTh} ${section.score}/${section.maxScore}`,
      )
      .join(", ")

  return (
    <figure className="section-scores-chart">
      <RadarChart
        axes={axes}
        ariaLabel={chartLabel}
      />

      <figcaption>
        แต่ละแกนคือ % ของคะแนนเต็มหมวดนั้น
        ยิ่งใกล้ขอบนอก ยิ่งดี
      </figcaption>
    </figure>
  )
}
