import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

/*
 * ทดสอบเส้นทาง Ollama (ไม่เรียกเครือข่ายจริง) — env ถูกแทนด้วยค่าทดสอบ
 */
const { mockEmbed, mockEnv } = vi.hoisted(() => ({
  mockEmbed: vi.fn(),
  mockEnv: {
    embedding: {
      provider: "ollama",
      model: "qwen3-embedding:0.6b",
      dimensions: 4,
      batchSize: 20,
      ollamaNumGpu: 0,
    },
    ollama: {
      host: "http://127.0.0.1:11434",
      keepAlive: "30m",
    },
  },
}));

vi.mock("ollama", () => ({
  Ollama: class {
    embed = mockEmbed;
  },
}));

vi.mock("../../src/config/env.js", () => ({ env: mockEnv }));
vi.mock("../../src/config/gemini.js", () => ({ gemini: {} }));

import {
  createDocumentEmbeddings,
  createQueryEmbedding,
} from "../../src/modules/embedding/embedding-provider.service.js";

beforeEach(() => {
  mockEmbed.mockReset();
  mockEnv.embedding.provider = "ollama";
});

describe("Ollama embeddings", () => {
  it("embeds documents as-is on the CPU and returns model + dimensions", async () => {
    mockEmbed.mockResolvedValue({ embeddings: [[1, 2, 3, 4], [5, 6, 7, 8]] });

    const results = await createDocumentEmbeddings(["  ประสบการณ์ Node.js ", "SQL"]);

    expect(mockEmbed).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "qwen3-embedding:0.6b",
        input: ["ประสบการณ์ Node.js", "SQL"],
        truncate: true,
        keep_alive: "30m",
        options: { num_gpu: 0 },
      }),
    );
    expect(results).toEqual([
      { embedding: [1, 2, 3, 4], model: "qwen3-embedding:0.6b", dimensions: 4 },
      { embedding: [5, 6, 7, 8], model: "qwen3-embedding:0.6b", dimensions: 4 },
    ]);
  });

  it("prefixes queries with the retrieval instruction", async () => {
    mockEmbed.mockResolvedValue({ embeddings: [[0, 0, 0, 1]] });

    await createQueryEmbedding("มีประสบการณ์ Docker ไหม");

    const input = mockEmbed.mock.calls[0][0].input as string[];
    expect(input[0]).toMatch(/^Instruct: .+\nQuery: มีประสบการณ์ Docker ไหม$/);
  });

  it("rejects vectors whose size does not match EMBEDDING_DIMENSIONS", async () => {
    mockEmbed.mockResolvedValue({ embeddings: [[1, 2, 3]] });

    await expect(createDocumentEmbeddings(["x"])).rejects.toMatchObject({
      code: "EMBEDDING_DIMENSION_MISMATCH",
    });
  });

  it("explains how to fix a missing model", async () => {
    mockEmbed.mockRejectedValue(new Error('model "qwen3-embedding:0.6b" not found, try pulling it first'));

    await expect(createDocumentEmbeddings(["x"])).rejects.toMatchObject({
      code: "EMBEDDING_MODEL_NOT_FOUND",
      message: expect.stringContaining("ollama pull qwen3-embedding:0.6b"),
    });
  });

  it("reports other Ollama failures as EMBEDDING_API_FAILED", async () => {
    mockEmbed.mockRejectedValue(new Error("fetch failed"));

    await expect(createDocumentEmbeddings(["x"])).rejects.toMatchObject({
      code: "EMBEDDING_API_FAILED",
    });
  });

  it("rejects an unknown provider", async () => {
    mockEnv.embedding.provider = "openai";

    await expect(createDocumentEmbeddings(["x"])).rejects.toMatchObject({
      code: "EMBEDDING_PROVIDER_UNSUPPORTED",
    });
    expect(mockEmbed).not.toHaveBeenCalled();
  });
});
