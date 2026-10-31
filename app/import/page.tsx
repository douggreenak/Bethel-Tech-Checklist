"use client";

import React, { useState } from "react";
import Link from "next/link";

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
        setResult(data.message || "Import successful!");
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
        Paste your JSON export from the single-file checklist below. This importer converts
        timestamps, categories, tasks, and past week histories into the Neon Postgres database.
        It uses safe upserts, so re-running it will not duplicate your data.
      </p>

      <div className="addcard">
        <textarea
          rows={12}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder='{"categories":[...],"tasks":[...],"history":[...],"appState":{...}}'
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
