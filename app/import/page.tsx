"use client";

import React, { useState } from "react";
import Link from "next/link";
import { applyTheme, THEME_STORAGE_KEY, ThemeConfig } from "@/lib/theme";

export default function ImportPage() {
  const [jsonText, setJsonText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!jsonText.trim()) {
      setError("Please paste your JSON export first.");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText.trim());
    } catch (err) {
      setError(`Invalid JSON: ${err instanceof Error ? err.message : "Unable to parse input"}`);
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

  return (
    <main>
      <div className="page-title-row">
        <h1>Import Checklist Data</h1>
        <Link href="/" className="text">
          &larr; Back to Checklist
        </Link>
      </div>

      <p className="sub">
        Paste a Church Tech Checklist backup JSON or a legacy export. Categories, tasks,
        history, and the current week are imported to the database; device theme and
        collapsed-category settings are restored in this browser. Re-importing updates
        matching IDs instead of duplicating them.
      </p>

      <div className="addcard">
        <textarea
          rows={12}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder='{"format":"church-tech-checklist-backup","formatVersion":1,"data":{...},"settings":{...}}'
          className="import-textarea"
        />

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
