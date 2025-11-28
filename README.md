# Personalized Outreach Backend

Backend service for the LinkedIn outreach helper extension.

## Setup

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Variables**:
    Create a `.env` file in the root directory based on `example.env`.
    ```bash
    cp example.env .env
    ```
    Fill in the following:
    *   `GEMINI_API_KEY`: Your Google Gemini API key.
    *   `OPENAI_API_KEY`: Your OpenAI API key (if using OpenAI).
    *   `LLM_PROVIDER`: Set to `gemini` or `openai`.
    *   `ATTIO_API_KEY`: Your Attio API Key.
    *   `ATTIO_LIST_ID`: The ID of the Attio List to add people to.
    *   `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Email of your Google Cloud Service Account.
    *   `GOOGLE_PRIVATE_KEY`: Private key of your Service Account.
    *   `GOOGLE_SHEET_ID`: The ID of the Google Sheet to log to.

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

## API Endpoints

### 1. Generate Message
**POST** `/api/generate`

Generates a personalized message using the configured LLM.

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

### 2. Log to Attio
**POST** `/api/log-attio`

Creates a Person record in Attio and adds them to the configured List.

**Request Body**:
```json
{
  "person": "John Doe",
  "jobTitle": "CEO",
  "company": "Acme Corp",
  "linkedIn": "https://linkedin.com/in/johndoe",
  "description": "Extracted from LinkedIn profile...",
  "notes": "Custom note for the list entry",
  "stage": "Sent Connection",
  "outreachVariant": "Campaign A - V1"
}
```

**Fields**:
*   `person` (Required): Full name of the person.
*   `jobTitle`: Current job title.
*   `company`: Company name (Text).
*   `linkedIn`: LinkedIn profile URL.
*   `description`: Description or summary of the person.
*   `notes`: Notes to be added to the list entry.
*   `stage`: The status in the list (e.g., "Sent Connection", "Accepted", "Message 1"). Defaults to mapping logic if exact match found.
*   `outreachVariant`: The variant used (e.g., "Thesis A"). **Note:** If this variant does not exist in Attio, it will be automatically created as a new option.

**Response**:
```json
{
  "success": true,
  "data": {
    "person": { ... },
    "listEntry": { ... }
  }
}
```

### 3. Configuration Management
**GET** `/api/config`
Returns current provider.

**POST** `/api/config`
Update active provider (`gemini` or `openai`).

**GET/POST** `/api/update-prompt`
Read or update the system prompt used for generation.
