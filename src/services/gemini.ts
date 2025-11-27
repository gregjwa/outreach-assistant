import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Profile } from "../types";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

const modelName = process.env.GEMINI_MODEL || "gemini-1.5-pro";

const getSystemPrompt = (): string => {
  try {
    const promptPath = path.resolve(process.cwd(), "system_prompt.txt");
    if (fs.existsSync(promptPath)) {
      return fs.readFileSync(promptPath, "utf-8");
    }
  } catch (error) {
    console.warn("Could not read system_prompt.txt, falling back to default.");
  }
  
  // Fallback default (kept for safety)
  return `You are an experienced founder doing qualitative market research... (fallback)`; 
};

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    icpScore: { type: SchemaType.NUMBER },
    icpReason: { type: SchemaType.STRING },
    icpLearning: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    message: { type: SchemaType.STRING, nullable: true },
  },
  required: ["icpScore", "icpReason", "icpLearning"],
};

interface GeminiResponse {
  icpScore: number;
  icpReason: string;
  icpLearning: string[];
  message?: string | null;
}

export const generateMessage = async (
  profile: Profile,
  thesis: string,
  icpDescription: string
): Promise<GeminiResponse> => {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const systemPrompt = getSystemPrompt();

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      // @ts-ignore - thinkingConfig is new in v3 and might not be in types yet
      thinkingConfig: {
        thinkingLevel: "low",
      },
    },
  });

  if (!profile.firstName && profile.name) {
    profile.firstName = profile.name.split(" ")[0];
  }

  const profileJson = JSON.stringify(profile, null, 2);

  const userPrompt = `
ICP Description:
${icpDescription}

Research Thesis:
${thesis}

Target Profile JSON:
${profileJson}
`;

  try {
    const result = await model.generateContent(userPrompt);
    const response = await result.response;
    const text = response.text();
    
    try {
        const data = JSON.parse(text) as GeminiResponse;
        return data;
    } catch (parseError) {
        console.error("Failed to parse JSON response:", text);
        throw new Error("Invalid JSON response from Gemini");
    }

  } catch (error) {
    console.error("Error calling Gemini:", error);
    throw error;
  }
};
