import { writeFile } from "fs/promises";
import { Dependencies } from "../dependencies";
import { exec as _exec } from "child_process";
import { promisify } from "util";

const exec = promisify(_exec);

export async function setupProject({
  projectAbsolutePath,
  tsConfig
}: {
  projectAbsolutePath: string;
  tsConfig: unknown
}) {
  await exec(`npm install`, {
    cwd: projectAbsolutePath
  })
  
  await writeFile(`${projectAbsolutePath}/tsconfig.json`, JSON.stringify(tsConfig, undefined, 2), 'utf-8')

  await exec(`npm install typescript`, {
    cwd: projectAbsolutePath
  })


}