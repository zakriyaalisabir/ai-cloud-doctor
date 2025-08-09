import OpenAI from 'openai';

export function makeOpenAI(openaiKey: string | undefined, model = "gpt-5-nano", maxTokens = 500) {
  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY missing.  Set it via environment variable or ~/.ai-cloud-doctor-configs.json");
  }
  
  const openai = new OpenAI({ apiKey: openaiKey });
  
  return {
    async ask(system: string, user: string): Promise<string> {
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
          return "OpenAI returned no choices";
        }
        
        const content = completion.choices[0]?.message?.content;
        if (!content) {
          return `OpenAI returned empty content. Response: ${JSON.stringify(completion.choices[0])}`;
        }
        
        return content;
      } catch (error) {
        return `OpenAI API error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  };
}