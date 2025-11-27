import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Profile } from "./types";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { generateMessageGemini } from "./services/gemini";
import { generateMessageOpenAI } from "./services/openai";

dotenv.config();

// In-memory config store (resets on restart, which is expected behavior for "ephemeral" changes)
// We initialize it with the env var.
let currentProvider = process.env.LLM_PROVIDER || "gemini";

export const setProvider = (provider: string) => {
  if (provider === "openai" || provider === "gemini") {
    currentProvider = provider;
    console.log(`Switched LLM provider to: ${currentProvider}`);
  } else {
    throw new Error("Invalid provider");
  }
};

export const getProvider = () => currentProvider;

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
  // Use the dynamic provider
  if (currentProvider === "openai") {
    return generateMessageOpenAI(profile, thesis, icpDescription);
  } else {
    return generateMessageGemini(profile, thesis, icpDescription);
  }
};
