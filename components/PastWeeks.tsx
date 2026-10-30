"use client";

import React from "react";

export interface WeekHistoryItem {
  week: string; // Monday date 'YYYY-MM-DD'
  done: number;
  total: number;
  savedAt: string | Date;
  detail: Array<{ n: string; d: number; t: number }>;
}

interface PastWeeksProps {
  history: WeekHistoryItem[];
}

export function PastWeeks({ history }: PastWeeksProps) {
  const sorted = [...history].sort((a, b) => (a.week < b.week ? 1 : -1));

  let avg = 0;
  let best = 0;

  if (sorted.length > 0) {
    const percentages = sorted.map((w) => (w.total > 0 ? w.done / w.total : 0));
    avg = Math.round(
      (percentages.reduce((acc, val) => acc + val, 0) / percentages.length) * 100
    );
    best = Math.round(Math.max(...percentages) * 100);
  }

  function formatWeekDate(weekKey: string) {
    const [yStr, mStr, dStr] = weekKey.split("-");
    const d = new Date(Date.UTC(parseInt(yStr, 10), parseInt(mStr, 10) - 1, parseInt(dStr, 10)));
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  return (
    <section className="cat" id="hist">
      <div className="cathead">
        <span className="tog" style={{ cursor: "default" }}>
          <span>Past weeks</span>
        </span>
      </div>

      <div id="histBody">
        {sorted.length === 0 ? (
          <div className="empty">
            No past weeks yet. Each week&apos;s results are saved when a new week starts.
          </div>
        ) : (
          <>
            <div className="hrow">
              <div className="hh">
                {sorted.length} {sorted.length === 1 ? "week" : "weeks"} saved
              </div>
              <div className="hd">
                Average {avg}% done &middot; Best week {best}%
              </div>
            </div>

            {sorted.map((w) => {
              const pct = w.total > 0 ? (w.done / w.total) * 100 : 0;
              const detailStr =
                w.detail && w.detail.length > 0
                  ? w.detail.map((x) => `${x.n} ${x.d}/${x.t}`).join(" \u00b7 ")
                  : "";

              return (
                <div key={w.week} className="hrow">
                  <div className="hh">
                    Week of {formatWeekDate(w.week)}: {w.done} of {w.total} done
                  </div>
                  <div className="track">
                    <div className="fill" style={{ width: `${pct}%` }} />
                  </div>
                  {detailStr && <div className="hd">{detailStr}</div>}
                </div>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
}
