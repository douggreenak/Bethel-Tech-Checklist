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

    try {
      const parsed = JSON.parse(jsonText.trim());
      setLoading(true);
      setError(null);
      setResult(null);

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
    } catch (err: any) {
      setError(`Invalid JSON: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
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
          style={{
            width: "100%",
            fontFamily: "monospace",
            fontSize: "0.85rem",
            padding: 12,
            borderRadius: 16,
            border: "1px solid var(--out)",
            background: "var(--sf)",
            color: "var(--ink)",
            resize: "vertical",
          }}
        />

        {error && (
          <p style={{ color: "var(--bad)", marginTop: 12, fontWeight: 500 }}>
            {error}
          </p>
        )}

        {result && (
          <p style={{ color: "var(--ok)", marginTop: 12, fontWeight: 500 }}>
            {result}
          </p>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}>
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
