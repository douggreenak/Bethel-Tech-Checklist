"use client";

import React from "react";
import { Icon } from "./Icon";

interface FabProps {
  onClick: () => void;
}

export function Fab({ onClick }: FabProps) {
  return (
    <button className="fab" id="fab" type="button" onClick={onClick}>
      <Icon name="add" />
      <span>Add task</span>
    </button>
  );
}
