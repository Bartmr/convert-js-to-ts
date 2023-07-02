import { throwError } from "./utils/throw-error";

export const EnvironmentVariables =  {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || throwError()
}