"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { applyTheme, THEME_STORAGE_KEY, ThemeConfig } from "@/lib/theme";
import { parseImportText } from "@/lib/import";

const MAX_IMPORT_FILE_BYTES = 4 * 1024 * 1024;

export default function ImportPage() {
  const [jsonText, setJsonText] = useState("");
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pasteDetailsRef = useRef<HTMLDetailsElement>(null);

  const handleImport = async () => {
    if (!jsonText.trim()) {
      setError("Choose a JSON backup file or paste your JSON export first.");
      return;
    }

    let parsed: unknown;
    try {
      parsed = parseImportText(jsonText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON. Check the file contents and try again.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed");
      } else {
        let settingsWarning = "";
        if (data.settings) {
          try {
            const theme = data.settings.theme as ThemeConfig;
            localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
            applyTheme(theme);

            const collapsed = data.settings.collapsedCategories as Record<string, boolean>;
            localStorage.setItem("church-tech-collapsed-v1", JSON.stringify(collapsed));
          } catch {
            settingsWarning = " Records were imported, but device settings could not be saved in this browser.";
          }
        }
        setResult(`${data.message || "Import successful!"}${settingsWarning}`);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadFile = async (file?: File, input?: HTMLInputElement) => {
    if (!file) return;

    setError(null);
    setResult(null);
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setError("Backup file is too large. Choose a JSON file smaller than 4 MB.");
      if (input) input.value = "";
      return;
    }
    if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
      setError("Choose a .json backup file.");
      if (input) input.value = "";
      return;
    }

    try {
      const text = await file.text();
      parseImportText(text);
      setJsonText(text.replace(/^\uFEFF/, ""));
      setFileName(file.name);
      if (pasteDetailsRef.current) pasteDetailsRef.current.open = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read this backup file.");
      setFileName("");
      if (input) input.value = "";
    }
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await loadFile(event.target.files?.[0], event.target);
  };

  return (
    <main>
      <div className="page-title-row">
        <h1>Import Checklist Data</h1>
        <Link href="/" className="text">
          &larr; Back to Checklist
        </Link>
      </div>

      <p className="sub">
        Upload a JSON backup or paste a Church Tech Checklist backup or legacy export.
        Categories, tasks,
        history, and the current week are imported to the database; device theme and
        collapsed-category settings are restored in this browser. Re-importing updates
        matching IDs instead of duplicating them.
      </p>

      <div className="addcard">
        <div
          className={`import-dropzone${isDragging ? " is-dragging" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setIsDragging(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            void loadFile(event.dataTransfer.files[0]);
          }}
        >
          <input
            id="backupFile"
            className="import-file-input"
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelected}
          />
          <label className="import-dropzone-label" htmlFor="backupFile">
            <span className="import-dropzone-icon" aria-hidden="true">↑</span>
            <span className="import-dropzone-title">Drop your JSON backup here</span>
            <span className="import-dropzone-or">or</span>
            <span className="import-file-button">Choose a file</span>
            <span className="import-dropzone-hint">JSON backup · up to 4 MB</span>
          </label>
        </div>
        <p className="import-file-hint" aria-live="polite">
          {fileName ? `Selected: ${fileName}. Review the JSON below, then import.` : ""}
        </p>
        <details className="import-paste" ref={pasteDetailsRef}>
          <summary>{fileName ? "Review or edit JSON" : "Or paste JSON instead"}</summary>
          <textarea
            rows={12}
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setFileName("");
            }}
            placeholder='{"format":"church-tech-checklist-backup","formatVersion":1,"data":{...},"settings":{...}}'
            className="import-textarea"
          />
        </details>

        {error && (
          <p className="form-message error" role="alert">
            {error}
          </p>
        )}

        {result && (
          <p className="form-message success" role="status">
            {result}
          </p>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn"
            disabled={loading}
            onClick={handleImport}
          >
            {loading ? "Importing..." : "Import"}
          </button>
        </div>
      </div>
    </main>
  );
}
