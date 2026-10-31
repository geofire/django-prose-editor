import { CodeBlockLowlight as BaseCodeBlockLowlight } from "@tiptap/extension-code-block-lowlight"
import {
  gettext,
  mergeAttributes,
  updateAttrsDialog,
} from "django-prose-editor/editor"
import { common, createLowlight } from "lowlight"

let sharedLowlight = null

// Create the lowlight instance lazily and share it between all editors
const defaultLowlight = () => {
  if (!sharedLowlight) sharedLowlight = createLowlight(common)
  return sharedLowlight
}

// Convert lowlight's hast nodes into a ProseMirror DOMOutputSpec
const hastToDOMSpec = (nodes) =>
  nodes.map((node) =>
    node.type === "element"
      ? [
          "span",
          { class: node.properties?.className?.join(" ") || null },
          ...hastToDOMSpec(node.children || []),
        ]
      : node.value || "",
  )

const highlightTokens = (lowlight, language, code) => {
  try {
    const tree =
      language && lowlight.registered?.(language)
        ? lowlight.highlight(language, code)
        : lowlight.highlightAuto(code)
    return hastToDOMSpec(tree.children)
  } catch (error) {
    console.error("CodeBlockLowlight: highlighting failed", error)
    return [code]
  }
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

  // Used for the serialized HTML (getHTML(), clipboard). Bakes the syntax
  // highlighting into the output so that highlight.js themes work on the
  // frontend without running highlight.js there.
  renderHTML({ node, HTMLAttributes }) {
    const { lowlight, languageClassPrefix, defaultLanguage } = this.options
    const language = node.attrs.language || defaultLanguage
    const classes = ["hljs"]
    if (node.attrs.language) {
      classes.push(`${languageClassPrefix}${node.attrs.language}`)
    }
    return [
      "pre",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      [
        "code",
        { class: classes.join(" ") },
        ...highlightTokens(lowlight, language, node.textContent),
      ],
    ]
  },

  // renderHTML above has no content hole, so the editor needs its own
  // editable DOM. Highlighting inside the editor is done by decorations.
  addNodeView() {
    const options = this.options
    return ({ node, HTMLAttributes }) => {
      const dom = document.createElement("pre")
      const attrs = mergeAttributes(options.HTMLAttributes, HTMLAttributes)
      for (const [name, value] of Object.entries(attrs)) {
        if (value != null) dom.setAttribute(name, value)
      }
      const contentDOM = document.createElement("code")
      if (node.attrs.language) {
        contentDOM.className = `${options.languageClassPrefix}${node.attrs.language}`
      }
      dom.append(contentDOM)

      return {
        dom,
        contentDOM,
        // Recreate the node view when attributes (e.g. language) change
        update: (updatedNode) => updatedNode.hasMarkup(node.type, node.attrs),
      }
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
