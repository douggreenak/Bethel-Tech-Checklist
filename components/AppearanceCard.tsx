"use client";

import React, { useState, useEffect } from "react";
import { Icon } from "./Icon";
import {
  ACCENTS,
  ThemeConfig,
  THEME_STORAGE_KEY,
  applyTheme,
  ThemeMode,
} from "@/lib/theme";

interface AppearanceCardProps {
  theme: ThemeConfig;
  onThemeChange: (newTheme: ThemeConfig) => void;
}

export function AppearanceCard({ theme, onThemeChange }: AppearanceCardProps) {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [tiltAngle, setTiltAngle] = useState(0);

  const mode = theme.mode || "system";
  const acc = theme.acc ?? 0;
  const isRotationLocked = Boolean(theme.rl);

  useEffect(() => {
    const coarse =
      (typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(pointer: coarse)").matches) ||
      (typeof navigator !== "undefined" && (navigator.maxTouchPoints || 0) > 0);
    setIsTouchDevice(coarse);

    function calculateAngle(): number {
      const so = window.screen && window.screen.orientation;
      let a: number | null = null;
      if (so && typeof so.angle === "number") a = so.angle;
      if (
        (a === null || a === 0) &&
        typeof (window as any).orientation === "number" &&
        (window as any).orientation
      ) {
        a = (window as any).orientation;
      }
      if (a === null) a = 0;
      a = ((a % 360) + 360) % 360;
      if (a === 0 || a === 180) {
        const t = so && so.type;
        if (t && String(t).startsWith("landscape")) {
          a = t === "landscape-secondary" ? 270 : 90;
        }
      }
      return a;
    }

    const updateAngle = () => {
      setTiltAngle(calculateAngle());
    };

    updateAngle();
    window.addEventListener("resize", updateAngle);
    window.addEventListener("orientationchange", updateAngle);
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener("change", updateAngle);
    }

    return () => {
      window.removeEventListener("resize", updateAngle);
      window.removeEventListener("orientationchange", updateAngle);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener("change", updateAngle);
      }
    };
  }, []);

  const handleModeChange = (newMode: ThemeMode) => {
    const updated = { ...theme, mode: newMode };
    onThemeChange(updated);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    applyTheme(updated);
  };

  const handleAccentChange = (newAcc: number) => {
    const updated = { ...theme, acc: newAcc };
    onThemeChange(updated);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    applyTheme(updated);
  };

  const handleRotationToggle = () => {
    const updated = { ...theme, rl: !theme.rl };
    onThemeChange(updated);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const modeDescription =
    mode === "system"
      ? "Theme mode: System follows your device preference."
      : mode === "light"
      ? "Theme mode: Light is always on."
      : "Theme mode: Dark is always on.";

  const rotationNote =
    (isRotationLocked
      ? "On. Tilt your device and the page turns with it instead of re-flowing."
      : "Off. The page re-flows when you rotate your device.") +
    ` (tilt ${tiltAngle}\u00b0)`;

  return (
    <section className="cat" id="appearance">
      <div className="cathead">
        <span className="tog" style={{ cursor: "default" }}>
          <span id="palIc">
            <Icon name="palette" />
          </span>
          <span>Appearance</span>
        </span>
      </div>

      <div className="apbody">
        <p className="aplbl" id="modeLbl">
          {modeDescription}
        </p>
        <div className="seg" id="seg" role="group" aria-label="Theme mode">
          <button
            type="button"
            aria-pressed={mode === "light"}
            onClick={() => handleModeChange("light")}
          >
            <Icon name="sun" />
            <span>Light</span>
          </button>
          <button
            type="button"
            aria-pressed={mode === "dark"}
            onClick={() => handleModeChange("dark")}
          >
            <Icon name="moon" />
            <span>Dark</span>
          </button>
          <button
            type="button"
            aria-pressed={mode === "system"}
            onClick={() => handleModeChange("system")}
          >
            <Icon name="brightness" />
            <span>System</span>
          </button>
        </div>

        <p className="aplbl">
          Accent color: used for buttons, icons, and highlights throughout the app.
        </p>
        <div className="swrow" id="sw">
          {ACCENTS.map((a, i) => {
            const isSelected = acc === i;
            return (
              <button
                key={a[0]}
                type="button"
                className="sb"
                aria-label={`${a[0]} accent color`}
                aria-pressed={isSelected}
                style={{ background: `hsl(${a[1]}, ${a[2] + 8}%, 62%)` }}
                onClick={() => handleAccentChange(i)}
              >
                {isSelected && <Icon name="check" />}
              </button>
            );
          })}
        </div>

        {isTouchDevice && (
          <div className="rotrow" id="rotRow">
            <div>
              <b>Lock rotation</b>
              <br />
              <small id="rotNote">{rotationNote}</small>
            </div>
            <button
              className="swt"
              id="rotSw"
              type="button"
              role="switch"
              aria-checked={isRotationLocked}
              aria-label="Lock rotation"
              onClick={handleRotationToggle}
            />
          </div>
        )}
      </div>
    </section>
  );
}
