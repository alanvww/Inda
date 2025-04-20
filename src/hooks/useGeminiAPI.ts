import { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';

// Environment variables
// Read the Gemini model name from environment variables
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-1.5-flash-latest"; // Provide a default
// URL for the backend API. Uses VITE_API_BASE_URL if set, otherwise defaults to the local proxy path.
const API_URL = import.meta.env.VITE_API_BASE_URL || '/api/gemini';

// Interface for request options specific to the Gemini hook
interface GeminiRequestOptions {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text'; // Matches proxy expectation
}

// Reusable interface for the hook's return value
export interface AIResponse<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  execute: () => Promise<T | null>;
  // rawResponse could potentially hold the raw text from proxy if needed later
  // rawResponse?: string | null; 
}

/**
 * Custom hook for making Google Gemini API requests via a Netlify proxy.
 * Centralizes API calling logic and provides loading/error states.
 */
export function useGeminiAPI<T>(options: GeminiRequestOptions): AIResponse<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { showToast } = useToast();
  
  // Monitor online/offline status (remains the same)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('You are back online', 'success');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      showToast('You are offline. Some features may be unavailable.', 'info');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showToast]);

  // Function to sanitize and fix common JSON issues (remains the same)
  // Useful when responseFormat is 'json' and the LLM doesn't perfectly format it
  const sanitizeJsonString = (jsonStr: string): string => {
    // Remove any markdown code block markers
    let cleaned = jsonStr.replace(/```json|```/g, '');
    
    // Trim whitespace
    cleaned = cleaned.trim();
    
    // Ensure the string starts with { or [ and ends with } or ]
    if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
      const objectStart = cleaned.indexOf('{');
      const arrayStart = cleaned.indexOf('[');
      
      if (objectStart !== -1 && (arrayStart === -1 || objectStart < arrayStart)) {
        cleaned = cleaned.substring(objectStart);
      } else if (arrayStart !== -1) {
        cleaned = cleaned.substring(arrayStart);
      }
    }
    
    if (!cleaned.endsWith('}') && !cleaned.endsWith(']')) {
      const objectEnd = cleaned.lastIndexOf('}');
      const arrayEnd = cleaned.lastIndexOf(']');
      
      if (objectEnd !== -1 && (arrayEnd === -1 || objectEnd > arrayEnd)) {
        cleaned = cleaned.substring(0, objectEnd + 1);
      } else if (arrayEnd !== -1) {
        cleaned = cleaned.substring(0, arrayEnd + 1);
      }
    }

    // Fix common JSON errors:
    // 1. Remove trailing commas in arrays and objects
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
    
    // 2. Add missing quotes around property names
    // eslint-disable-next-line no-useless-escape
    cleaned = cleaned.replace(/(\{|,)\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');

    return cleaned;
  };

  /**
   * Advanced JSON parsing with multiple fallback strategies (remains the same)
   * @param jsonStr String that may contain JSON
   * @returns Parsed JSON object or throws an error
   */
  const robustJsonParse = <T>(jsonStr: string): T => {
    // First attempt: direct parsing
    try {
      return JSON.parse(jsonStr) as T;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      console.warn('First JSON parse attempt failed, attempting sanitization');
      
      // Second attempt: sanitize then parse
      try {
        const sanitized = sanitizeJsonString(jsonStr);
        return JSON.parse(sanitized) as T;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (secondError) {
        console.warn('Sanitized JSON parse failed, attempting regex extraction');
        
        // Third attempt: try to extract JSON with regex
        // This pattern matches balanced JSON objects or arrays
        const jsonMatch = jsonStr.match(/\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}|\[(?:[^[\]]|(?:\[(?:[^[\]]|(?:\[[^[\]]*\]))*\]))*\]/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]) as T;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (regexError) {
            console.error('All JSON parsing attempts failed');
            throw new Error('Failed to parse response as valid JSON after multiple attempts');
          }
        }
        
        throw new Error('Could not extract valid JSON from response');
      }
    }
  };

  // Removed extractTextContent function as proxy returns { text: "..." }

  const execute = async (): Promise<T | null> => {
    setIsLoading(true);
    setError(null);
    
    // Check if we're offline (remains the same)
    if (!isOnline) {
      setIsLoading(false);
      setError(new Error('You are currently offline. This feature requires an internet connection.'));
      showToast('This action requires an internet connection', 'error');
      return null;
    }
    
    try {
      // Construct payload for the gemini-proxy function
      const payload = {
        modelName: GEMINI_MODEL,
        prompt: options.prompt,
        systemPrompt: options.systemPrompt,
        temperature: options.temperature, // Pass through if provided
        maxTokens: options.maxTokens,     // Pass through if provided
        responseFormat: options.responseFormat || 'text', // Default to text
      };

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Referer and X-Title might still be useful for proxy/API logs
          "HTTP-Referer": window.location.origin, 
          "X-Title": "List Organizer App", // Or a more generic title
          "Accept": 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Try to parse error from proxy response body
        const errorData = await response.json().catch(() => ({ error: `HTTP error ${response.status}` }));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      // Proxy should return { text: "..." }
      const result = await response.json();
      
      if (result.error) {
        // Handle errors returned explicitly by the proxy function
        throw new Error(result.error);
      }

      // Extract the text content from the proxy's response
      const textContent = result.text;

      if (typeof textContent !== 'string') {
          console.error('Proxy response did not contain a text field:', result);
          throw new Error('Invalid response format received from proxy.');
      }
      
      let parsedResult: T;
      
      // If expecting JSON, try to parse the text content
      if (options.responseFormat === 'json') {
        try {
          // Use our robust JSON parsing with multiple fallback strategies
          parsedResult = robustJsonParse<T>(textContent);
          
          // For debugging purposes
          console.log('Successfully parsed JSON response:', parsedResult);
        } catch (parseError) {
          console.error('JSON parsing error:', parseError);
          // Include the problematic text in the error for easier debugging
          const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown parsing error';
          throw new Error(`Failed to parse API response as JSON: ${errorMsg}. Raw text: "${textContent.substring(0, 100)}..."`);
        }
      } else {
        // For text responses, just return the text content (cast needed)
        parsedResult = textContent as unknown as T;
      }
      
      setData(parsedResult);
      return parsedResult;
    } catch (error) {
      const finalError = error instanceof Error ? error : new Error('An unknown error occurred');
      setError(finalError);
      // Optionally show toast for API errors
      showToast(`API Error: ${finalError.message}`, 'error'); 
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { 
    data, 
    isLoading, 
    error, 
    execute
  };
}