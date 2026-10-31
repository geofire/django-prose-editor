import { CodeBlockLowlight as BaseCodeBlockLowlight } from "@tiptap/extension-code-block-lowlight"
import { gettext, updateAttrsDialog } from "django-prose-editor/editor"
import { common, createLowlight } from "lowlight"

let sharedLowlight = null

// Create the lowlight instance lazily and share it between all editors
const defaultLowlight = () => {
  if (!sharedLowlight) sharedLowlight = createLowlight(common)
  return sharedLowlight
}

export const CodeBlockLowlight = BaseCodeBlockLowlight.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      lowlight: defaultLowlight(),
      // Optional list of language names offered in the language dialog,
      // defaults to all languages registered with lowlight.
      languages: null,
    }
  },

  addMenuItems(args) {
    // Keeps the "Code block" item defined by our CodeBlock extension
    this.parent?.(args)

    const { menu, buttons } = args
    const { lowlight, languages } = this.options
    const choices = ["", ...(languages || lowlight.listLanguages()).toSorted()]

    const languageDialog = updateAttrsDialog(
      {
        language: {
          title: gettext("Language"),
          enum: choices,
        },
      },
      {
        title: gettext("Code block language"),
      },
    )

    menu.defineItem({
      name: "codeBlockLanguage",
      groups: "nodes",
      button: buttons.material("data_object", gettext("Code block language")),
      async command(editor) {
        const current = editor.getAttributes(this.name || "codeBlock")
        const attrs = await languageDialog(editor, {
          language: current.language || "",
        })
        if (attrs) {
          editor
            .chain()
            .focus()
            .updateAttributes("codeBlock", { language: attrs.language || null })
            .run()
        }
      },
      hidden(editor) {
        return !editor.isActive("codeBlock")
      },
    })
  },
})
