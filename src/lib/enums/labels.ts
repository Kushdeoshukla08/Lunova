/** Human-facing labels for schema enums. Keep neutral, inclusive wording. */

export const GENDER_LABELS: Record<string, string> = {
  WOMAN: "Woman",
  MAN: "Man",
  NONBINARY: "Non-binary",
  TRANS_WOMAN: "Trans woman",
  TRANS_MAN: "Trans man",
  GENDERQUEER: "Genderqueer",
  AGENDER: "Agender",
  OTHER: "Other",
  PREFER_NOT_TO_SAY: "Prefer not to say",
};

export const ORIENTATION_LABELS: Record<string, string> = {
  STRAIGHT: "Straight",
  GAY: "Gay",
  LESBIAN: "Lesbian",
  BISEXUAL: "Bisexual",
  PANSEXUAL: "Pansexual",
  ASEXUAL: "Asexual",
  QUEER: "Queer",
  QUESTIONING: "Questioning",
  OTHER: "Other",
  PREFER_NOT_TO_SAY: "Prefer not to say",
};

export const INTENT_LABELS: Record<string, string> = {
  LONG_TERM: "A long-term relationship",
  LONG_TERM_OPEN_SHORT: "Long-term, open to short",
  SHORT_TERM_OPEN_LONG: "Short-term, open to long",
  SHORT_TERM: "Something short-term",
  FRIENDS: "New friends",
  FIGURING_IT_OUT: "Still figuring it out",
};

export const INTENT_HINTS: Record<string, string> = {
  LONG_TERM: "You're looking for something that lasts.",
  LONG_TERM_OPEN_SHORT: "Leaning serious, but not in a rush.",
  SHORT_TERM_OPEN_LONG: "Easygoing now — could grow into more.",
  SHORT_TERM: "Fun and honest, no long-term expectations.",
  FRIENDS: "People to do things with, no romance needed.",
  FIGURING_IT_OUT: "Open to seeing who you meet.",
};

export const PRECISION_LABELS: Record<string, string> = {
  NEIGHBORHOOD: "Neighbourhood — closest matches, still approximate",
  CITY: "City — recommended",
  REGION: "Region only — most private",
};

export const VISIBILITY_LABELS: Record<string, string> = {
  PUBLIC: "Anyone who can see my profile",
  CONNECTIONS: "Only my matches",
  PRIVATE: "Only me",
};

export function toOptions(map: Record<string, string>) {
  return Object.entries(map).map(([value, label]) => ({ value, label }));
}
