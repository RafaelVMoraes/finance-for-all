import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildBudgetOptimizationPrompt,
  buildInvestmentReviewPrompt,
  buildMonthlyReviewPrompt,
} from '@/lib/analysisPrompts';
import {
  buildBudgetOptimizationContext,
  buildInvestmentReviewContext,
  buildMonthlyReviewContext,
} from '@/lib/buildAnalysisContext';
import { GeminiError, analyzeFinancialData } from '@/lib/gemini';
import type { UserSettings } from '@/hooks/useUserSettings';
import type { AnalysisResult, AnalysisType, FinancialContext } from '@/types/analysis';

interface UseGeminiAnalysisReturn {
  result: AnalysisResult | null;
  isLoading: boolean;
  error: GeminiError | null;
  trigger: () => Promise<void>;
  reset: () => void;
  lastGeneratedAt: Date | null;
}

interface PeriodInput {
  year: number;
  month: number;
}

type GeminiUserSettings = Partial<UserSettings> & {
  main_currency?: UserSettings['main_currency'];
  user_language?: string;
  language?: string;
};

const periodKey = (period: PeriodInput): string => `${period.year}-${period.month}`;

const buildContext = async (
  analysisType: AnalysisType,
  financialPeriod: PeriodInput,
  userSettings: GeminiUserSettings,
): Promise<FinancialContext> => {
  if (analysisType === 'monthly_review') {
    return buildMonthlyReviewContext(financialPeriod, userSettings);
  }

  if (analysisType === 'investment_review') {
    return buildInvestmentReviewContext(financialPeriod, userSettings);
  }

  return buildBudgetOptimizationContext(financialPeriod, userSettings);
};

const buildPrompt = (analysisType: AnalysisType, context: FinancialContext): string => {
  if (analysisType === 'monthly_review') {
    return buildMonthlyReviewPrompt(context);
  }

  if (analysisType === 'investment_review') {
    return buildInvestmentReviewPrompt(context);
  }

  return buildBudgetOptimizationPrompt(context);
};

const mapErrorCodeFromMessage = (message: string): GeminiError['code'] => {
  const lowered = message.toLowerCase();

  if (lowered.includes('api key') || lowered.includes('not configured')) return 'API_KEY_MISSING';
  if (lowered.includes('429') || lowered.includes('rate')) return 'RATE_LIMITED';
  if (lowered.includes('empty response')) return 'EMPTY_RESPONSE';
  if (lowered.includes('network') || lowered.includes('failed to fetch')) return 'NETWORK_ERROR';

  return 'UNKNOWN';
};

export function useGeminiAnalysis(
  analysisType: AnalysisType,
  financialPeriod: PeriodInput,
  userSettings: GeminiUserSettings | null,
): UseGeminiAnalysisReturn {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<GeminiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);
  const [cachedPeriodKey, setCachedPeriodKey] = useState<string | null>(null);

  const currentPeriodKey = useMemo(() => periodKey(financialPeriod), [financialPeriod]);

  useEffect(() => {
    if (cachedPeriodKey && cachedPeriodKey !== currentPeriodKey) {
      setResult(null);
      setError(null);
      setLastGeneratedAt(null);
      setCachedPeriodKey(null);
    }
  }, [cachedPeriodKey, currentPeriodKey]);

  const trigger = useCallback(async () => {
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      setError(
        new GeminiError(
          'Gemini API key is not configured. Add VITE_GEMINI_API_KEY to your environment.',
          'API_KEY_MISSING',
        ),
      );
      return;
    }

    if (result && cachedPeriodKey === currentPeriodKey) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const context = await buildContext(
        analysisType,
        financialPeriod,
        (userSettings || {}) as GeminiUserSettings,
      );
      const prompt = buildPrompt(analysisType, context);
      void prompt;

      const analysisResult = await analyzeFinancialData(analysisType, context);

      if (analysisResult.error) {
        const mapped = new GeminiError(
          analysisResult.error,
          mapErrorCodeFromMessage(analysisResult.error),
        );
        setError(mapped);
        setResult(null);
        return;
      }

      setResult(analysisResult);
      setCachedPeriodKey(currentPeriodKey);
      setLastGeneratedAt(new Date(analysisResult.generated_at));
    } catch (triggerError) {
      const mappedError =
        triggerError instanceof GeminiError
          ? triggerError
          : new GeminiError(
              triggerError instanceof Error ? triggerError.message : 'Unknown Gemini error',
              'UNKNOWN',
            );
      setError(mappedError);
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }, [analysisType, cachedPeriodKey, currentPeriodKey, financialPeriod, result, userSettings]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsLoading(false);
    setLastGeneratedAt(null);
    setCachedPeriodKey(null);
  }, []);

  return {
    result,
    isLoading,
    error,
    trigger,
    reset,
    lastGeneratedAt,
  };
}
