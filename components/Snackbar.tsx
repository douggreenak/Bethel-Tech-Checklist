"use client";

import React from "react";

export interface SnackbarState {
  open: boolean;
  message: string;
  onUndo?: () => void;
}

interface SnackbarProps {
  state: SnackbarState;
  onClose: () => void;
}

export function Snackbar({ state, onClose }: SnackbarProps) {
  const { open, message, onUndo } = state;

  return (
    <div className={`toast ${open ? "on" : ""}`} role="status" aria-live="polite">
      <span>{message}</span>
      {onUndo && (
        <button
          type="button"
          onClick={() => {
            onClose();
            onUndo();
          }}
        >
          Undo
        </button>
      )}
    </div>
  );
}
