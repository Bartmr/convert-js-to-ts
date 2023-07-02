## How to use

- Go to `src/main.ts` and scroll to the bottom of the file. Set the following arguments:
  - `typePackagesToAvoid`: this script will look for `@types` declaration packages for the dependencies your project uses. If you want to avoid some of those `@types` packages, write them down here
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
