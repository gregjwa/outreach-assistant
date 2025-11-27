import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Profile } from "./types";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { generateMessageGemini } from "./services/gemini";
import { generateMessageOpenAI } from "./services/openai";

dotenv.config();

export interface GenerationResponse {
  icpScore: number;
  icpReason: string;
  icpLearning: string[];
  message?: string | null;
}

export const generateMessage = async (
  profile: Profile,
  thesis: string,
  icpDescription: string
): Promise<GenerationResponse> => {
  const provider = process.env.LLM_PROVIDER || "gemini";

  if (provider === "openai") {
    return generateMessageOpenAI(profile, thesis, icpDescription);
  } else {
    return generateMessageGemini(profile, thesis, icpDescription);
  }
};

