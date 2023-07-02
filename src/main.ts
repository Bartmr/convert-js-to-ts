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

const exec = promisify(_exec);

async function run(args: {
  typePackagesToAvoid: string[],
  projectAbsolutePath: string;
  jsFilesAbsolutePath?: string;
  isNode: boolean;
  directoriesToConvert?: string[],
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

  const jsFilePathsToConvert = tsConfig.files.filter((fileName) => {
    if(args.directoriesToConvert) {
      return fileName.endsWith(".js") && args.directoriesToConvert.some((directory) => fileName.startsWith(directory))
    } else {
      return fileName.endsWith(".js")
    }
  });

  await new Promise((resolve, reject) => {
    const childProcess = spawn(`node_modules/.bin/tsc --allowJS --checkJS false --noEmit false --declaration --emitDeclarationOnly --skipLibCheck`, {
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

  for (let i = 0; i < jsFilePathsToConvert.length; i++) {
    const jsFilePath = jsFilePathsToConvert[i] ?? throwError();

    const result = await mergeToTsFile({
      jsFileAbsolutePath: path.resolve(args.projectAbsolutePath, jsFilePath),
      projectAbsolutePath: args.projectAbsolutePath,
      openAI,
    });

    if (result.failed) {
      failures.push({
        filePath: jsFilePath,
        error: result.error,
      });
    }
  }

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
  typePackagesToAvoid: ["@types/yup"],
  projectAbsolutePath: path.resolve('test-targets/simple'),
  isNode: false,
  directoriesToConvert: undefined,
  tsConfig: {
    include: ["src"],
    exclude: ["node_modules"],
    compilerOptions: {
      lib: ["es2021"],
      module: "esnext",
      target: "esnext",

      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      moduleResolution: "node",

      noUncheckedIndexedAccess: true,
    },
  },
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
