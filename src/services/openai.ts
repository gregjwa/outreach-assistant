import OpenAI from "openai";
import { Profile } from "../types";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { GenerationResponse } from "../llm_factory";

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;
let openai: OpenAI | null = null;

if (apiKey) {
  openai = new OpenAI({ apiKey });
}

const messageModelName = process.env.OPENAI_MODEL || "gpt-4o";
const icpModelName = process.env.OPENAI_ICP_MODEL || "gpt-4o-mini";

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

export const generateMessageOpenAI = async (
  profile: Profile,
  thesis: string,
  icpDescription: string
): Promise<GenerationResponse> => {
  if (!openai) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const systemPrompt = getSystemPrompt();

  if (!profile.firstName && profile.name) {
    profile.firstName = profile.name.split(" ")[0];
  }
  const profileJson = JSON.stringify(profile, null, 2);

  // --- STEP 1: ICP CHECK ---
  console.log(`[OpenAI] Starting ICP check for: ${profile.name} using ${icpModelName}`);
  const startIcp = Date.now();
  
  const icpCompletion = await openai.chat.completions.create({
    model: icpModelName,
    messages: [
        { 
            role: "system", 
            content: `You are an expert screener for a founder doing market research.
Your ONLY job is to evaluate if this person matches the ICP description.
Output JSON with: icpScore (0-10), icpReason (1 sentence), icpLearning (3 bullet points).
Do NOT write a message.` 
        },
        { 
            role: "user", 
            content: `ICP Description: ${icpDescription}\nTarget Profile: ${profileJson}` 
        },
    ],
    response_format: { type: "json_object" },
  });
  
  console.log(`[OpenAI] ICP Check completed in ${Date.now() - startIcp}ms`);
  const icpContent = icpCompletion.choices[0].message.content;
  if (!icpContent) throw new Error("OpenAI returned empty ICP content");
  
  const icpData = JSON.parse(icpContent);

  if (icpData.icpScore <= 5) {
    console.log(`[OpenAI] Score ${icpData.icpScore} is too low. Skipping message generation.`);
    return {
      icpScore: icpData.icpScore,
      icpReason: icpData.icpReason,
      icpLearning: icpData.icpLearning,
      message: null
    };
  }

  // --- STEP 2: MESSAGE GENERATION ---
  console.log(`[OpenAI] Score ${icpData.icpScore} is good. Generating message using ${messageModelName}`);
  const startMsg = Date.now();

  const msgUserPrompt = `
  Target Profile: ${profileJson}
  
  TASK:
  Write the connection request message based on the System Prompt instructions.
  Output ONLY the message text (string).
  `;

  const msgCompletion = await openai.chat.completions.create({
    model: messageModelName,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: msgUserPrompt },
    ],
    // response_format: { type: "json_object" }, // REMOVED
  });

  console.log(`[OpenAI] Message Generation completed in ${Date.now() - startMsg}ms`);
  const msgContent = msgCompletion.choices[0].message.content;
  if (!msgContent) throw new Error("OpenAI returned empty message content");

  return {
      icpScore: icpData.icpScore,
      icpReason: icpData.icpReason,
      icpLearning: icpData.icpLearning,
      message: msgContent.trim()
  };
};
