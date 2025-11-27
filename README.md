# Personalized Outreach Backend

Backend service for the LinkedIn outreach helper extension.

## Setup

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Variables**:
    Create a `.env` file in the root directory based on `.env.example`.
    ```bash
    cp .env.example .env
    ```
    Fill in the following:
    *   `GEMINI_API_KEY`: Your Google Gemini API key.
    *   `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Email of your Google Cloud Service Account.
    *   `GOOGLE_PRIVATE_KEY`: Private key of your Service Account (surrounded by quotes if it contains newlines, or just paste it).
    *   `GOOGLE_SHEET_ID`: The ID of the Google Sheet to log to.
    *   `DEFAULT_THESIS`: Your default research thesis.

3.  **Google Sheets Setup**:
    *   Create a Google Sheet.
    *   Name the sheet (tab) `LLM Outreach Log`.
    *   Share the sheet with the `GOOGLE_SERVICE_ACCOUNT_EMAIL` (give "Editor" access).

## Development

Run the server in development mode (auto-reloads):
```bash
npm run dev
```

## Production

Build and run:
```bash
npm run build
npm start
```

## API Endpoint

**POST** `/api/generate`

**Request Body**:
```json
{
  "profile": {
    "name": "John Doe",
    "firstName": "John",
    "headline": "CEO at Tech",
    "summary": "...",
    "location": "New York",
    "experience": [],
    "linkedinUrl": "https://linkedin.com/in/johndoe"
  },
  "currentUrl": "https://linkedin.com/in/johndoe",
  "campaignId": "camp_123",
  "thesis": "Optional override thesis"
}
```

**Response**:
```json
{
  "message": "Hi John...",
  "length": 145,
  "icpFit: "unknown",
  "error": "..."
}
```

