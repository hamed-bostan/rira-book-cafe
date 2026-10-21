export const primary = {
  50: "#EAFBF0",
  100: "#D8F3E2",
  200: "#98E9B8",
  300: "#51EE8F",
  400: "#17E568",
  500: "#11A94D",
  600: "#0C7736",
  700: "#0A682F",
  800: "#0A4521",
};

export const magenta = {
  50: "#FCEEF6",
  200: "#E998C9",
  300: "#EE51B0",
  400: "#E51794",
  500: "#A9116D",
  600: "#890E58",
  700: "#680A43",
  800: "#450A2E",
};

export const neutral = {
  0: "#FFFFFF",
  50: "#F9FAFB",
  75: "#F0F2F5",
  100: "#EFEFEF",
  200: "#E4E4E4",
  300: "#C7C7C7",
  400: "#AAAAAA",
  500: "#686868",
  700: "#5B5B5B",
  800: "#444444",
  950: "#1E1E1E",
};

export const success = {
  100: primary[50],
  500: primary[500],
  700: primary[700],
};

export const error = {
  100: "#FEEDEC",
  500: "#C5362B",
  700: "#9B2420",
};

export const info = {
  100: "#D6E4FF",
  500: "#3265FF",
  700: "#1938B7",
};
export const warning = {
  100: "#FFF4DC",
  500: "#D99A20",
  700: "#8A5B12",
  800: "#70480D",
};

// The Rira palette (the "Color Palette" page in the Rira design project): scales
// with steps 50–950. Only themed tokens point into them — the `landing` tokens and
// the `admin` theme (see `semantic/themes.ts`).

// Navy — ink, headings.
export const navy = {
  50: "#EEF0FA",
  100: "#DADFF3",
  200: "#B5BEE6",
  300: "#8693D2",
  400: "#5767BA",
  500: "#36479F",
  600: "#263683",
  700: "#1D2B72",
  800: "#172366",
  900: "#101C5E",
  950: "#0A1240",
};

// Teal — primary actions.
export const teal = {
  50: "#EAF7F4",
  100: "#CDEDE6",
  200: "#9DDBCD",
  300: "#64C2AE",
  400: "#31A38D",
  500: "#138C79",
  600: "#0B7B6B",
  700: "#09695B",
  800: "#0A554A",
  900: "#0A463E",
  950: "#042824",
};

// Blue — accents, icons, bands.
export const blue = {
  50: "#EEF6FD",
  100: "#D9E9FB",
  200: "#B9D4F6",
  300: "#8BB5EE",
  400: "#5B8FE2",
  500: "#3E73D6",
  600: "#2F5FCC",
  700: "#2847B8",
  800: "#263D96",
  900: "#243677",
  950: "#19224A",
};

// Slate — secondary text, borders.
export const slate = {
  50: "#F5F7FB",
  100: "#E8EDF4",
  200: "#D3DCEA",
  300: "#B1BCD0",
  400: "#8590AA",
  500: "#646D88",
  600: "#4A5068",
  700: "#3A4058",
  800: "#2E3550",
  900: "#22273B",
  950: "#151826",
};

// The palette's status hues — warnings and dangers in the admin theme. Named apart
// from the app's own `warning`/`error` scales and the rating `amber` below.
export const paletteAmber = {
  50: "#FFF8EB",
  100: "#FEEDC7",
  200: "#FDD98A",
  300: "#FCC04D",
  400: "#F9A524",
  500: "#E8850B",
  600: "#C96506",
  700: "#A24709",
  800: "#83380F",
  900: "#6C2F10",
  950: "#3E1604",
};

export const paletteRed = {
  50: "#FEF2F2",
  100: "#FDE3E3",
  200: "#FBCBCB",
  300: "#F7A5A5",
  400: "#F07272",
  500: "#E34848",
  600: "#CC2F2F",
  700: "#AB2424",
  800: "#8E2222",
  900: "#762222",
  950: "#400D0D",
};

// Amber/gold accent — used for rating stars (and any gold decorative glyph).
export const amber = {
  500: "#FFC107",
  600: "#B77908",
};
