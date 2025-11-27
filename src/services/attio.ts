import dotenv from "dotenv";

dotenv.config();

const ATTIO_API_URL = "https://api.attio.com/v2";

export interface AttioLogEntry {
  person: string;
  jobTitle?: string;
  company?: string;
  linkedIn?: string;
  description?: string;
  notes?: string;
  stage?: string;
}

export const logToAttio = async (entry: AttioLogEntry) => {
  const apiKey = process.env.ATTIO_API_KEY;
  
  if (!apiKey) {
    console.warn("ATTIO_API_KEY not set. Skipping Attio logging.");
    return;
  }

  // Based on the screenshot, "Person" is the main record.
  // We are assuming the "people" object.
  // You may need to adjust attribute slugs (e.g. "job_title" vs "job-title") based on your Attio setup.
  // To find your attribute slugs, go to Attio -> Workspace Settings -> Data Model -> People.
  
  const body = {
    data: {
      values: {
        // Standard 'name' attribute for People object
        name: [
            { value: entry.person }
        ],
        // Using common slugs; update these if your Attio configuration differs
        ...(entry.jobTitle && { "job_title": [{ value: entry.jobTitle }] }),
        ...(entry.company && { "company": [{ value: entry.company }] }),
        ...(entry.linkedIn && { "linkedin": [{ value: entry.linkedIn }] }), 
        ...(entry.description && { "description": [{ value: entry.description }] }),
        // 'notes' might be a custom text attribute
        ...(entry.notes && { "notes": [{ value: entry.notes }] }),
        // 'stage' usually requires a select option ID or value, or a status. 
        // If it's a status attribute, the format is different.
        // For now, sending as text if it allows, or you might need to look up the option ID.
        // Assuming it is a Select attribute for now:
        ...(entry.stage && { "stage": [{ value: entry.stage }] }), 
      }
    }
  };

  try {
    console.log("Logging to Attio:", JSON.stringify(body, null, 2));
    
    // Attempt to create a record in the 'people' object
    // If you are using a custom object, change "people" to your object slug.
    const response = await fetch(`${ATTIO_API_URL}/objects/people/records`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Attio API Error (${response.status}):`, errorText);
      throw new Error(`Attio API Error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log("Successfully logged to Attio:", result);
    return result;

  } catch (error) {
    console.error("Failed to log to Attio:", error);
    throw error;
  }
};

