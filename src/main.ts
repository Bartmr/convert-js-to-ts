import "./internals/load-environment-variables";

import { exec as _exec, spawn } from "child_process";
import { promisify } from "util";
import { installTypeDeclarationDependencies } from "./steps/install-type-declaration-dependencies";
import { Configuration, OpenAIApi } from "openai";
import { EnvironmentVariables } from "./internals/environment-variables";
import { setupProject } from "./steps/setup-project";
import { mergeToTsFile } from "./steps/merge-to-ts-file";
import path from "path";
import { rm, writeFile } from "fs/promises";
import { throwError } from "./internals/utils/throw-error";
import { addMongooseJSDocsTypes } from "./steps/add-mongoose-jsdoc-types";
import { forEachLimit } from "async";

const exec = promisify(_exec);

async function run(args: {
  typePackagesToAvoid: string[],
  projectAbsolutePath: string;
  jsFilesAbsolutePath?: string;
  isNode: boolean;
  directoriesToConvert?: string,
  tsConfig: unknown;
}) {
  const openAI = new OpenAIApi(
    new Configuration({
      apiKey: EnvironmentVariables.OPENAI_API_KEY,
    })
  );

  await setupProject({
    projectAbsolutePath: args.projectAbsolutePath,
    tsConfig: args.tsConfig,
  });

  await installTypeDeclarationDependencies({
    typePackagesToAvoid: args.typePackagesToAvoid,
    projectAbsolutePath: args.projectAbsolutePath,
    isNode: args.isNode,
  });

  const tscShowConfigResult = await exec(
    `node_modules/.bin/tsc --allowJS --checkJS false --showConfig`,
    {
      cwd: args.projectAbsolutePath,
    }
  );

  const tsConfig = JSON.parse(tscShowConfigResult.stdout) as {
    files: string[];
  };

  const tsFilePaths = tsConfig.files.filter((fileName) =>
    fileName.endsWith(".ts")
  );

  const jsFilePathsToConvert = tsConfig.files.filter((fileName) => fileName.endsWith(".js"));

  await addMongooseJSDocsTypes({
    jsFilePaths: jsFilePathsToConvert,
    projectAbsolutePath: args.projectAbsolutePath,
    openAI
  })

  await new Promise((resolve, reject) => {
    const childProcess = spawn(`node_modules/.bin/tsc --allowJS --checkJS false --noEmit false --declaration --emitDeclarationOnly --skipLibCheck --outDir null`, {
      cwd: args.projectAbsolutePath,
      shell: '/bin/bash'
    });

    childProcess.stdout.on('data', (data) => {
      console.info(`stdout: ${data}`);
    });

    childProcess.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });

    childProcess.on('close', (code) => {
      if(code !== 0) {
        reject(new Error())
      } else {
        resolve(undefined)
      }
    });
  })

  await Promise.all(tsFilePaths.map((tsFilePath) => {
    const declarationFile = path.resolve(args.projectAbsolutePath, tsFilePath).replace(/(.*)\.ts$/, '$1.d.ts')

    rm(declarationFile)
  }))

  const failures: Array<{
    filePath: string;
    error: unknown;
  }> = [];

  await forEachLimit(jsFilePathsToConvert, 4, async (jsFilePath) => {
    const result = await mergeToTsFile({
      jsFilePath: jsFilePath,
      projectAbsolutePath: args.projectAbsolutePath,
      openAI,
    });

    if (result.failed) {
      failures.push({
        filePath: jsFilePath,
        error: result.error,
      });
    }
  })

  if(failures.length > 0) {
    await writeFile(
      path.resolve("./errors.log"),
      JSON.stringify(
        {
          files: failures.map((f) => f.filePath),
          failures,
        },
        undefined,
        2
      ),
      "utf-8"
    );
  }
}

run({
  typePackagesToAvoid: [''],
  projectAbsolutePath: path.resolve(
    './../int-rezcomm-carpark'
  ),
  isNode: true,
  directoriesToConvert: path.resolve(
    './../int-rezcomm-carpark/src'
  ),
  tsConfig: {
    include: ['src/**/*'],
    exclude: ['node_modules'],
    compilerOptions: {
      target: 'es2022',
      module: 'commonjs',
      outDir: './dist',
      rootDir: './src',
      allowJs: true,
      forceConsistentCasingInFileNames: true,
      strictPropertyInitialization: true,
      allowSyntheticDefaultImports: true,
      useUnknownInCatchVariables: false,
      emitDecoratorMetadata: true,
      experimentalDecorators: true,
      noImplicitOverride: true,
      noImplicitReturns: true,
      resolveJsonModule: true,
      esModuleInterop: true,
      removeComments: true,
      noImplicitAny: true,
      skipLibCheck: true,
      sourceMap: true,
      strict: true
    }
  }
}).catch((err) => {
  console.error(err)
  process.exit(1)
})
