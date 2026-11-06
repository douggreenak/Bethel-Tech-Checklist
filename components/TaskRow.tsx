"use client";

import React, { useState, useEffect, useRef } from "react";
import { Icon } from "./Icon";
import { formatDueText, formatDoneText } from "@/lib/time";
import { EditorInline } from "./EditorInline";

export interface TaskData {
  id: string;
  text: string;
  done: boolean;
  categoryId: string;
  sortOrder: number;
  checkedAt?: string | Date | null;
  dueTime: string;
  starred: boolean;
}

interface TaskRowProps {
  task: TaskData;
  categoryName: string;
  categoryDueTime: string;
  categoryDueDay: number | null;
  timezone: string;
  isOverdue: boolean;
  categories?: Array<{ id: string; name: string }>;
  onToggleDone: (checked: boolean) => void;
  onToggleStar: () => void;
  onUpdate: (text: string, dueTime: string, newCategoryId?: string) => void;
  onDelete: () => void;
  onGripPointerDown: (e: React.PointerEvent<HTMLDivElement>, task: TaskData) => void;
}

export function TaskRow({
  task,
  categoryName,
  categoryDueTime,
  categoryDueDay,
  timezone,
  isOverdue,
  categories,
  onToggleDone,
  onToggleStar,
  onUpdate,
  onDelete,
  onGripPointerDown,
}: TaskRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const armTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
    };
  }, []);

  const handleDeleteClick = () => {
    if (!deleteArmed) {
      setDeleteArmed(true);
      armTimerRef.current = setTimeout(() => {
        setDeleteArmed(false);
      }, 3000);
    } else {
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
      setDeleteArmed(false);
      onDelete();
    }
  };

  if (isEditing) {
    return (
      <EditorInline
        type="task"
        initialText={task.text}
        initialDueTime={task.dueTime}
        categoryName={categoryName}
        categoryDueTime={categoryDueTime}
        categoryDueDay={categoryDueDay}
        timezone={timezone}
        categories={categories}
        currentCategoryId={task.categoryId}
        onSave={(text, dueTime, newCategoryId) => {
          setIsEditing(false);
          onUpdate(text, dueTime, newCategoryId);
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  const effectiveDue = task.dueTime || categoryDueTime;
  const effectiveDay = categoryDueDay ?? 0;
  const dueText = formatDueText({
    done: task.done,
    overdue: isOverdue,
    dueTime: effectiveDue,
    dueDay: effectiveDay,
    timeZone: timezone,
  });

  const whenText = task.done ? formatDoneText(task.checkedAt, timezone) : "";

  return (
    <div
      className={`row ${task.done ? "done" : ""} ${isOverdue ? "ovd" : ""}`}
      data-id={task.id}
    >
      <div
        className="grip"
        aria-label="Drag to move"
        onPointerDown={(e) => onGripPointerDown(e, task)}
      >
        <Icon name="drag" />
      </div>

      <label>
        <input
          type="checkbox"
          checked={task.done}
          onChange={(e) => onToggleDone(e.target.checked)}
          aria-label={task.text}
        />
        <span className="txt">
          <span className="nm">{task.text}</span>

          {!task.done && (
            <span
              className={`duep ${dueText ? "" : "none"}`}
              role="button"
              tabIndex={0}
              aria-label={dueText || "Add due time"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsEditing(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsEditing(true);
                }
              }}
            >
              <Icon name="clock" />
              <span>{dueText || "Add due time"}</span>
            </span>
          )}

          {task.done && whenText && <span className="when">{whenText}</span>}
        </span>
      </label>

      <button
        type="button"
        className={`pen star ${task.starred ? "on" : ""}`}
        aria-label={(task.starred ? "Unstar " : "Star ") + task.text}
        aria-pressed={task.starred}
        onClick={onToggleStar}
      >
        <Icon name={task.starred ? "star" : "star-border"} />
      </button>

      <button
        type="button"
        className="pen"
        aria-label={`Edit ${task.text}`}
        onClick={() => setIsEditing(true)}
      >
        <Icon name="edit" />
      </button>

      <button
        type="button"
        className={`pen del ${deleteArmed ? "armed" : ""}`}
        aria-label={`Delete ${task.text}`}
        onClick={handleDeleteClick}
      >
        {deleteArmed ? "Delete?" : <Icon name="delete" />}
      </button>
    </div>
  );
}
