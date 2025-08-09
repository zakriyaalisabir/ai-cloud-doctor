/**
 * Very lightweight stub of an OpenAI client.  Since network access is
 * unavailable in this environment, this implementation simply echoes
 * the user's input.  When a real OpenAI API key is provided and network
 * connectivity is available, this function could be extended to call
 * the OpenAI REST API.
 */
export function makeOpenAI(openaiKey: string | undefined, model?: string) {
  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY missing.  Set it via environment variable or ~/.ai-cloud-doctor-configs.json");
  }
  // model is ignored in this stub but accepted for compatibility
  return {
    async ask(system: string, user: string): Promise<string> {
      // In a real implementation, you would make a network request here.
      const promptPreview = system?.trim().slice(0, 32).replace(/\n/g, " ");
      const userPreview = user?.trim().slice(0, 64).replace(/\n/g, " ");
      return `OpenAI stub response based on system prompt: "${promptPreview}" and user input: "${userPreview}".`;
    },
  };
}