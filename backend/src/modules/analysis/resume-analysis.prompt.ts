import type {
  CompletedResumeChunk,
} from "../resume/resume-chunk.repository.js";

interface BuildResumeAnalysisPromptInput {
  chunks: CompletedResumeChunk[];
}

function formatResumeChunks(
  chunks: CompletedResumeChunk[],
): string {
  return chunks
    .map((chunk) => {
      return [
        `[CHUNK_ID=${chunk.id}]`,
        `[CHUNK_INDEX=${chunk.chunkIndex}]`,
        `[SECTION=${chunk.section}]`,
        chunk.content,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

export function buildResumeAnalysisPrompt(
  input: BuildResumeAnalysisPromptInput,
): string {
  const context = formatResumeChunks(
    input.chunks,
  );

  return `
คุณเป็นระบบตรวจสอบและให้คะแนน Resume อย่างเป็นกลาง

คุณต้องวิเคราะห์จากข้อความ Resume ที่ให้มาเท่านั้น
ห้ามเดา ห้ามแต่งข้อมูล และห้ามใช้ความรู้ภายนอกมาเติมข้อมูลที่ Resume ไม่ได้ระบุ

เกณฑ์ให้คะแนน:

1. contactInformation คะแนนเต็ม 10
- มีชื่อ
- มีอีเมลหรือช่องทางติดต่อ
- มีข้อมูลสำคัญสำหรับการติดต่อ
- ห้ามเปิดเผยหรือสร้างข้อมูลส่วนตัวใหม่

2. professionalSummary คะแนนเต็ม 10
- มีบทสรุปวิชาชีพที่ชัดเจน
- ระบุทักษะหรือเป้าหมายอาชีพ
- กระชับและเกี่ยวข้องกับสายงาน

3. skills คะแนนเต็ม 15
- มี Technical Skills ที่ชัดเจน
- มีการจัดกลุ่มหรืออธิบายทักษะ
- ทักษะสอดคล้องกับประสบการณ์หรือโครงการ

4. experience คะแนนเต็ม 20
- มีตำแหน่ง หน้าที่ หรือบทบาทที่ชัดเจน
- อธิบายสิ่งที่ลงมือทำ
- มีผลลัพธ์หรือผลกระทบ
- มีตัวเลขหรือหลักฐานเมื่อมีข้อมูล

5. projects คะแนนเต็ม 20
- มีชื่อหรือรายละเอียดโครงการ
- ระบุบทบาทและเทคโนโลยี
- อธิบายปัญหา วิธีแก้ หรือผลลัพธ์
- ห้ามให้คะแนนจากเทคโนโลยีที่ไม่ได้ระบุ

6. education คะแนนเต็ม 10
- มีสถานศึกษา หลักสูตร หรือวุฒิ
- มีข้อมูลที่เพียงพอและอ่านเข้าใจได้

7. readability คะแนนเต็ม 10
- ข้อความเป็นระเบียบ
- แบ่งหัวข้อชัดเจน
- ไม่ซ้ำซ้อนมากเกินไป
- อ่านแล้วเข้าใจหน้าที่และทักษะ

8. jobRelevance คะแนนเต็ม 5
- ทักษะ ประสบการณ์ และโครงการเชื่อมโยงกัน
- มีภาพรวมของสายงานที่ชัดเจน
- หากไม่มี Job Description ให้ประเมินความสอดคล้องภายใน Resume เท่านั้น

กฎของคะแนน:
- overallScore ต้องเท่ากับผลรวมของคะแนนทุกหมวด
- overallScore ต้องอยู่ระหว่าง 0 ถึง 100
- คะแนนต้องเป็นจำนวนเต็ม
- หากไม่มีข้อมูลในหมวดใด ให้ลดคะแนนของหมวดนั้น
- อย่าให้คะแนนจากสิ่งที่คาดเดา
- strengths, weaknesses และ recommendations ต้องอ้างอิงสิ่งที่พบจริง
- ตอบเป็นภาษาไทย
- ห้ามใส่ Markdown ในค่าข้อความ
- ห้ามใส่ JSON ภายใน Markdown code block

Resume Context:

${context}
`.trim();
}