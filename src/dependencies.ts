import { OpenAIApi } from "openai";

export type Dependencies = {
  projectAbsolutePath: string;
  isNode: boolean
  openAI: OpenAIApi
  tsConfig: unknown
}