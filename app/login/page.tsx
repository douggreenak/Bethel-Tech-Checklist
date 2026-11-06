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
    <main className="auth-page">
      <div className="addcard auth-card">
        <h1>Church tech checklist</h1>
        <p className="sub">
          Enter the team passcode to access the shared weekly checklist.
        </p>

        <form className="auth-form" onSubmit={handleLogin}>
          <input
            ref={inputRef}
            type="password"
            className="editin"
            placeholder="Team passcode"
            aria-label="Team passcode"
            autoComplete="current-password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
          />

          {error && (
            <p className="form-message error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn"
            disabled={loading}
            style={{ alignSelf: "flex-end", minWidth: 120 }}
          >
            {loading ? "Checking..." : "Enter"}
          </button>
        </form>
      </div>
    </main>
  );
}
