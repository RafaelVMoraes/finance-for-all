import { supabase } from '@/integrations/supabase/client';
import {
  buildBudgetOptimizationPrompt,
  buildInvestmentReviewPrompt,
  buildMonthlyReviewPrompt,
} from '@/lib/analysisPrompts';
import type { AnalysisResult, AnalysisType, FinancialContext } from '@/types/analysis';

const SYSTEM_CONTEXT_PREFIX = `You are a personal finance analyst. You receive structured financial data and return
clear, specific, and actionable insights. Always base your analysis strictly on the
numbers provided. Never invent data. Be concise — maximum 4 paragraphs.
Respond in the same language as the user_language field in the input.`;

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'API_KEY_MISSING'
      | 'NETWORK_ERROR'
      | 'EMPTY_RESPONSE'
      | 'RATE_LIMITED'
      | 'UNKNOWN',
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

const buildAnalysisPrompt = (analysisType: AnalysisType, context: FinancialContext): string => {
  if (analysisType === 'monthly_review') return buildMonthlyReviewPrompt(context);
  if (analysisType === 'investment_review') return buildInvestmentReviewPrompt(context);
  return buildBudgetOptimizationPrompt(context);
};

const mapGeminiError = (error: unknown): GeminiError => {
  const message = error instanceof Error ? error.message : 'Unknown Gemini error';
  const lowered = message.toLowerCase();

  if (lowered.includes('not configured') || lowered.includes('api key')) {
    return new GeminiError(message, 'API_KEY_MISSING');
  }

  if (lowered.includes('429') || lowered.includes('rate')) {
    return new GeminiError(message, 'RATE_LIMITED');
  }

  if (lowered.includes('failed to fetch') || lowered.includes('network')) {
    return new GeminiError(message, 'NETWORK_ERROR');
  }

  return new GeminiError(message, 'UNKNOWN');
};

export async function callGemini(prompt: string): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke<GeminiResponse>('GEMINI-API-CALL', {
      body: { prompt },
    });

    if (error) {
      throw mapGeminiError(error);
    }

    const responseText = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text?.trim() || '')
      .join('\n')
      .trim();

    if (!responseText) {
      throw new GeminiError('Gemini returned an empty response', 'EMPTY_RESPONSE');
    }

    return responseText;
  } catch (error) {
    if (error instanceof GeminiError) {
      throw error;
    }

    throw mapGeminiError(error);
  }
}

export async function analyzeFinancialData(
  analysisType: AnalysisType,
  context: FinancialContext,
): Promise<AnalysisResult> {
  const generatedAt = new Date().toISOString();
  const resultBase: AnalysisResult = {
    analysis_type: analysisType,
    period_label: context.period_label,
    narrative: '',
    generated_at: generatedAt,
  };

  try {
    const analysisPrompt = buildAnalysisPrompt(analysisType, context);
    const fullPrompt = `${SYSTEM_CONTEXT_PREFIX}\n\n${analysisPrompt}`;
    const narrative = await callGemini(fullPrompt);

    return {
      ...resultBase,
      narrative,
    };
  } catch (error) {
    const geminiError = error instanceof GeminiError ? error : mapGeminiError(error);

    return {
      ...resultBase,
      error: geminiError.message,
      narrative: '',
    };
  }
}
