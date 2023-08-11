import { readFile } from "fs/promises";
import { exec as _exec } from "child_process";
import { promisify } from "util";
import { glob } from "glob";

const exec = promisify(_exec);

export async function installTypeDeclarationDependencies(
  {
    typePackagesToAvoid,
    projectAbsolutePath,
    isNode,
  }: {
    typePackagesToAvoid: string[],
    projectAbsolutePath: string;
    isNode: boolean
  }
) {
  const packageJsonContentString = await readFile(
    `${projectAbsolutePath}/package.json`,
    "utf-8"
  );
  const packageJson = JSON.parse(packageJsonContentString) as {
    dependencies?: { [packageName: string]: string };
    devDependencies?: { [packageName: string]: string };
  };

  if(isNode) {
    await exec(`npm install @types/node`, {
      cwd: projectAbsolutePath
    })
  }

  for (const [dependencyName, dependencyVersion] of Object.entries({
    ...packageJson.devDependencies ,
    ...packageJson.dependencies
  })) {
    if (dependencyName.startsWith("@types/")) {
      console.info(`${dependencyName} already is a @types package`)
      continue;
    }

    const dependencyPath = `${projectAbsolutePath}/node_modules/${dependencyName}`;
    const dtsFiles = await glob(`${dependencyPath}/**/*.d.ts`, {
      ignore: `${dependencyPath}/node_modules/**`,
    });

    if (dtsFiles.length > 0) {
      console.info(`${dependencyName} already has declaration files`)
      continue;
    }

    const typesDependencyName = `@types/${dependencyName.replace(/@/g, '').replace(/\//g, '__')}`;

    if(typePackagesToAvoid.includes(typesDependencyName)) {
      console.info(`${typesDependencyName} is in typePackagesToAvoid`)
      continue
    }

    try {
      console.log(`Installing ${typesDependencyName}`)
      await exec(`npm install ${typesDependencyName}`, {
        cwd: projectAbsolutePath
      })
    } catch (_error) {
      const error = _error as {[key: string]: unknown}

      if(typeof error.stderr === 'string' && error.stderr.includes('npm ERR! code E404')) {
        console.info(`${dependencyName} as no @types/${dependencyName} available`);
      } else {
        throw error
      }
    }
  }
}