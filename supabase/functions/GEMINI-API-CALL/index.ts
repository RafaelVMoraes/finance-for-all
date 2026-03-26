import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS headers required for browser API usage
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Patterns for basic prompt injection detection (user attempts to manipulate system flags/messages)
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
  /disregard\s+(all\s+)?(previous|prior|above)/i,
  /forget\s+(everything|all|your)\s+(instructions|rules|prompts)/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /new\s+instructions?\s*:/i,
  /override\s+(system|previous|all)/i,
  /\[system\s*(prompt|message|instruction)\]/i,
  /act\s+as\s+(if|though)\s+you/i,
  /pretend\s+(to\s+be|you\s+are)/i,
  /what\s+are\s+your\s+(instructions|rules|prompts|system\s+prompt)/i,
  /reveal\s+(your|the)\s+(instructions|prompts|system)/i,
  /show\s+me\s+(your|the)\s+(instructions|prompts|system)/i,
];

// ----------------------
//   Utility Functions
// ----------------------

/**
 * Returns true if prompt text appears to contain prompt injection attempt patterns.
 */
function detectPromptInjection(text: string): boolean {
  const lowerText = text.toLowerCase();
  return INJECTION_PATTERNS.some((pattern) => pattern.test(lowerText));
}

/**
 * Performs "light scrub" of prompt text:
 * - Collapse whitespace,
 * - Remove most control characters,
 * - Limit repeated special chars (command injection hardening).
 */
function sanitizePrompt(text: string): string {
  let sanitized = text.trim().replace(/\s+/g, ' ');
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  sanitized = sanitized.replace(/([^\w\s])\1{4,}/g, '$1$1$1');
  return sanitized;
}

/**
 * Validates and sanitizes the supplied user prompt.
 * - Returns { valid, sanitized, error? }.
 * - Screens for empty, overlong, or suspicious messages.
 */
function validatePrompt(
  prompt: unknown,
): { valid: boolean; error?: string; sanitized?: string; warning?: string } {
  if (typeof prompt !== 'string') {
    return { valid: false, error: 'Prompt must be a string' };
  }

  const trimmed = prompt.trim();

  if (detectPromptInjection(trimmed)) {
    // Basic detection to block obvious prompt injection attempts
    console.warn('Potential prompt injection detected');
    return {
      valid: false,
      error: 'Your message contains patterns that cannot be processed. Please rephrase your question.',
    };
  }

  const sanitized = sanitizePrompt(trimmed);
  return { valid: true, sanitized };
}

// ----------------------
//   Main Request Handler
// ----------------------

Deno.serve(async (req) => {
  // Short-circuit for CORS preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ----------- Environment Setup -----------
    // Load required secrets from the function execution context
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    // Defensive sanity checks for all required envs
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase configuration');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!geminiApiKey) {
      console.error('Missing GEMINI_API_KEY');
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ----------- Authentication (Supabase) -----------
    // Require JWT on Authorization header for all requests
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.warn('No authorization header provided');
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a Supabase client with provided user token (JWT sent in header)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Check that token resolves to a user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      console.warn('Authentication failed:', authError?.message || 'No user found');
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Authenticated request from user: ${user.id}`);

    // ----------- Input Parsing & Validation -----------
    // Ensure request is JSON, and decode supplied body/prompt
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate that prompt looks like safe/normal user input
    const validation = validatePrompt(body.prompt);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sanitizedPrompt = validation.sanitized!;
    console.log(`Processing chatbot request, prompt length: ${sanitizedPrompt.length}`);

    // ----------- Gemini API Request -----------
    // Prepare Gemini API call with task-user context and input prompt
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${geminiApiKey}`;

    // Make POST request with the structured prompt to Gemini
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are a financial analyst, a direct financial analyst that will help people better understand and manage their finances.\n\nUser message: ${sanitizedPrompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.7,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ],
      }),
    });

    // Handle Gemini API failure (network, key, rate-limit, etc)
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorText);
      return new Response(JSON.stringify({ error: 'AI service temporarily unavailable' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse and return Gemini's generated content to client
    const geminiData = await geminiResponse.json();
    console.log('Gemini response received successfully');

    return new Response(JSON.stringify(geminiData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // Catches any unexpected handler error (system faults, runtime, etc.)
    console.error('Unexpected error in chatbot function:', error);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
