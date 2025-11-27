import OpenAI from "openai";
import { Profile } from "../types";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;
let openai: OpenAI | null = null;

if (apiKey) {
  openai = new OpenAI({ apiKey });
}

const modelName = process.env.OPENAI_MODEL || "gpt-4o";

const getSystemPrompt = (): string => {
  try {
    const promptPath = path.resolve(process.cwd(), "system_prompt.txt");
    if (fs.existsSync(promptPath)) {
      return fs.readFileSync(promptPath, "utf-8");
    }
  } catch (error) {
    console.warn("Could not read system_prompt.txt, falling back to default.");
  }
  return "You are an experienced founder doing qualitative market research...";
};

interface OpenAIResponse {
  icpScore: number;
  icpReason: string;
  icpLearning: string[];
  message?: string | null;
}

export const generateMessageOpenAI = async (
  profile: Profile,
  thesis: string,
  icpDescription: string
): Promise<OpenAIResponse> => {
  if (!openai) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const systemPrompt = getSystemPrompt();

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
    console.log(`[OpenAI] Starting generation for profile: ${profile.name} using ${modelName}`);
    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const duration = Date.now() - startTime;
    console.log(`[OpenAI] Generation completed in ${duration}ms`);

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("OpenAI returned empty content");
    }

    try {
      return JSON.parse(content) as OpenAIResponse;
    } catch (parseError) {
      console.error("Failed to parse JSON response from OpenAI:", content);
      throw new Error("Invalid JSON response from OpenAI");
    }
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    throw error;
  }
};

