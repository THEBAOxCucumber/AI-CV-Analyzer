import { GoogleGenAI } from "@google/genai";

import { env } from "./env.js";

export const gemini = new GoogleGenAI({
  apiKey: env.gemini.apiKey,
});