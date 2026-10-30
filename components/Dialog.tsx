"use client";

import React, { useEffect, useRef } from "react";

interface DialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function Dialog({ open, onConfirm, onCancel }: DialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      confirmBtnRef.current?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onCancel();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mt"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div className="mbox">
        <h2 id="mt">Start a new week?</h2>
        <p>
          This unchecks every task and saves this week&apos;s results under Past weeks.
          You can undo it right afterward.
        </p>
        <p>
          <strong>The checklist also resets by itself every Monday</strong>, so you only
          need this to start early.
        </p>
        <div className="mbtn">
          <button className="text" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            id="mYes"
            ref={confirmBtnRef}
            className="btn"
            type="button"
            onClick={onConfirm}
          >
            Start new week
          </button>
        </div>
      </div>
    </div>
  );
}
