"use client";

import React from "react";

interface HeaderProps {
  subtitle: string;
  isSynced: boolean;
  statusText?: string;
}

export function Header({ subtitle, isSynced, statusText }: HeaderProps) {
  const displayStatus = statusText || (isSynced ? "Synced" : "Offline, changes will retry");

  return (
    <>
      <h1>Church tech checklist</h1>
      <p className="sub" id="wk">
        {subtitle}
      </p>
      <p className={`sub st ${isSynced ? "ok" : ""}`} id="status">
        {isSynced ? "\u25cf " : "\u25cb "}
        {displayStatus}
      </p>
    </>
  );
}
