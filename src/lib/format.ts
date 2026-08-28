/**
 * Back-compat surface. The real implementation now lives in `@/lib/i18n/format`
 * and is locale/timezone aware — pass a `FormatContext` (or `{ locale, timeZone,
 * units }`) as the second argument. Called with no options these behave as
 * before: English, the runtime's timezone.
 */
export {
  formatRelative,
  formatTime,
  formatDayHeading,
  formatDate,
  formatNumber,
  formatDistance,
  type FormatContext,
  type FormatOptions,
} from "@/lib/i18n/format";
