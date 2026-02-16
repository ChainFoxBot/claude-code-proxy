/**
 * Format converter for OpenRouter (OpenAI format) <-> Anthropic format
 */

// OpenAI-compatible format (used by OpenRouter)
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Anthropic format
export interface AnthropicContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: any;
}

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  system?: string;
  tools?: any;
  tool_choice?: any;
}

export interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{ type: string; text: string }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Detect if provider uses OpenAI format (deprecated - use provider.format instead)
 */
export function isOpenAIFormat(baseUrl: string): boolean {
  return baseUrl.includes('/chat/completions') || baseUrl.includes('openrouter');
}

/**
 * Convert Anthropic format request to OpenAI format
 */
export function convertAnthropicToOpenAI(anthropic: AnthropicRequest): OpenAIRequest {
  const messages: OpenAIMessage[] = [];

  // Add system message first if present
  if (anthropic.system) {
    messages.push({
      role: 'system',
      content: anthropic.system,
    });
  }

  // Convert messages
  for (const msg of anthropic.messages) {
    let content = '';

    // Handle content as string or array of blocks
    if (typeof msg.content === 'string') {
      content = msg.content;
    } else if (Array.isArray(msg.content)) {
      // Concatenate text blocks
      content = msg.content
        .map(block => block.type === 'text' ? (block.text || '') : '')
        .filter(Boolean)
        .join('\n');
    }

    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content,
    });
  }

  const result: OpenAIRequest = {
    model: anthropic.model,
    messages,
  };

  // Only add parameters if they have defined values
  if (anthropic.max_tokens !== undefined) result.max_tokens = anthropic.max_tokens;
  if (anthropic.temperature !== undefined) result.temperature = anthropic.temperature;
  if (anthropic.top_p !== undefined) result.top_p = anthropic.top_p;
  if (anthropic.stream !== undefined) result.stream = anthropic.stream;

  return result;
}

/**
 * Convert OpenAI format response to Anthropic format
 */
export function convertOpenAIToAnthropic(openai: OpenAIResponse, originalModel: string): AnthropicResponse {
  const choice = openai.choices[0];
  if (!choice) {
    throw new Error('No choices in OpenAI response');
  }

  return {
    id: `msg_${openai.id}`,
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: choice.message.content,
      },
    ],
    model: originalModel,
    stop_reason: choice.finish_reason === 'stop' ? 'end_turn' : choice.finish_reason,
    usage: {
      input_tokens: openai.usage.prompt_tokens,
      output_tokens: openai.usage.completion_tokens,
    },
  };
}

/**
 * Extract content from Anthropic message for OpenAI format
 */
function extractContent(content: string | Array<{ type: string; text?: string; source?: any }>): string {
  if (typeof content === 'string') {
    return content;
  }
  return content
    .map(block => block.type === 'text' ? (block.text || '') : '')
    .filter(Boolean)
    .join('\n');
}
