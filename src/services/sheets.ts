import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const getAuthClient = () => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !key) {
    console.warn("Google Sheets credentials not fully set. Logging will be skipped.");
    return null;
  }

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key,
    },
    scopes: SCOPES,
  });
};

export interface LogEntry {
  campaign_id: string;
  linkedin_url: string;
  name: string;
  headline: string;
  location: string;
  raw_profile_json: string;
  generated_message: string;
  message_length: number;
  thesis_used: string;
  icp_score: number;
  icp_reason: string;
  icp_learning: string; // Joined array
}

export const logToSheets = async (entry: LogEntry) => {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const auth = getAuthClient();

  if (!auth || !spreadsheetId) {
    console.warn("Google Sheets logging skipped due to missing configuration.");
    return;
  }

  const sheets = google.sheets({ version: "v4", auth });

  const timestamp = new Date().toISOString();
  
  const values = [
    [
      timestamp,
      entry.campaign_id,
      entry.linkedin_url,
      entry.name,
      entry.headline,
      entry.location,
      entry.raw_profile_json,
      entry.generated_message,
      entry.message_length,
      entry.thesis_used,
      entry.icp_score,
      entry.icp_reason,
      entry.icp_learning,
      "", // connection_accepted
      "", // replied
      "", // notes
    ],
  ];

  try {
    // We need to adjust the range since we added columns. 
    // Old range was A:M. We added 3 columns (Score, Reason, Learning).
    // Actually, let's look at the previous structure.
    // Previous: timestamp, campaign_id, linkedin_url, name, headline, location, raw_profile, message, length, thesis, accepted, replied, notes. (13 cols)
    // New: ... thesis, icp_score, icp_reason, icp_learning, accepted ...
    // So we are inserting columns or appending them? 
    // "On each successful LLM call, append a row to LLM Outreach Log with these columns:"
    // The user didn't explicitly ask to *reorder* columns, just "log... from the JSON".
    // Standard practice: Append new metrics after existing ones or insert where logical.
    // Let's put ICP metrics after 'thesis_used' and before 'connection_accepted'.
    
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "'LLM Outreach Log'!A:P", // Quoted sheet name for safety with spaces
      valueInputOption: "RAW",
      requestBody: {
        values,
      },
    });
    console.log("Logged to Google Sheets successfully.");
  } catch (error) {
    console.error("Error logging to Google Sheets:", error);
  }
};
