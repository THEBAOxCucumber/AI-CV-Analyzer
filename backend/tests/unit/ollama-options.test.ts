import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  buildOllamaOptions,
  contextSizeFor,
  isGpuMemoryError,
  withGpuFallback,
} from "../../src/modules/analysis/ollama-options.js";

const limits = { minContext: 3072, maxContext: 8192 };

describe("contextSizeFor", () => {
  it("uses the minimum for a short prompt (measured: 3,780 chars ≈ 1,484 tokens)", () => {
    expect(contextSizeFor(3780, limits)).toBe(4096);
    expect(contextSizeFor(500, limits)).toBe(3072);
  });

  it("grows in 1024 steps so a long resume is not truncated", () => {
    // 9,000 ตัวอักษร ≈ 4,500 token + คำตอบ 1,536 → 6,036 → 6,144
    expect(contextSizeFor(9000, limits)).toBe(6144);
  });

  it("never exceeds the maximum", () => {
    expect(contextSizeFor(100_000, limits)).toBe(8192);
  });
});

describe("buildOllamaOptions", () => {
  it("sets num_gpu only when configured", () => {
    expect(buildOllamaOptions(3780, { ...limits, numGpu: null })).toEqual({
      temperature: 0.1,
      num_ctx: 4096,
    });

    expect(buildOllamaOptions(3780, { ...limits, numGpu: 99 })).toEqual({
      temperature: 0.1,
      num_ctx: 4096,
      num_gpu: 99,
    });
  });
});

describe("isGpuMemoryError", () => {
  it.each([
    "llama runner process has terminated: cudaMalloc failed: out of memory",
    "model requires more system memory (5.1 GiB) than is available (3.9 GiB)",
    "ggml_backend_cuda_buffer_type_alloc_buffer: failed to allocate CUDA0 buffer",
    // ข้อความจริงจาก Ollama 0.40 (num_gpu 99 + num_ctx 40960 บน GPU 4GB)
    "ggml_backend_buft_alloc_buffer_n_default: failed to allocate CUDA0 buffer of size 6039797760\nllama_init_from_model: failed to initialize the context: failed to allocate buffer for kv cache",
  ])("detects: %s", (message) => {
    expect(isGpuMemoryError(new Error(message))).toBe(true);
  });

  it.each([
    "fetch failed",
    "The operation was aborted due to timeout",
    'model "qwen3:4b-instruct" not found',
  ])("ignores: %s", (message) => {
    expect(isGpuMemoryError(new Error(message))).toBe(false);
  });
});

describe("withGpuFallback", () => {
  const oom = new Error("failed to allocate buffer for kv cache");

  it("retries once with automatic offload when forced GPU runs out of memory", async () => {
    const calls: Array<number | null> = [];
    const onFallback = vi.fn();

    const result = await withGpuFallback(
      99,
      async (numGpu) => {
        calls.push(numGpu);
        if (numGpu !== null) throw oom;
        return "ok";
      },
      onFallback,
    );

    expect(result).toBe("ok");
    expect(calls).toEqual([99, null]);
    expect(onFallback).toHaveBeenCalledOnce();
  });

  it("does not retry other errors (worker decides)", async () => {
    const request = vi.fn(async () => {
      throw new Error("fetch failed");
    });

    await expect(withGpuFallback(99, request)).rejects.toThrow("fetch failed");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("does not retry when num_gpu is not forced", async () => {
    const request = vi.fn(async () => {
      throw oom;
    });

    await expect(withGpuFallback(null, request)).rejects.toThrow(oom.message);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
