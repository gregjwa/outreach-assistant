import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GenerateRequest, GenerateResponse } from "./types";
import { generateMessage } from "./services/gemini";
import { logToSheets } from "./services/sheets";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Admin Page
app.get("/admin", (req, res) => {
  const adminPath = path.resolve(process.cwd(), "public", "admin.html");
  res.sendFile(adminPath);
});

// Update System Prompt Endpoint
app.post("/api/update-prompt", (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Prompt string is required" });
  }

  try {
    const promptPath = path.resolve(process.cwd(), "system_prompt.txt");
    fs.writeFileSync(promptPath, prompt, "utf-8");
    console.log("System prompt updated via API.");
    res.status(200).json({ message: "System prompt updated successfully" });
  } catch (error) {
    console.error("Error writing system prompt:", error);
    res.status(500).json({ error: "Failed to update system prompt" });
  }
});

// Get System Prompt Endpoint
app.get("/api/get-prompt", (req, res) => {
  try {
    const promptPath = path.resolve(process.cwd(), "system_prompt.txt");
    if (fs.existsSync(promptPath)) {
      const prompt = fs.readFileSync(promptPath, "utf-8");
      res.status(200).json({ prompt });
    } else {
      res.status(404).json({ error: "System prompt file not found" });
    }
  } catch (error) {
    console.error("Error reading system prompt:", error);
    res.status(500).json({ error: "Failed to read system prompt" });
  }
});

app.post("/api/generate", async (req: Request<{}, {}, GenerateRequest>, res: Response<GenerateResponse>) => {
  try {
    const { profile, campaignId, thesis, currentUrl } = req.body;

    if (!profile) {
      return res.status(400).json({
        message: null,
        length: 0,
        icpFit: "unknown",
        error: "Missing profile data",
      });
    }

    const thesisToUse = thesis || process.env.DEFAULT_THESIS || "";
    const icpDescription = process.env.ICP_DESCRIPTION || "No ICP description provided.";
    
    // Generate message and score
    let result;
    try {
      result = await generateMessage(profile, thesisToUse, icpDescription);
    } catch (error) {
      return res.status(500).json({
        message: null,
        length: 0,
        icpFit: "unknown",
        error: "LLM generation failed",
      });
    }

    const generatedMessage = result.message || "";
    const messageLength = generatedMessage.length;

    await logToSheets({
      campaign_id: campaignId || "",
      linkedin_url: profile.linkedinUrl || currentUrl || "",
      name: profile.name,
      headline: profile.headline || "",
      location: profile.location || "",
      raw_profile_json: JSON.stringify(profile),
      generated_message: generatedMessage,
      message_length: messageLength,
      thesis_used: thesisToUse,
      icp_score: result.icpScore,
      icp_reason: result.icpReason,
      icp_learning: result.icpLearning.join(", "),
    });

    res.json({
      message: result.message || null, // Explicitly null if skipped
      length: messageLength,
      icpFit: result.icpScore > 5 ? "good" : "poor", // Simple mapping for frontend compat
      icpScore: result.icpScore,
      icpReason: result.icpReason,
      icpLearning: result.icpLearning,
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({
      message: null,
      length: 0,
      icpFit: "unknown",
      error: "Internal server error",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
