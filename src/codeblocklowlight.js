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
    // Read the node name here; the menu calls command() without `this`
    const nodeName = this.name
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
      command(editor) {
        const current = editor.getAttributes(nodeName)
        languageDialog(editor, { language: current.language || "" })
          .then((attrs) => {
            if (attrs) {
              editor
                .chain()
                .focus()
                .updateAttributes(nodeName, { language: attrs.language || null })
                .run()
            }
          })
          .catch((error) => {
            console.error("CodeBlockLowlight: language dialog failed", error)
          })
      },
      hidden(editor) {
        return !editor.isActive(nodeName)
      },
    })
  },
})
