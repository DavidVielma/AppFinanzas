import { useState } from "react";

const fallbackColor = "#e2e8f0";

function normalizeHexColor(value) {
  const raw = String(value || "").trim();
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toLowerCase() : fallbackColor;
}

export function ColorPicker({ name = "color", value, defaultValue, onChange, presets = [], compact = false, showHex = true }) {
  const [internalColor, setInternalColor] = useState(() => normalizeHexColor(defaultValue));
  const isControlled = value !== undefined;
  const currentColor = normalizeHexColor(isControlled ? value : internalColor);

  function setColor(nextColor) {
    const normalized = normalizeHexColor(nextColor);
    if (!isControlled) {
      setInternalColor(normalized);
    }
    onChange?.(normalized);
  }

  return (
    <div className={`color-picker ${compact ? "compact" : ""} ${!showHex ? "swatch-only" : ""}`}>
      <input type="hidden" name={name} value={currentColor} />
      <label className="color-swatch-control" title="Elegir color">
        <span style={{ backgroundColor: currentColor }} />
        <input type="color" value={currentColor} onChange={(event) => setColor(event.target.value)} aria-label="Elegir color" />
      </label>
      {showHex && <input className="color-hex-input" value={currentColor} onChange={(event) => setColor(event.target.value)} aria-label="Color hexadecimal" />}
      {!compact && presets.length > 0 && (
        <div className="color-preset-row" aria-label="Colores sugeridos">
          {presets.map((preset) => (
            <button type="button" key={preset.value} title={preset.label} onClick={() => setColor(preset.value)} style={{ backgroundColor: preset.value }} />
          ))}
        </div>
      )}
    </div>
  );
}
