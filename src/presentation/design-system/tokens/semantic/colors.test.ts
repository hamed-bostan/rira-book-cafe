import { describe, expect, it } from "vitest";

import { colors } from "./colors";

// WCAG relative luminance, calculated from unrounded sRGB channel values.
function luminance(hex: string) {
  const [r, g, b] = hex
    .slice(1)
    .match(/../g)!
    .map((channel) => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function contrast(a: string, b: string) {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe("readable semantic colors", () => {
  const pairs = [
    ["body", colors.foreground, colors.background],
    ["primary button", colors.primary.foreground, colors.primary.DEFAULT],
    ["primary hover", colors.primary.foreground, colors.primary.hover],
    ["primary pressed", colors.primary.foreground, colors.primary.pressed],
    ["primary link", colors.primary.DEFAULT, colors.background],
    ["primary on accent", colors.primary.DEFAULT, colors.accent.DEFAULT],
    ["muted text", colors.muted.foreground, colors.background],
    ["muted badge", colors.muted.foreground, colors.muted.DEFAULT],
    ["muted text on sunken surface", colors.muted.foreground, colors.surface.sunken],
    ["input", colors.input.foreground, colors.input.DEFAULT],
    ["placeholder", colors.input.placeholder, colors.input.filled],
    ["accent", colors.accent.foreground, colors.accent.DEFAULT],
    ["strong accent", colors.accent.foreground, colors.accent.strong],
    ["success", colors.success.foreground, colors.success.DEFAULT],
    ["warning", colors.warning.foreground, colors.warning.DEFAULT],
    ["strong warning", colors.warning.strong, colors.warning.DEFAULT],
    ["info", colors.info.foreground, colors.info.DEFAULT],
    ["error", colors.error.foreground, colors.error.DEFAULT],
    ["destructive", colors.destructive.foreground, colors.destructive.DEFAULT],
    ["destructive on error surface", colors.destructive.DEFAULT, colors.error.DEFAULT],
    ["magenta", colors.magenta.foreground, colors.magenta.DEFAULT],
    ["discount", colors.discount.foreground, colors.discount.DEFAULT],
    ["soft discount", colors.discount.softForeground, colors.discount.soft],
    ["wallet green light stop", colors.primary.foreground, colors.wallet.primaryFrom],
    ["wallet green dark stop", colors.primary.foreground, colors.wallet.primaryTo],
    ["wallet magenta light stop", colors.primary.foreground, colors.wallet.magentaFrom],
    ["wallet magenta dark stop", colors.primary.foreground, colors.wallet.magentaTo],
  ];

  it.each(pairs)("%s meets 4.5:1 for normal text", (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  for (const background of [colors.background, colors.surface.DEFAULT, colors.surface.sunken, colors.accent.DEFAULT]) {
    it.each([
      ["focus ring", colors.ring],
      ["muted icon", colors.icon.muted],
      ["rating star", colors.rating],
    ])("%s is visible on " + background, (_name, foreground) => {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(3);
    });
  }
});
