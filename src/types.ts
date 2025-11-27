export interface Experience {
  title: string;
  company: string;
  dates: string;
  description?: string;
}

export interface Profile {
  name: string;
  firstName?: string;
  headline?: string;
  summary?: string;
  location?: string;
  experience?: Experience[];
  linkedinUrl?: string;
}

export interface GenerateRequest {
  profile: Profile;
  currentUrl?: string;
  campaignId?: string;
  thesis?: string;
}

export interface GenerateResponse {
  message: string | null;
  length: number;
  icpFit: string; // Keeping for backward compat, maybe map to score/reason
  icpScore?: number;
  icpReason?: string;
  icpLearning?: string[];
  error?: string;
}
