// src/shims/pm-state.js
import { pm } from "django-prose-editor/editor"

export const {
  EditorState,
  NodeSelection,
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  Transaction,
} = pm.state
