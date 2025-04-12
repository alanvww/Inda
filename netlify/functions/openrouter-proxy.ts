import { Handler, HandlerEvent } from "@netlify/functions";

interface OpenRouterRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  response_format?: {
    type: string;
  };
  max_tokens?: number;
  temperature?: number;
}

// Securely access API key from Netlify environment variables
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
// Use the same URL from your frontend config but access it server-side
const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || "https://openrouter.ai/api/v1/chat/completions";

const handler: Handler = async (event: HandlerEvent) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
      headers: { "Allow": "POST" }
    };
  }

  // Check if API key is configured
  if (!OPENROUTER_API_KEY) {
    console.error("Missing OPENROUTER_API_KEY environment variable");
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Server configuration error: Missing API key"
      })
    };
  }

  try {
    // Parse the incoming request body
    const requestBody: OpenRouterRequest = JSON.parse(event.body || "{}");
    
    // Get the requesting URL (for the HTTP-Referer header)
    const referer = event.headers.referer || event.headers.origin || "https://example.com";
    
    // Forward the request to OpenRouter API
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": referer,
        "X-Title": "List Organizer App",
      },
      body: JSON.stringify(requestBody),
    });

    // Get the response data
    const data = await response.json();

    // If OpenRouter returned an error
    if (!response.ok) {
      console.error("OpenRouter API error:", data);
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: data.error || "Error communicating with OpenRouter API"
        })
      };
    }

    // Return successful response
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error("Function error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal server error"
      })
    };
  }
};

export { handler };
