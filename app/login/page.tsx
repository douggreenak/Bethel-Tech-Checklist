"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = passcode.trim();
    if (!trimmed) {
      if (inputRef.current) {
        inputRef.current.classList.remove("shake");
        void inputRef.current.offsetWidth;
        inputRef.current.classList.add("shake");
        inputRef.current.focus();
      }
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Incorrect passcode");
        if (inputRef.current) {
          inputRef.current.classList.remove("shake");
          void inputRef.current.offsetWidth;
          inputRef.current.classList.add("shake");
          inputRef.current.focus();
        }
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "80vh", display: "grid", placeItems: "center" }}>
      <div className="addcard" style={{ maxWidth: 420, width: "100%", padding: 28 }}>
        <h1 style={{ fontSize: "1.75rem", margin: "0 0 8px" }}>Church tech checklist</h1>
        <p className="sub" style={{ margin: "0 0 20px" }}>
          Enter the team passcode to access the shared weekly checklist.
        </p>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <input
            ref={inputRef}
            type="password"
            className="editin"
            style={{ margin: 0 }}
            placeholder="Team passcode"
            aria-label="Team passcode"
            autoComplete="current-password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
          />

          {error && (
            <p style={{ color: "var(--bad)", fontSize: "0.9rem", margin: "2px 4px" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn"
            disabled={loading}
            style={{ alignSelf: "flex-end", minHeight: 48, minWidth: 120 }}
          >
            {loading ? "Checking..." : "Enter"}
          </button>
        </form>
      </div>
    </main>
  );
}
