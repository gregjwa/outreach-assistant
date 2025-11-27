import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Profile } from "../types";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

const modelName = process.env.GEMINI_MODEL || "gemini-1.5-pro";

const SYSTEM_PROMPT = `You are an expert founder doing market research.
Your goal is to evaluate a LinkedIn profile against a specific Ideal Customer Profile (ICP) and, if they are a good fit, write a connection request.

Your Process:
1. Analyze the provided Profile JSON.
2. Compare it against the User's ICP Description.
3. Score the profile from 0-10 (10 = Perfect fit, MUST talk to; 5 or below = Not worth contacting).
4. Provide a concise 1-sentence reason for the score.
5. List 1-3 short specific things I can learn from them (operational/coordination focus).
6. IF AND ONLY IF the score is GREATER THAN 5 (> 5), draft a connection message.

Message Constraints (only if score > 5):
- Under 280 characters
- Natural, human, thoughtful founder voice
- No generic fluff, no emojis, no "I hope this finds you well"
- Reference specific experience from their profile
- Context: I am researching how people coordinate clients, vendors, and freelancers.
- Close: Simple, low pressure interest in their perspective.

Output Format:
Return a JSON object with:
- icpScore (number)
- icpReason (string)
- icpLearning (array of strings)
- message (string or null if score <= 5)
`;

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

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
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
