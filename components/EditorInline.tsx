"use client";

import React, { useState, useEffect, useRef } from "react";
import { Icon } from "./Icon";
import { formatDueText } from "@/lib/time";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface TaskEditorProps {
  type: "task";
  initialText: string;
  initialDueTime: string;
  categoryName: string;
  categoryDueTime: string;
  categoryDueDay: number | null;
  timezone: string;
  categories?: Array<{ id: string; name: string }>;
  currentCategoryId?: string;
  onSave: (text: string, dueTime: string, newCategoryId?: string) => void;
  onCancel: () => void;
}

interface CategoryEditorProps {
  type: "category";
  initialName: string;
  initialDueTime: string;
  initialDueDay: number | null;
  onSave: (name: string, dueTime: string, dueDay: number) => void;
  onCancel: () => void;
}

export type EditorProps = TaskEditorProps | CategoryEditorProps;

export function EditorInline(props: EditorProps) {
  const [text, setText] = useState(
    props.type === "task" ? props.initialText : props.initialName
  );
  const [dueTime, setDueTime] = useState(props.initialDueTime || "");
  const [dueDay, setDueDay] = useState<number>(
    props.type === "category" ? props.initialDueDay ?? 0 : 0
  );
  const [selectedCatId, setSelectedCatId] = useState<string>(
    props.type === "task" ? props.currentCategoryId || "" : ""
  );

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      props.onCancel();
    }
  };

  const handleSave = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (props.type === "task") {
      props.onSave(trimmed, dueTime, selectedCatId);
    } else {
      props.onSave(trimmed, dueTime, dueDay);
    }
  };

  if (props.type === "task") {
    let hint = "";
    if (props.categoryDueTime) {
      const catDueFormatted = formatDueText({
        done: false,
        overdue: false,
        dueTime: props.categoryDueTime,
        dueDay: props.categoryDueDay,
        timeZone: props.timezone,
      }).replace(/^Due /, "");
      hint = `Leave this empty to use the "${props.categoryName}" category's due time (${catDueFormatted}). Set a time here to override it.`;
    } else {
      hint = `The "${props.categoryName}" category has no due time yet. Set one here, or add one in the category's \u270e menu.`;
    }

    return (
      <div className="row" style={{ padding: "8px 12px" }}>
        <input
          ref={inputRef}
          className="editin"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Task name"
        />
        <span className="timelb2">
          <Icon name="clock" /> Due
        </span>
        <input
          className="timein"
          type="time"
          value={dueTime}
          onChange={(e) => setDueTime(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Due time"
        />
        {dueTime && (
          <button
            type="button"
            className="pen"
            aria-label="Clear due time"
            onClick={() => setDueTime("")}
          >
            <Icon name="close" />
          </button>
        )}
        {props.categories && props.categories.length > 1 && (
          <>
            <span className="timelb2">Category</span>
            <select
              className="timein"
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
              aria-label="Category"
            >
              {props.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        )}
        <span className="timehint">{hint}</span>
        <button type="button" className="btn" onClick={handleSave}>
          Save
        </button>
        <button type="button" className="text" onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    );
  }

  // Category editor
  return (
    <div className="cathead" style={{ padding: "8px 12px" }}>
      <input
        ref={inputRef}
        className="editin"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Category name"
      />
      <span className="timelb2">
        <Icon name="clock" /> Due
      </span>
      <input
        className="timein"
        type="time"
        value={dueTime}
        onChange={(e) => setDueTime(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Due time"
      />
      {dueTime && (
        <button
          type="button"
          className="pen"
          aria-label="Clear due time"
          onClick={() => setDueTime("")}
        >
          <Icon name="close" />
        </button>
      )}
      <span className="timelb2">on</span>
      <select
        className="timein"
        value={dueDay}
        onChange={(e) => setDueDay(parseInt(e.target.value, 10))}
        aria-label="Due day"
      >
        {DAY_NAMES.map((name, i) => (
          <option key={i} value={i}>
            {name}
          </option>
        ))}
      </select>
      <span className="timehint">
        Tasks use this time and day unless a task has its own time.
      </span>
      <button type="button" className="btn" onClick={handleSave}>
        Save
      </button>
      <button type="button" className="text" onClick={props.onCancel}>
        Cancel
      </button>
    </div>
  );
}
