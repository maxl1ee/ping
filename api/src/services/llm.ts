// LLM Service — Claude Haiku for chat + signal extraction
import logger from '../lib/logger';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const DEFAULT_MODEL = 'claude-3-haiku-20240307';

export interface LLMResponse {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
}

export async function generateCompletion(
  system: string,
  user: string,
  options: { temperature?: number; maxTokens?: number; model?: string } = {}
): Promise<LLMResponse> {
  const response = await anthropic.messages.create({
    model: options.model || DEFAULT_MODEL,
    max_tokens: options.maxTokens || 1024,
    temperature: options.temperature ?? 0.7,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const content = response.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('');

  return {
    content: content.trim(),
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

export async function generateJSON<T>(
  system: string,
  user: string,
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<T> {
  const response = await generateCompletion(
    `${system}\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no explanations.`,
    user,
    { ...options, maxTokens: options.maxTokens || 2048 }
  );

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    const jsonString = jsonMatch ? jsonMatch[0] : response.content;
    return JSON.parse(jsonString) as T;
  } catch (error) {
    logger.error({ err: error, content: response.content }, 'Failed to parse LLM JSON');
    throw new Error(`Invalid JSON from LLM: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}
