import { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';

// Environment variables
// Only using the model name from environment, API calls go through our proxy
const OPENROUTER_MODEL = import.meta.env.VITE_OPENROUTER_MODEL_PLACEHOLDER;
// URL to our serverless function
const PROXY_URL = '/.netlify/functions/openrouter-proxy';

interface OpenRouterRequestOptions {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json_object' | 'text';
}

export interface AIResponse<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  execute: () => Promise<T | null>;
  rawResponse?: Record<string, unknown> | null; // For debugging or advanced use cases
}

/**
 * Custom hook for making OpenRouter API requests.
 * Centralizes API calling logic and provides loading/error states.
 */
export function useOpenRouterAPI<T>(options: OpenRouterRequestOptions): AIResponse<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { showToast } = useToast();
  
  // Monitor online/offline status
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

  // Function to sanitize and fix common JSON issues in API responses
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
   * Advanced JSON parsing with multiple fallback strategies
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

  // Extract text content from API response
  const extractTextContent = (response: Record<string, unknown>): string => {
    // Handle different API response formats
    if (response.output && Array.isArray(response.output)) {
      // Old format (Replicate API)
      return response.output.join('').trim();
    } else if (
      response.choices && 
      Array.isArray(response.choices) && 
      response.choices[0]?.message?.content
    ) {
      // New format (OpenRouter API)
      return response.choices[0].message.content as string;
    } else {
      console.error('Unexpected response format:', response);
      throw new Error('Unrecognized API response format');
    }
  };

  const execute = async (): Promise<T | null> => {
    setIsLoading(true);
    setError(null);
    
    // Check if we're offline
    if (!isOnline) {
      setIsLoading(false);
      setError(new Error('You are currently offline. This feature requires an internet connection.'));
      showToast('This action requires an internet connection', 'error');
      return null;
    }
    
    try {
      const data = {
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: "system",
            content: options.systemPrompt || "You are a helpful assistant that responds in the format requested."
          },
          {
            role: "user",
            content: options.prompt
          }
        ],
        response_format: options.responseFormat ? { type: options.responseFormat } : undefined,
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature !== undefined ? options.temperature : 0.7
      };

      const response = await fetch(PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "List Organizer App",
          "Accept": 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Extract the content from the API response
      const textContent = extractTextContent(result);
      
      let parsedResult: T;
      
      // If expecting JSON, try to parse the content
      if (options.responseFormat === 'json_object') {
        try {
          // Use our robust JSON parsing with multiple fallback strategies
          parsedResult = robustJsonParse<T>(textContent);
          
          // For debugging purposes
          console.log('Successfully parsed JSON response:', parsedResult);
        } catch (parseError) {
          console.error('JSON parsing error:', parseError);
          throw new Error('Failed to parse API response as JSON');
        }
      } else {
        // For text responses, just return the text content
        parsedResult = textContent as unknown as T;
      }
      
      setData(parsedResult);
      return parsedResult;
    } catch (error) {
      const finalError = error instanceof Error ? error : new Error('An unknown error occurred');
      setError(finalError);
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
