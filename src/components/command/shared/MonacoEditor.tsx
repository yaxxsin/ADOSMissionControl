"use client";

/**
 * @module MonacoEditor
 * @description Monaco editor wrapper with Python highlighting and ADOS SDK autocomplete.
 * @license GPL-3.0-only
 */

import { useRef, useEffect } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Play, Square, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onSave: () => void;
  isRunning: boolean;
  fileName: string;
}

export function MonacoEditorPanel({
  value,
  onChange,
  onRun,
  onSave,
  isRunning,
  fileName,
}: MonacoEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Define dark theme
    monaco.editor.defineTheme("ados-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6a737d" },
        { token: "keyword", foreground: "3A82FF" },
        { token: "string", foreground: "DFF140" },
        { token: "number", foreground: "DFF140" },
      ],
      colors: {
        "editor.background": "#0A0A0F",
        "editor.foreground": "#E8E8ED",
        "editorLineNumber.foreground": "#4A4A5A",
        "editorLineNumber.activeForeground": "#8A8A9A",
        "editor.selectionBackground": "#3A82FF30",
        "editor.lineHighlightBackground": "#1A1A25",
        "editorCursor.foreground": "#3A82FF",
      },
    });
    monaco.editor.setTheme("ados-dark");

    // Register ADOS SDK completions
    import("./ados-sdk-completions").then(({ createAdosSdkCompletionProvider }) => {
      monaco.languages.registerCompletionItemProvider(
        "python",
        createAdosSdkCompletionProvider()
      );
    });
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    // Ctrl/Cmd+S to save
    editor.addCommand(2097 /* KeyMod.CtrlCmd | KeyCode.KeyS */, () => {
      onSave();
    });
  }, [onSave]);

  return (
    <div className="flex flex-col flex-1 min-w-0 border border-border-default rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-secondary border-b border-border-default">
        <span className="text-xs text-text-secondary font-mono truncate flex-1">
          {fileName}
        </span>
        <button
          onClick={onSave}
          className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
          title="Save (Ctrl+S)"
        >
          <Save size={12} />
          Save
        </button>
        <button
          onClick={onRun}
          disabled={isRunning}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors",
            isRunning
              ? "bg-status-error/20 text-status-error"
              : "bg-status-success/20 text-status-success hover:bg-status-success/30"
          )}
        >
          {isRunning ? <Square size={12} /> : <Play size={12} />}
          {isRunning ? "Running..." : "Run"}
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-[200px]">
        <Editor
          defaultLanguage="python"
          value={value}
          onChange={(v) => onChange(v ?? "")}
          onMount={handleMount}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', monospace",
            minimap: { enabled: false },
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            bracketPairColorization: { enabled: true },
            automaticLayout: true,
            padding: { top: 8 },
            renderLineHighlight: "line",
            tabSize: 4,
            wordWrap: "on",
          }}
          theme="ados-dark"
        />
      </div>
    </div>
  );
}
