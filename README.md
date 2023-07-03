This project might be interesting for those dealing with legacy projects.

Very often, companies with a large plain Javascript want to migrate to TypeScript but don't want to spend time and resources on it. So, I decided to create a tool that automatically migrates JavaScript projects to TypeScript with the help of type declaration files and GPT-3.

It's very early-stage, but it has already helped me with some of my projects. Give it a try and let me know your opinion.

## How to use

- Go to `src/main.ts` and scroll to the bottom of the file. Set the following arguments:
  - `typePackagesToAvoid`: this script will look for `@types` declaration packages for the dependencies in your project. If you want to avoid some of those `@types` packages, write them down here
  - `projectAbsolutePath`: the absolute path for the project you want to convert to Typescript
  - `isNode`: does the project you want to convert runs in NodeJS
  - `directoriesToConvert`: if you don't want to convert all the files in your project right away (maybe you're just trying the tool, don't want to spend too many tokens, or want to migrate slowly), specify which directories you only want to convert.
    - Specifiy it as a relative path
      - example: `./src/directory`
  - `tsConfig`: setup your project's `tsconfig.json`. If you don't know what to set, [see these recommended `tsconfig` examples](https://github.com/tsconfig/bases)
- Create a `.env` file with the following content
  - ```
    OPENAI_API_KEY=your-open-ai-key
    ```
- Run `npm run start`
- Double check the changes created by this script
- Discard all `.d.ts` files, if any of them still exists
