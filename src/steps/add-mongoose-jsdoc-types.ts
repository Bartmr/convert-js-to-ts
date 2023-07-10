import { OpenAIApi } from "openai";
import { forEachOfLimit} from 'async'
import path from "path";
import { readFile, writeFile } from "fs/promises";
import { throwError } from "../internals/utils/throw-error";

export async function addMongooseJSDocsTypes({
  jsFilePaths,
  projectAbsolutePath,
  openAI
} : {
  jsFilePaths: string[],
  projectAbsolutePath: string,
  openAI: OpenAIApi
}) {
  const mongooseFiles: Array<{
    filePath: string,
    text: string
  }> = []

  await forEachOfLimit(jsFilePaths, 4, async (jsFilePath) => {
    const fileContent = await readFile(path.resolve(projectAbsolutePath, jsFilePath), 'utf-8')

    if(fileContent.includes('mongoose') && fileContent.includes('Schema(')) {
      mongooseFiles.push({
        filePath: jsFilePath,
        text: fileContent
      })
    }
  })

  await forEachOfLimit(mongooseFiles, 4, async (mongooseFile) => {
    const promptResult = await openAI.createChatCompletion({
      temperature: 0,
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a code assistant that adds Typescript types as JSDocs." },
        { role: 'user',  content: `I have the following Javascript code with a Mongoose Schema and Model:

        ---
        ${mongooseFile.text}
        ---

        I want you to add types to the Schema and Model using JSDocs.
        
        Start with the code immediatly. Don't even put delimiters.`}
      ]
    });

    const newFileText = (promptResult.data.choices[0]?.message?.content || throwError())
    .split('\n').filter(line => {
      return !(line.startsWith('---') || line.startsWith('```'));
    }).join('\n')

    await writeFile(path.resolve(projectAbsolutePath, mongooseFile.filePath), newFileText)
  })
}