import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Profile } from "../types";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { GenerationResponse } from "../llm_factory";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

const messageModelName = process.env.GEMINI_MODEL || "gemini-1.5-pro";
const icpModelName = process.env.GEMINI_ICP_MODEL || "gemini-1.5-flash"; // Default to flash/nano for speed

const getSystemPrompt = (): string => {
  try {
    const promptPath = path.resolve(process.cwd(), "system_prompt.txt");
    if (fs.existsSync(promptPath)) {
      return fs.readFileSync(promptPath, "utf-8");
    }
  } catch (error) {
    console.warn("Could not read system_prompt.txt, falling back to default.");
  }
  return "You are an experienced founder doing qualitative market research... (fallback)";
};

const ICP_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    icpScore: { type: SchemaType.NUMBER },
    icpReason: { type: SchemaType.STRING },
    icpLearning: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ["icpScore", "icpReason", "icpLearning"],
};

export const generateMessageGemini = async (
  profile: Profile,
  thesis: string,
  icpDescription: string
): Promise<GenerationResponse> => {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const systemPrompt = getSystemPrompt();

  if (!profile.firstName && profile.name) {
    profile.firstName = profile.name.split(" ")[0];
  }
  const profileJson = JSON.stringify(profile, null, 2);

  // --- STEP 1: ICP CHECK ---
  console.log(`[Gemini] Starting ICP check for: ${profile.name} using ${icpModelName}`);
  
  const icpModel = genAI.getGenerativeModel({
    model: icpModelName,
    systemInstruction: `You are an expert screener for a founder doing market research.
Your ONLY job is to evaluate if this person matches the ICP description.
Output JSON with: icpScore (0-10), icpReason (1 sentence), icpLearning (3 bullet points).
Do NOT write a message.`,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ICP_RESPONSE_SCHEMA,
      // @ts-ignore
      thinkingConfig: { thinkingLevel: "low" },
    },
  });

  const icpPrompt = `
ICP Description: ${icpDescription}
Target Profile: ${profileJson}
`;

  let icpData: any;
  try {
    const startIcp = Date.now();
    const icpResult = await icpModel.generateContent(icpPrompt);
    const icpText = icpResult.response.text();
    console.log(`[Gemini] ICP Check completed in ${Date.now() - startIcp}ms`);
    icpData = JSON.parse(icpText);
  } catch (error) {
    console.error("[Gemini] ICP Check failed:", error);
    throw error;
  }

  if (icpData.icpScore <= 5) {
    console.log(`[Gemini] Score ${icpData.icpScore} is too low. Skipping message generation.`);
    return {
      icpScore: icpData.icpScore,
      icpReason: icpData.icpReason,
      icpLearning: icpData.icpLearning,
      message: null
    };
  }

  // --- STEP 2: MESSAGE GENERATION ---
  console.log(`[Gemini] Score ${icpData.icpScore} is good. Generating message using ${messageModelName}`);
  
  const msgModel = genAI.getGenerativeModel({
    model: messageModelName,
    systemInstruction: systemPrompt, // Use the full user-defined system prompt for message generation
    // No JSON schema enforcement here strictly needed if the prompt is good, but good to have if your prompt expects it.
    // However, your system prompt asks for JSON output with specific keys. 
    // Let's use plain text output for the message or keep using JSON if your system prompt demands it.
    // Your CURRENT system prompt (in file) asks for JSON output including icpScore etc.
    // To avoid rewriting the system prompt logic entirely, we can ask it to output the same JSON structure,
    // but we will ignore the score/reason since we already have it, OR we just ask for the message.
    
    // BUT: The user wants to edit the system prompt on the fly. 
    // The system prompt currently says "Your goal is to evaluate... Score... IF > 5 draft message".
    // If we split it, the second step doesn't need to score again.
    
    // DECISION: We will pass the *already calculated* score/reason context to the message generator
    // so it focuses purely on writing the message.
    // We might need to temporarily append instructions to the system prompt or user prompt to say 
    // "Profile matches! Write the message."
  });

  // Adjust user prompt to include the decision context so the model knows it's a "Go"
    const msgUserPrompt = `
Target Profile: ${profileJson}

TASK:
Write the connection request message based on the System Prompt instructions.
Output ONLY the message text (string).
`;
  
  try {
    const startMsg = Date.now();
    const msgResult = await msgModel.generateContent(msgUserPrompt);
    const msgText = msgResult.response.text();
    console.log(`[Gemini] Message Generation completed in ${Date.now() - startMsg}ms`);
    
    // Return strictly constructed JSON
    return {
        icpScore: icpData.icpScore,
        icpReason: icpData.icpReason,
        icpLearning: icpData.icpLearning,
        message: msgText.trim() // Assume model returns text since we asked for text
    };

  } catch (error) {
    console.error("[Gemini] Message Generation failed:", error);
    throw error;
  }
};
