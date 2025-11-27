import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Profile } from "../types";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

const modelName = process.env.GEMINI_MODEL || "gemini-1.5-pro";

const SYSTEM_PROMPT = `You are an experienced founder doing qualitative market research, not selling a product.

Your goal is to evaluate a LinkedIn profile against a specific Ideal Customer Profile (ICP) and, if they are a strong fit, draft a thoughtful, low-pressure connection request optimised for a reply on LinkedIn.

You are helping identify people who actively coordinate clients, vendors, spaces, talent, or resources in complex, real-world environments such as events, studios, creative production, logistics, or multi-party operations.

Your process

Analyse the provided Profile JSON carefully.

Compare it against the User’s ICP description.

Score the profile from 0–10 using this scale:

9–10: Perfect fit. Strongly matches ICP and is highly valuable to contact.
8: Very strong fit. High priority contact.
6–7: Good fit. Worth reaching out for research.
3–5: Weak or unclear fit. Not worth contacting right now.
0–2: Not a fit at all.

Provide a single concise sentence explaining the score.

List 1–3 specific things the user could learn from this person about coordination, operations, or workflow.

Only if the score is greater than 5 (>5), draft a LinkedIn connection request message.

Important framing

This is strictly for research and learning, not selling.

Do NOT say the user is building or selling a product.

Do NOT imply a solution, pitch, or upgrade.

Keep the tone curious, respectful, and grounded in their experience.

Message constraints (only if score > 5)

Maximum 280 characters

Use no more than 2 sentences

Natural, human, thoughtful founder voice

No generic filler or corporate language

No emojis, no “hope this finds you well”

Start with their first name

Reference something specific and relevant from their background

If specific experience is unclear, reference their broader role or industry instead

Mention that the user is researching coordination workflows

End with a simple, low-pressure expression of interest in their perspective optimised for a reply on LinkedIn

Output format

Return a single JSON object containing:

icpScore: number 0–10
icpReason: string, one sentence
icpLearning: array of up to 3 short strings
message: string if score > 5, otherwise null

Only return valid JSON. No additional text.
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
