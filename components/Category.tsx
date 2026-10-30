"use client";

import React, { useState, useRef, useEffect } from "react";
import { Icon } from "./Icon";
import { TaskRow, TaskData } from "./TaskRow";
import { EditorInline } from "./EditorInline";
import { formatDueText } from "@/lib/time";
import { animateCategoryCollapse } from "@/lib/animate";

export interface CategoryData {
  id: string;
  name: string;
  sortOrder: number;
  dueTime: string;
  dueDay: number | null;
}

interface CategoryProps {
  category: CategoryData;
  tasks: TaskData[];
  timezone: string;
  isCollapsed: boolean;
  overdueTaskIds: Set<string>;
  onToggleCollapse: () => void;
  onResetCategory: () => void;
  onUpdateCategory: (name: string, dueTime: string, dueDay: number) => void;
  onDeleteCategory: () => void;
  onToggleTaskDone: (task: TaskData, checked: boolean) => void;
  onToggleTaskStar: (task: TaskData) => void;
  onUpdateTask: (task: TaskData, text: string, dueTime: string) => void;
  onDeleteTask: (task: TaskData) => void;
  onGripPointerDown: (e: React.PointerEvent<HTMLDivElement>, category: CategoryData) => void;
  onTaskGripPointerDown: (e: React.PointerEvent<HTMLDivElement>, task: TaskData) => void;
}

export function Category({
  category,
  tasks,
  timezone,
  isCollapsed,
  overdueTaskIds,
  onToggleCollapse,
  onResetCategory,
  onUpdateCategory,
  onDeleteCategory,
  onToggleTaskDone,
  onToggleTaskStar,
  onUpdateTask,
  onDeleteTask,
  onGripPointerDown,
  onTaskGripPointerDown,
}: CategoryProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const armTimerRef = useRef<NodeJS.Timeout | null>(null);
  const secRef = useRef<HTMLElement>(null);

  const prevCollapsedRef = useRef(isCollapsed);

  useEffect(() => {
    if (prevCollapsedRef.current !== isCollapsed && secRef.current) {
      animateCategoryCollapse({
        sec: secRef.current,
        collapse: isCollapsed,
      });
      prevCollapsedRef.current = isCollapsed;
    }
  }, [isCollapsed]);

  const handleDeleteClick = () => {
    if (!deleteArmed) {
      setDeleteArmed(true);
      armTimerRef.current = setTimeout(() => {
        setDeleteArmed(false);
      }, 3000);
    } else {
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
      setDeleteArmed(false);
      onDeleteCategory();
    }
  };

  const doneCount = tasks.filter((t) => t.done).length;
  const totalCount = tasks.length;
  const allDone = totalCount > 0 && doneCount === totalCount;

  // Category due text
  let catDueStr = "";
  if (category.dueTime) {
    catDueStr = formatDueText({
      done: false,
      overdue: false,
      dueTime: category.dueTime,
      dueDay: category.dueDay,
      timeZone: timezone,
    }).replace(/^Due /, "");
  }

  // Sort tasks: stars first, then sortOrder
  const sortedTasks = [...tasks].sort((a, b) => {
    const sa = a.starred ? 1 : 0;
    const sb = b.starred ? 1 : 0;
    return sb - sa || a.sortOrder - b.sortOrder;
  });

  return (
    <section
      ref={secRef}
      className={`cat ${isCollapsed ? "collapsed" : ""}`}
      data-cat={category.id}
    >
      {isEditing ? (
        <EditorInline
          type="category"
          initialName={category.name}
          initialDueTime={category.dueTime}
          initialDueDay={category.dueDay}
          onSave={(name, dueTime, dueDay) => {
            setIsEditing(false);
            onUpdateCategory(name, dueTime, dueDay);
          }}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <div className={`cathead ${mobileMenuOpen ? "open" : ""}`}>
          <div
            className="grip"
            aria-label="Drag to reorder category"
            onPointerDown={(e) => onGripPointerDown(e, category)}
          >
            <Icon name="drag" />
          </div>

          <button
            type="button"
            className="tog"
            aria-expanded={!isCollapsed}
            onClick={onToggleCollapse}
          >
            <Icon name={isCollapsed ? "chevron" : "expand"} />
            <span>{category.name}</span>

            {catDueStr && (
              <span className="cdue">
                <Icon name="clock" /> {catDueStr}
              </span>
            )}

            <span className={`cnt ${allDone ? "all" : ""}`} data-cat={category.id}>
              {allDone ? "\u2713 " : ""}
              {doneCount}/{totalCount}
            </span>
          </button>

          <span className="acts">
            <button
              type="button"
              className="pen"
              data-l="New week"
              aria-label={`Start new week for ${category.name}`}
              onClick={onResetCategory}
            >
              <Icon name="refresh" />
            </button>
            <button
              type="button"
              className="pen"
              data-l="Rename"
              aria-label={`Rename ${category.name}`}
              onClick={() => setIsEditing(true)}
            >
              <Icon name="edit" />
            </button>
            {category.id !== "general" && (
              <button
                type="button"
                className={`pen del ${deleteArmed ? "armed" : ""}`}
                data-l="Delete"
                aria-label={`Delete ${category.name}`}
                onClick={handleDeleteClick}
              >
                {deleteArmed ? "Delete?" : <Icon name="delete" />}
              </button>
            )}
          </span>

          <button
            type="button"
            className="pen more"
            aria-label={`Actions for ${category.name}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Icon name="more" />
          </button>
        </div>
      )}

      <div className="catbody" data-cat={category.id}>
        {sortedTasks.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            categoryName={category.name}
            categoryDueTime={category.dueTime}
            categoryDueDay={category.dueDay}
            timezone={timezone}
            isOverdue={overdueTaskIds.has(t.id)}
            onToggleDone={(chk) => onToggleTaskDone(t, chk)}
            onToggleStar={() => onToggleTaskStar(t)}
            onUpdate={(txt, due) => onUpdateTask(t, txt, due)}
            onDelete={() => onDeleteTask(t)}
            onGripPointerDown={onTaskGripPointerDown}
          />
        ))}
      </div>
    </section>
  );
}
