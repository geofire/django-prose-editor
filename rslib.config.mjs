import { promises as fs } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "@rslib/core"

const require = createRequire(import.meta.url)
const isProduction = process.env.NODE_ENV === "production"
const local = (path) => fileURLToPath(new URL(path, import.meta.url))

async function removeRuntimeOnlyFiles(distPath) {
  try {
    const files = await fs.readdir(distPath, { withFileTypes: true })

    for (const file of files) {
      if (file.isFile() && file.name.endsWith(".js")) {
        const filePath = join(distPath, file.name)
        const content = await fs.readFile(filePath, "utf-8")
        // Remove files that are empty or only contain the inlined webpack runtime
        // (generated as JS stubs for CSS-only entries)
        const exports = content.match(/export\{[^}]+\}/g)
        const isRuntimeOnly =
          content.trim() === "" ||
          (exports?.length === 1 &&
            /^export\{\w+ as __webpack_require__\}$/.test(exports[0]))
        if (isRuntimeOnly) {
          await fs.unlink(filePath)
          const mapPath = `${filePath}.map`
          await fs.unlink(mapPath).catch(() => {})
          console.log(`Removed runtime-only file: ${filePath}`)
        }
      }
    }
  } catch (error) {
    console.error(`Error removing runtime-only files: ${error.message}`)
  }
}

const commonConfig = {
  bundle: true,
  format: "esm",
  syntax: "es6",
  output: {
    autoExternal: false,
    distPath: {
      root: "django_prose_editor/static/django_prose_editor/",
      css: "",
      js: "",
      font: "",
    },
    filename: {
      js: "[name].js",
      css: "[name].css",
    },
    sourceMap: true,
    minify: isProduction,
    target: "web",
  },
}

export default defineConfig({
  lib: [
    {
      ...commonConfig,
      source: {
        entry: {
          editor: "./src/editor.js",
          overrides: "./src/overrides.css",
          "material-icons": "./src/material-icons.css",
        },
      },
    },
    // Editor presets
    {
      ...commonConfig,
      source: {
        entry: {
          default: "./src/default.js",
          configurable: "./src/configurable.js",
        },
      },
      output: {
        ...commonConfig.output,
        externals: {
          "django-prose-editor/editor": "module django-prose-editor/editor",
        },
        chunkLoading: "import",
      },
    },
    // Optional extensions, loaded on demand by the configurable preset
    {
      ...commonConfig,
      source: {
        entry: {
          codeblocklowlight: "./src/codeblocklowlight.js",
        },
      },
      resolve: {
        alias: {
          "@tiptap/extension-code-block$": local(
            "./src/shims/extension-code-block.js",
          ),
          "@tiptap/pm/state$": local("./src/shims/pm-state.js"),
          "@tiptap/pm/view$": local("./src/shims/pm-view.js"),
        },
      },
      output: {
        ...commonConfig.output,
        externals: {
          "django-prose-editor/editor": "module django-prose-editor/editor",
          "@tiptap/core": "module django-prose-editor/editor",
        },
      },
    },
  ],
  tools: {
    postcss: (opts) => {
      opts.postcssOptions.plugins = [require("autoprefixer")()]
    },
    rspack: {
      optimization: {
        runtimeChunk: false,
      },
      output: {
        devtoolModuleFilenameTemplate: (info) =>
          info.resourcePath.replace(`${process.cwd()}/`, ""),
      },
      plugins: [
        {
          apply: (compiler) => {
            compiler.hooks.afterDone.tap(
              "RemoveRuntimeOnlyFilesPlugin",
              async () => {
                await removeRuntimeOnlyFiles(commonConfig.output.distPath.root)
              },
            )
          },
        },
      ],
    },
  },
})
