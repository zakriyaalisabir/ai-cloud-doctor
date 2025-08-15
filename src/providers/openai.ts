import OpenAI from 'openai';

export interface OpenAIResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  cost?: number;
  model?: string;
}

export function makeOpenAI(config: any): { ask: (system: string, user: string) => Promise<OpenAIResponse> } {
  if (!config.openaiKey) {
    throw new Error("OPENAI_API_KEY missing.  Set it via environment variable or ~/.ai-cloud-doctor-configs.json");
  }

  const openai = new OpenAI({ apiKey: config.openaiKey });

  return {
    async ask(system: string, user: string): Promise<OpenAIResponse> {
      const requestBody: OpenAI.ChatCompletionCreateParams = {
        model: config.model || "gpt-5-nano",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        service_tier: config.serviceTier || 'flex', // 'flex' or 'standard' or "auto" or "priority"
        reasoning_effort: config.reasoningEffort || 'low',
        temperature: config.temperature || 1.0,
        verbosity: config.verbosity || 'low',
        max_completion_tokens: config.maxTokens || 0,
        prompt_cache_key: `ai-cloud-doctor-${config.model || 'gpt-5-nano'}`,
        n: 1, // Number of completions results to generate
      };

      try {
        const completion: OpenAI.ChatCompletion = await openai.chat.completions.create(requestBody);

        if (!completion.choices || completion.choices.length === 0) {
          return {
            content: "OpenAI returned no choices",
            inputTokens: 0,
            outputTokens: 0,
            cachedTokens: 0,
            cost: 0,
            model: "N/A"
          };
        }

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          return {
            content: `OpenAI returned empty content. Response: ${JSON.stringify(completion.choices[0])}`,
            inputTokens: 0,
            outputTokens: 0,
            cachedTokens: 0,
            cost: 0,
            model: "N/A"
          };
        }

        return {
          content,
          inputTokens: completion.usage?.prompt_tokens || 0,
          outputTokens: completion.usage?.completion_tokens || 0,
          cachedTokens: (completion as any).usage?.prompt_tokens_details?.cached_tokens || 0,
          cost: (completion as any).usage?.total_cost,
          model: completion.model
        };
      } catch (error) {
        return {
          content: `OpenAI API error: ${error instanceof Error ? error.message : String(error)}`,
          inputTokens: 0,
          outputTokens: 0,
          cachedTokens: 0,
          cost: 0,
          model: "N/A"
        };
      }
    },
  };
}