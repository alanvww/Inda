import { GoogleGenAI } from "@google/genai";

interface GeminiProxyRequest {
  prompt: string;
  systemPrompt?: string;
  modelName: string; // e.g., "gemini-1.5-flash-latest"
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
}

// Securely access API key from environment variables (Bun automatically loads .env)
const GOOGLE_GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
const PORT = process.env.GEMINI_PROXY_PORT || 3001; // Allow configuring port

// Default headers including CORS
const defaultHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*', // Allow requests from any origin (adjust for production)
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, HTTP-Referer, X-Title, Accept',
};

console.log("Starting Bun server for Gemini proxy...");

if (!GOOGLE_GEMINI_API_KEY) {
    console.error("\nFATAL ERROR: Missing GOOGLE_GEMINI_API_KEY environment variable.");
    console.error("Please ensure it is set in your .env file.\n");
    process.exit(1); // Exit if key is missing
}

Bun.serve({
  port: PORT,
  async fetch(request) {
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: defaultHeaders });
    }

    // 1. Check Method
    if (request.method !== "POST") {
      console.log("Gemini Server: Incorrect HTTP method:", request.method);
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: { ...defaultHeaders, Allow: "POST" },
      });
    }

    // API Key check already done at startup

    try {
      // 2. Parse Request Body
      const requestBody: GeminiProxyRequest = await request.json();
      const {
        prompt,
        systemPrompt,
        modelName,
        temperature,
        maxTokens,
        responseFormat = 'text',
      } = requestBody;

      if (!prompt || !modelName) {
        console.log("Gemini Server: Missing required fields in request body.");
        return new Response(JSON.stringify({ error: "Missing required fields: prompt and modelName" }), {
          status: 400,
          headers: defaultHeaders,
        });
      }

      // 3. Initialize Gemini Client
      const genAI = new GoogleGenAI({ apiKey: GOOGLE_GEMINI_API_KEY });

      // 4. Construct Prompt and Prepare Config Params
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
      const contents = [{ role: "user", parts: [{ text: fullPrompt }] }];

      // Prepare config params to be passed directly
      const apiParams: {
          temperature?: number;
          maxOutputTokens?: number;
          responseMimeType?: string;
      } = {};

      if (temperature !== undefined) {
          apiParams.temperature = temperature;
      }
      if (maxTokens !== undefined) {
          apiParams.maxOutputTokens = maxTokens;
      }
      if (responseFormat === 'json') {
          apiParams.responseMimeType = "application/json";
      }

      // 5. Call Gemini API (Using the pattern for SDK v0.9.0)
      console.log(`Gemini Server: Attempting API call to model: ${modelName}`);
      const result = await genAI.models.generateContent({
          model: modelName,
          contents,
          ...apiParams, // Spread the config parameters here
          // safetySettings // Add safety settings if needed
      });

      // 6. Process Response
      if (!result || typeof result.text !== 'string') {
          const blockReason = result?.promptFeedback?.blockReason;
          const finishReason = result?.candidates?.[0]?.finishReason;
          console.error("Gemini Server: API call failed, blocked, or returned no text.", blockReason ? `Block Reason: ${blockReason}` : '', finishReason ? `Finish Reason: ${finishReason}`: '');
          return new Response(JSON.stringify({ error: `Gemini API call failed. ${blockReason ? `Reason: ${blockReason}` : 'No response content.'}` }), {
              status: 500,
              headers: defaultHeaders
          });
      }

      const responseText = result.text;

      // 7. Return Response
      console.log("Gemini Server: API call successful. Returning response.");
      return new Response(JSON.stringify({ text: responseText }), {
        status: 200,
        headers: defaultHeaders,
      });

    } catch (error: unknown) {
      console.error("Gemini server error:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      return new Response(JSON.stringify({ error: `Internal server error: ${errorMessage}` }), {
        status: 500,
        headers: defaultHeaders,
      });
    }
  },
});

console.log(`Gemini proxy server running on http://localhost:${PORT}`);