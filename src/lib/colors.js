function expandHex(value) {
  const normalized = String(value || "").trim().replace(/^#/, "");

  if (/^[0-9a-f]{3}$/i.test(normalized)) {
    return normalized
      .split("")
      .map((char) => char + char)
      .join("");
  }

  return /^[0-9a-f]{6}$/i.test(normalized) ? normalized : null;
}

export function getReadableTextColor(backgroundColor, fallback = "#172033") {
  const hex = expandHex(backgroundColor);
  if (!hex) return fallback;

  const red = parseInt(hex.slice(0, 2), 16) / 255;
  const green = parseInt(hex.slice(2, 4), 16) / 255;
  const blue = parseInt(hex.slice(4, 6), 16) / 255;
  const transform = (channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * transform(red) + 0.7152 * transform(green) + 0.0722 * transform(blue);
  const contrastWithDark = (luminance + 0.05) / 0.05;
  const contrastWithLight = 1.05 / (luminance + 0.05);

  return contrastWithDark >= contrastWithLight ? "#172033" : "#ffffff";
}

export function getMutedTextColor(backgroundColor) {
  return getReadableTextColor(backgroundColor) === "#ffffff" ? "rgba(255, 255, 255, 0.78)" : "#4b5b70";
}

export function getAccountColorStyle(color, fallback = "#f8fafc") {
  const backgroundColor = color || fallback;

  return {
    backgroundColor,
    "--account-ink": getReadableTextColor(backgroundColor),
    "--account-muted-ink": getMutedTextColor(backgroundColor)
  };
}
