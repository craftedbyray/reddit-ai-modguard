import { settings } from '@devvit/web/server';

export interface AgentConfig {
  apiKey: string;
  baseUrl: string;
  modelName: string;
  rules: string;
}

/**
 * Fetches the Agent configuration from the native Devvit settings.
 */
export async function getAgentConfig(): Promise<AgentConfig> {
  const apiKey = await settings.get('apiKey') as string | undefined;
  const baseUrl = await settings.get('baseUrl') as string | undefined;
  const modelName = await settings.get('modelName') as string | undefined;
  const agentRules = await settings.get('agentRules') as string | undefined;

  return {
    apiKey: apiKey?.trim() || '',
    baseUrl: baseUrl?.trim() || 'https://api.openai.com/v1',
    modelName: modelName?.trim() || 'gpt-4o-mini',
    rules: agentRules?.trim() || ''
  };
}
