import OpenAI from 'openai';

export interface OpenAIResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  cost?: number;
  model?: string;
}

export function makeOpenAI(openaiKey: string | undefined, model = "gpt-5-nano", maxTokens = 500): { ask: (system: string, user: string) => Promise<OpenAIResponse> } {
  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY missing.  Set it via environment variable or ~/.ai-cloud-doctor-configs.json");
  }
  
  const openai = new OpenAI({ apiKey: openaiKey });
  
  return {
    async ask(system: string, user: string): Promise<OpenAIResponse> {
      const requestBody: any = {
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      };

      if (model.startsWith('gpt-5')) {
        requestBody.temperature = 1;
        requestBody.max_completion_tokens = maxTokens;
      } else {
        requestBody.max_tokens = maxTokens;
        requestBody.temperature = 0.7;
      }

      try {
        const completion = await openai.chat.completions.create(requestBody);
        
        if (!completion.choices || completion.choices.length === 0) {
          return {
            content: "OpenAI returned no choices",
            inputTokens: 0,
            outputTokens: 0
          };
        }
        
        const content = completion.choices[0]?.message?.content;
        if (!content) {
          return {
            content: `OpenAI returned empty content. Response: ${JSON.stringify(completion.choices[0])}`,
            inputTokens: 0,
            outputTokens: 0
          };
        }
        
        return {
          content,
          inputTokens: completion.usage?.prompt_tokens || 0,
          outputTokens: completion.usage?.completion_tokens || 0,
          cost: (completion as any).usage?.total_cost,
          model: completion.model
        };
      } catch (error) {
        return {
          content: `OpenAI API error: ${error instanceof Error ? error.message : String(error)}`,
          inputTokens: 0,
          outputTokens: 0
        };
      }
    },
  };
}