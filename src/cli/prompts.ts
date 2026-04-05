import inquirer from 'inquirer';
import { ConversionOptions, LLMProvider, UnsupportedStrategy } from '../types';

export interface CLIAnswers {
  provider: LLMProvider;
  unsupportedStrategy: UnsupportedStrategy;
  confirmOverwrite: boolean;
}

/**
 * Ask the user interactive questions before starting conversion.
 * Returns the answers merged with the base options.
 */
export async function askConversionOptions(
  base: Omit<ConversionOptions, 'provider' | 'unsupportedStrategy'>,
  outputExists: boolean,
): Promise<CLIAnswers> {
  const questions = [];

  questions.push({
    type: 'list',
    name: 'provider',
    message: 'Which LLM provider should model aliases be mapped to?',
    choices: [
      {
        name: 'Anthropic (Claude) — recommended',
        value: 'anthropic',
      },
      {
        name: 'OpenAI (GPT)',
        value: 'openai',
      },
      {
        name: 'Google (Gemini)',
        value: 'google',
      },
    ],
    default: 'anthropic',
  });

  questions.push({
    type: 'list',
    name: 'unsupportedStrategy',
    message: 'How should unsupported content (hooks, path-based rules) be handled?',
    choices: [
      {
        name: 'Copy to _unsupported/ and document in MIGRATION-REPORT.md',
        value: 'copy-and-report',
      },
      {
        name: 'Skip and only mention in MIGRATION-REPORT.md',
        value: 'report-only',
      },
    ],
    default: 'copy-and-report',
  });

  if (outputExists) {
    questions.push({
      type: 'confirm',
      name: 'confirmOverwrite',
      message: `Output directory already exists. Files will be overwritten. Continue?`,
      default: false,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const answers = await inquirer.prompt(questions as any);

  return {
    provider: answers['provider'] as LLMProvider,
    unsupportedStrategy: answers['unsupportedStrategy'] as UnsupportedStrategy,
    confirmOverwrite: outputExists ? (answers['confirmOverwrite'] as boolean) : true,
  };
}
