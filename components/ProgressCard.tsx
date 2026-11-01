"use client";

import React from "react";
import { Icon } from "./Icon";

interface ProgressCardProps {
  doneCount: number;
  totalCount: number;
  allCollapsed: boolean;
  onToggleCollapseAll: () => void;
  onStartNewWeek: () => void;
  overdueTasks: Array<{ id: string; text: string }>;
  isSoftHiddenBanner?: boolean;
}

export function ProgressCard({
  doneCount,
  totalCount,
  allCollapsed,
  onToggleCollapseAll,
  onStartNewWeek,
  overdueTasks,
  isSoftHiddenBanner,
}: ProgressCardProps) {
  const allDone = totalCount > 0 && doneCount === totalCount;
  const percent = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  const hasOverdue = overdueTasks.length > 0;
  const overdueNames = overdueTasks
    .slice(0, 3)
    .map((t) => t.text)
    .join(", ") +
    (overdueTasks.length > 3 ? ` and ${overdueTasks.length - 3} more` : "");

  return (
    <div className="bar">
      {hasOverdue ? (
        <div
          className={`ban${isSoftHiddenBanner ? " soft-hidden" : ""}`}
          role="alert"
          aria-hidden={isSoftHiddenBanner}
        >
          <Icon name="warning" />
          <span className="bt">
            {overdueTasks.length}{" "}
            {overdueTasks.length === 1 ? "task is" : "tasks are"} past due:{" "}
            {overdueNames}
          </span>
        </div>
      ) : null}

      <div className="pcard">
        <div className="ptop">
          <span id="txt">
            {allDone ? "\u2713 All done!" : `${doneCount} of ${totalCount} done`}
          </span>
          <span className="pbtns">
            <button
              className="text"
              id="collAll"
              type="button"
              onClick={onToggleCollapseAll}
            >
              {allCollapsed ? "Expand all" : "Collapse all"}
            </button>
            <button
              className="btn"
              id="reset"
              type="button"
              onClick={onStartNewWeek}
            >
              <Icon name="refresh" />
              <span>Start new week</span>
            </button>
          </span>
        </div>
        <div className="track">
          <div className="fill" id="fill" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}
