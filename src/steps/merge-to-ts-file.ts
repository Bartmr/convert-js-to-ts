import { readFile, rm, writeFile } from "fs/promises";
import { throwError } from "../internals/utils/throw-error";
import { OpenAIApi } from "openai";
import path from "path";

export async function mergeToTsFile({
  jsFilePath,
  projectAbsolutePath,
  openAI
}: {
  jsFilePath: string;
  projectAbsolutePath: string;
  openAI: OpenAIApi
}): Promise<{ failed: false; } | { failed: true, error: unknown }> {
  const jsFileAbsolutePath = path.resolve(projectAbsolutePath, jsFilePath);
  
  const jsFileContent = await readFile(jsFileAbsolutePath, "utf-8");

  const dtsFileAbsolutePath =
    jsFileAbsolutePath.slice(0, jsFileAbsolutePath.lastIndexOf(".js")) +
    ".d.ts";
  const typeDeclarationFileContent = await readFile(
    dtsFileAbsolutePath,
    "utf-8"
  );

  const prompt = `I have the following Javascript code:

---
${jsFileContent}
---

I also have the type declarations for this code:
---
${typeDeclarationFileContent}
---

Merge the two of them into a Typescript file.

Convert namespaces into object literals, but do not convert classes into object literals.

Respond ONLY with the TypeScript code, and nothing else. Start with the code immediatly. Don't even put delimiters.`;



  let promptResult:  Awaited<ReturnType<typeof openAI['createChatCompletion']>>;

  try {
    console.log(`Converting ${jsFileAbsolutePath}...`)
    promptResult = await openAI.createChatCompletion({
      temperature: 0,
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a code refactoring assistant." },
        { role: 'user',  content: prompt}
      ]
    });
  } catch (error) {
    return {
      failed: true,
      error
    }
  }

  const tsFileAbsolutePath =
    jsFileAbsolutePath.slice(0, jsFileAbsolutePath.lastIndexOf(".js")) + ".ts";

  const tsFileContent = (promptResult.data.choices[0]?.message?.content || throwError())
  .split('\n').filter(line => {
    return !(line.startsWith('---') || line.startsWith('```'));
  }).join('\n')

  await writeFile(tsFileAbsolutePath, tsFileContent, 'utf-8')

  await rm(jsFileAbsolutePath)
  await rm(dtsFileAbsolutePath)

  return {
    failed: false
  }
}
