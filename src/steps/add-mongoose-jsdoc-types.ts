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
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a code assistant that adds types Javascript code with JSDocs." },
        { role: 'user',  content: `I want to add Typescript typings to Mongoose Schemas and Models as JSDocs, so I can output declaration giles later.
        
Here's an example of how you should do it.

The original code:

\`\`\`
const mongoose = require("mongoose");

const ASSETS_SCHEMA = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    bytes: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);


const Assets = mongoose.model("assets", ASSETS_SCHEMA);
\`\`\`

The code with added types as JSDocs

\`\`\`
const mongoose = require("mongoose");

/**
  * @typedef {{
  *  _id: import('mongoose').Schema.Types.ObjectId,
  *  url: string,
  *  bytes: number,
  *  createdAt: Date,
  *  updatedAt: Date,
  *}} Asset
  * @type {import('mongoose').Schema<Asset>}
 */
const ASSETS_SCHEMA = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    bytes: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * @type {import('mongoose').Model<Asset, {}, {}, {}>}
 */
const Assets = mongoose.model("assets", ASSETS_SCHEMA);
\`\`\`

I want you to convert the code below as I did in the example above

\`\`\`
${mongooseFile.text}
\`\`\`

Start with the code immediatly. Don't even put delimiters. I repeat, DO NOT PREFIX ANYTHING. JUST OUTPUT VALID JAVASCRIPT`},
      ]
    });

    const newFileText = (promptResult.data.choices[0]?.message?.content || throwError())
    .split('\n').filter(line => {
      return !(line.startsWith('---') || line.startsWith('```'));
    }).join('\n')

    await writeFile(path.resolve(projectAbsolutePath, mongooseFile.filePath), newFileText)
  })
}