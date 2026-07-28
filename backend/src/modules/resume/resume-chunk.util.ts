import type {
  ChunkOptions,
  GeneratedResumeChunk,
  ResumeSection,
} from "./resume-chunk.types.js";

interface SectionBlock {
  section: ResumeSection;
  content: string;
}

const DEFAULT_MAX_CHARACTERS = 1200;
const DEFAULT_OVERLAP_CHARACTERS = 200;

const sectionPatterns: Array<{
  section: ResumeSection;
  patterns: RegExp[];
}> = [
  {
    section: "SUMMARY",
    patterns: [
      /^summary$/i,
      /^profile$/i,
      /^professional summary$/i,
      /^career objective$/i,
      /^objective$/i,
      /^เกี่ยวกับฉัน$/,
      /^สรุปประวัติ$/,
      /^เป้าหมายการทำงาน$/,
    ],
  },
  {
    section: "CONTACT",
    patterns: [
      /^contact$/i,
      /^contact information$/i,
      /^personal information$/i,
      /^ข้อมูลติดต่อ$/,
      /^ข้อมูลส่วนตัว$/,
    ],
  },
  {
    section: "SKILLS",
    patterns: [
      /^skills?$/i,
      /^technical skills?$/i,
      /^core competencies$/i,
      /^technologies$/i,
      /^ทักษะ$/,
      /^ทักษะทางเทคนิค$/,
      /^ความสามารถ$/,
    ],
  },
  {
    section: "EDUCATION",
    patterns: [
      /^education$/i,
      /^academic background$/i,
      /^educational background$/i,
      /^การศึกษา$/,
      /^ประวัติการศึกษา$/,
    ],
  },
  {
    section: "EXPERIENCE",
    patterns: [
      /^experience$/i,
      /^work experience$/i,
      /^employment history$/i,
      /^professional experience$/i,
      /^internship experience$/i,
      /^ประสบการณ์$/,
      /^ประสบการณ์ทำงาน$/,
      /^ประสบการณ์ฝึกงาน$/,
    ],
  },
  {
    section: "PROJECTS",
    patterns: [
      /^projects?$/i,
      /^personal projects?$/i,
      /^academic projects?$/i,
      /^selected projects?$/i,
      /^ผลงาน$/,
      /^โครงงาน$/,
      /^โปรเจกต์$/,
    ],
  },
  {
    section: "CERTIFICATIONS",
    patterns: [
      /^certifications?$/i,
      /^certificates?$/i,
      /^licenses?$/i,
      /^ใบรับรอง$/,
      /^ประกาศนียบัตร$/,
    ],
  },
  {
    section: "LANGUAGES",
    patterns: [
      /^languages?$/i,
      /^language proficiency$/i,
      /^ภาษา$/,
      /^ทักษะภาษา$/,
    ],
  },
  {
    section: "ACTIVITIES",
    patterns: [
      /^activities$/i,
      /^extracurricular activities$/i,
      /^volunteer experience$/i,
      /^awards?$/i,
      /^กิจกรรม$/,
      /^กิจกรรมนอกหลักสูตร$/,
      /^รางวัล$/,
    ],
  },
];

function normalizeLine(line: string): string {
  return line
    .trim()
    .replace(/[:：\-–—]+$/, "")
    .trim();
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function detectSection(
  line: string,
): ResumeSection | null {
  const normalizedLine = normalizeLine(line);

  if (
    normalizedLine.length === 0 ||
    normalizedLine.length > 60
  ) {
    return null;
  }

  for (const definition of sectionPatterns) {
    const matched = definition.patterns.some(
      (pattern) => pattern.test(normalizedLine),
    );

    if (matched) {
      return definition.section;
    }
  }

  return null;
}

export function splitResumeIntoSections(
  text: string,
): SectionBlock[] {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return [];
  }

  const lines = normalizedText.split("\n");

  const sections: SectionBlock[] = [];

  let currentSection: ResumeSection = "GENERAL";
  let currentLines: string[] = [];

  const flushCurrentSection = (): void => {
    const content = currentLines
      .join("\n")
      .trim();

    if (content) {
      sections.push({
        section: currentSection,
        content,
      });
    }

    currentLines = [];
  };

  for (const line of lines) {
    const detectedSection = detectSection(line);

    if (detectedSection) {
      flushCurrentSection();
      currentSection = detectedSection;
      continue;
    }

    currentLines.push(line);
  }

  flushCurrentSection();

  return sections;
}

function splitLongParagraph(
  paragraph: string,
  maxCharacters: number,
): string[] {
  const sentences = paragraph
    .split(/(?<=[.!?。！？])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    const parts: string[] = [];

    for (
      let index = 0;
      index < paragraph.length;
      index += maxCharacters
    ) {
      parts.push(
        paragraph.slice(
          index,
          index + maxCharacters,
        ),
      );
    }

    return parts;
  }

  const parts: string[] = [];
  let currentPart = "";

  for (const sentence of sentences) {
    const candidate = currentPart
      ? `${currentPart} ${sentence}`
      : sentence;

    if (
      candidate.length <= maxCharacters ||
      currentPart.length === 0
    ) {
      currentPart = candidate;
      continue;
    }

    parts.push(currentPart.trim());
    currentPart = sentence;
  }

  if (currentPart.trim()) {
    parts.push(currentPart.trim());
  }

  return parts;
}

function splitSectionContent(
  content: string,
  maxCharacters: number,
): string[] {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxCharacters) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }

      chunks.push(
        ...splitLongParagraph(
          paragraph,
          maxCharacters,
        ),
      );

      continue;
    }

    const candidate = currentChunk
      ? `${currentChunk}\n\n${paragraph}`
      : paragraph;

    if (candidate.length <= maxCharacters) {
      currentChunk = candidate;
      continue;
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    currentChunk = paragraph;
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

function createOverlap(
  previousChunk: string,
  overlapCharacters: number,
): string {
  if (
    overlapCharacters <= 0 ||
    previousChunk.length <= overlapCharacters
  ) {
    return previousChunk;
  }

  const overlapText = previousChunk.slice(
    previousChunk.length - overlapCharacters,
  );

  const firstSpaceIndex =
    overlapText.indexOf(" ");

  if (firstSpaceIndex === -1) {
    return overlapText;
  }

  return overlapText
    .slice(firstSpaceIndex + 1)
    .trim();
}

function addOverlapToChunks(
  chunks: string[],
  maxCharacters: number,
  overlapCharacters: number,
): string[] {
  if (
    chunks.length <= 1 ||
    overlapCharacters <= 0
  ) {
    return chunks;
  }

  return chunks.map((chunk, index) => {
    if (index === 0) {
      return chunk;
    }

    const previousChunk = chunks[index - 1];

    if (!previousChunk) {
      return chunk;
    }

    const overlap = createOverlap(
      previousChunk,
      overlapCharacters,
    );

    if (!overlap) {
      return chunk;
    }

    const separator = "\n\n";

    const availableLength =
      maxCharacters -
      overlap.length -
      separator.length;

    if (availableLength <= 0) {
      return chunk;
    }

    const trimmedChunk = chunk
      .slice(0, availableLength)
      .trim();

    return `${overlap}${separator}${trimmedChunk}`;
  });
}

export function generateResumeChunks(
  text: string,
  options: ChunkOptions = {},
): GeneratedResumeChunk[] {
  const maxCharacters =
    options.maxCharacters ??
    DEFAULT_MAX_CHARACTERS;

  const overlapCharacters =
    options.overlapCharacters ??
    DEFAULT_OVERLAP_CHARACTERS;

  if (maxCharacters < 200) {
    throw new Error(
      "maxCharacters ต้องมีค่าอย่างน้อย 200",
    );
  }

  if (
    overlapCharacters < 0 ||
    overlapCharacters >= maxCharacters
  ) {
    throw new Error(
      "overlapCharacters ต้องน้อยกว่า maxCharacters",
    );
  }

  const sectionBlocks =
    splitResumeIntoSections(text);

  const generatedChunks: GeneratedResumeChunk[] =
    [];

  let globalChunkIndex = 0;

  for (const block of sectionBlocks) {
    const sectionChunks = splitSectionContent(
      block.content,
      maxCharacters,
    );

    const chunksWithOverlap = addOverlapToChunks(
      sectionChunks,
      maxCharacters,
      overlapCharacters,
    );

    for (const content of chunksWithOverlap) {
      const normalizedContent = content.trim();

      if (!normalizedContent) {
        continue;
      }

      generatedChunks.push({
        section: block.section,
        chunkIndex: globalChunkIndex,
        content: normalizedContent,
        characterCount:
          normalizedContent.length,
      });

      globalChunkIndex += 1;
    }
  }

  return generatedChunks;
}