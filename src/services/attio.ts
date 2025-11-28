import dotenv from "dotenv";

dotenv.config();

const ATTIO_API_URL = "https://api.attio.com/v2";

// Hardcoded mapping based on list 8364648a-e7ab-4399-9f2c-f338d6df3f29
const STAGE_MAPPING: Record<string, string> = {
  "sent connection": "3cf1900a-5c4c-4d5a-9241-34a9951bdb6a",
  "lead": "3cf1900a-5c4c-4d5a-9241-34a9951bdb6a", // Alias
  "accepted": "65763c0a-43d9-4651-b4f0-458044c44a86",
  "message 1": "ca805361-4a9a-4f61-bcf3-b56696d11b3d",
  "message 2": "fd12dee4-bece-44ae-bac2-7924853777c1",
  "message 3": "0d18b57c-5b98-49a7-8c1b-514c21362bcc",
  "replied/won": "88e39a45-ea88-4ac3-ab39-3472968553ad",
  "repied/won": "88e39a45-ea88-4ac3-ab39-3472968553ad", // Handle Attio typo
  "replied/lost": "0ed37f42-f81b-460d-ab81-e10c297225da",
};

const getStageOptionId = (stageName: string): string | null => {
    const key = stageName.toLowerCase().trim();
    return STAGE_MAPPING[key] || null;
};

// Helper to fetch or create a select option for a given attribute slug
const getOrCreateSelectOption = async (listId: string, attributeSlug: string, optionTitle: string): Promise<string | null> => {
    const apiKey = process.env.ATTIO_API_KEY;
    if (!apiKey) return null;

    try {
        // 1. Fetch existing options
        const response = await fetch(`${ATTIO_API_URL}/lists/${listId}/attributes/${attributeSlug}/options`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            console.error(`Failed to fetch options for ${attributeSlug}: ${response.status}`);
            return null;
        }

        const data = await response.json() as any;
        const options = data.data || [];
        
        // 2. Check for match
        const match = options.find((opt: any) => opt.title.toLowerCase().trim() === optionTitle.toLowerCase().trim());
        if (match) {
            console.log(`Found existing option for '${optionTitle}': ${match.id.option_id}`);
            return match.id.option_id;
        }

        // 3. Create new option if not found
        console.log(`Creating new option for '${attributeSlug}': ${optionTitle}`);
        const createResponse = await fetch(`${ATTIO_API_URL}/lists/${listId}/attributes/${attributeSlug}/options`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify({
                data: { title: optionTitle }
            })
        });

        if (!createResponse.ok) {
            console.error(`Failed to create option '${optionTitle}': ${createResponse.status}`);
            return null;
        }

        const createData = await createResponse.json() as any;
        console.log(`Created option '${optionTitle}': ${createData.data.id.option_id}`);
        return createData.data.id.option_id;

    } catch (error) {
        console.error(`Error in getOrCreateSelectOption for ${attributeSlug}:`, error);
        return null;
    }
};

export interface AttioLogEntry {
  person: string;
  jobTitle?: string;
  company?: string;
  linkedIn?: string;
  description?: string;
  notes?: string;
  stage?: string;
  outreachVariant?: string;
}

export const logToAttio = async (entry: AttioLogEntry) => {
  const apiKey = process.env.ATTIO_API_KEY;
  const listId = process.env.ATTIO_LIST_ID;
  
  if (!apiKey) {
    console.warn("ATTIO_API_KEY not set. Skipping Attio logging.");
    return;
  }

  const [firstName, ...lastNameParts] = entry.person.split(" ");
  const lastName = lastNameParts.join(" ") || "-"; 

  // 1. Create Person in 'people' object
  const personBody = {
    data: {
      values: {
        name: [{ 
          first_name: firstName, 
          last_name: lastName,
          full_name: entry.person
        }],
        ...(entry.jobTitle && { "job_title": [{ value: entry.jobTitle }] }),
        ...(entry.company && { "company": [{ value: entry.company }] }),
        ...(entry.linkedIn && { "linkedin": [{ value: entry.linkedIn }] }), 
        ...(entry.description && { "description": [{ value: entry.description }] }),
      }
    }
  };

  try {
    console.log("Creating Person in Attio:", JSON.stringify(personBody, null, 2));
    
    const personResponse = await fetch(`${ATTIO_API_URL}/objects/people/records`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(personBody),
    });

    if (!personResponse.ok) {
      const errorText = await personResponse.text();
      console.error(`Attio Person Creation Error (${personResponse.status}):`, errorText);
      throw new Error(`Attio Person Creation Error: ${personResponse.status} ${personResponse.statusText}`);
    }

    const personResult = await personResponse.json() as any;
    const recordId = personResult.data.id.record_id;
    console.log("Successfully created Person. ID:", recordId);

    // 2. Add to List (if LIST_ID is configured)
    if (listId) {
      const stageOptionId = entry.stage ? getStageOptionId(entry.stage) : null;
      if (entry.stage && !stageOptionId) {
          console.warn(`Warning: Stage '${entry.stage}' not found in mapping. Skipping stage assignment.`);
      }

      // Handle Outreach Variant
      let variantOptionId: string | null = null;
      if (entry.outreachVariant) {
          variantOptionId = await getOrCreateSelectOption(listId, "outreach_variant", entry.outreachVariant);
      }

      const listEntryBody = {
        data: {
          parent_record_id: recordId,
          parent_object: "people",
          entry_values: {
            ...(entry.notes && { "notes": [{ value: entry.notes }] }),
            ...(stageOptionId && { "stage": [{ option: stageOptionId }] }),
            ...(variantOptionId && { "outreach_variant": [{ option: variantOptionId }] }),
          }
        }
      };

      console.log(`Adding to List (${listId}):`, JSON.stringify(listEntryBody, null, 2));

      const listResponse = await fetch(`${ATTIO_API_URL}/lists/${listId}/entries`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(listEntryBody),
      });

      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        console.error(`Attio List Entry Error (${listResponse.status}):`, errorText);
        throw new Error(`Attio List Entry Error: ${listResponse.status} ${listResponse.statusText}`);
      }

      const listResult = await listResponse.json() as any;
      console.log("Successfully added to List:", listResult);
      return { person: personResult, listEntry: listResult };
    } else {
      console.warn("ATTIO_LIST_ID not set. Created person but did not add to any list.");
      return { person: personResult };
    }

  } catch (error) {
    console.error("Failed to log to Attio:", error);
    throw error;
  }
};
