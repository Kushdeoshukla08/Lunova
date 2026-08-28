/**
 * English message catalog — the base locale. Every other catalog is a
 * `DeepPartial<typeof en>`; missing keys fall back here (see `../messages`).
 *
 * Keep this a plain nested object of strings. Interpolation uses `{name}`-style
 * placeholders resolved by `t()`. Do not put JSX or logic here.
 */
export const en = {
  nav: {
    discover: "Discover",
    connections: "Connections",
    activity: "Activity",
    profile: "Profile",
    notifications: "Notifications",
    settings: "Settings",
  },
  common: {
    save: "Save",
    cancel: "Cancel",
    back: "Back",
    loading: "Loading…",
    retry: "Try again",
  },
  settings: {
    title: "Settings",
    language: {
      title: "Language & region",
      blurb: "The language Lunova speaks to you in, and how dates and distances are shown",
      current: "Language",
      note: "More languages are on the way. Dates, times and distances already follow your device's region.",
    },
  },
} as const;

export type Messages = typeof en;
