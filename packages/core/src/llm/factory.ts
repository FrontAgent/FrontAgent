import type { LLMConfig } from '../types.js';
import { LLMService } from './llm-service.js';

export function createLLMService(config: LLMConfig): LLMService {
  return new LLMService(config);
}
