"use client";

const INFO_ICON_PATH =
  "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z";

export type InfoHintProps = {
  text: string;
  tooltip: string;
  id: string;
  compact?: boolean;
  tooltipCenter?: boolean;
  /** Pixels to shift the tooltip right (e.g. 32 for Exclude styles). */
  tooltipShiftRight?: number;
  /** Max width for the tooltip (e.g. "300px"). */
  tooltipMaxWidth?: string;
};

const tooltipBase =
  "pointer-events-none absolute bottom-full z-10 mb-1.5 hidden rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 text-sm text-gray-300 shadow-lg group-hover:block " +
  "before:absolute before:left-1/2 before:top-full before:box-border before:h-0 before:w-0 before:-translate-x-1/2 before:border-l-[7px] before:border-r-[7px] before:border-t-[7px] before:border-l-transparent before:border-r-transparent before:border-t-[#2a2a2a] before:content-[''] " +
  "after:absolute after:left-1/2 after:top-full after:box-border after:mt-[-1px] after:h-0 after:w-0 after:-translate-x-1/2 after:border-l-[6px] after:border-r-[6px] after:border-t-[6px] after:border-l-transparent after:border-r-transparent after:border-t-[#1a1a1a] after:content-['']";
const tooltipCentered =
  "left-1/2 -translate-x-1/2 text-left w-max max-w-[90vw]";
const tooltipCenteredWide =
  "left-1/2 -translate-x-1/2 text-left min-w-[18rem] max-w-[min(28rem,90vw)]";
const tooltipRight =
  "right-0 text-left min-w-[18rem] max-w-[min(28rem,90vw)]";

export function InfoHint({ text, tooltip, id, compact, tooltipCenter, tooltipShiftRight, tooltipMaxWidth }: InfoHintProps) {
  const centerOnIcon = compact || tooltipCenter;
  const tooltipClass = centerOnIcon
    ? compact
      ? tooltipCentered
      : tooltipCenteredWide
    : tooltipRight;
  const shiftStyle =
    !centerOnIcon && tooltipShiftRight != null
      ? { transform: `translateX(${tooltipShiftRight}px)` }
      : undefined;
  const tooltipStyle = {
    ...(tooltipMaxWidth ? { maxWidth: tooltipMaxWidth } : {}),
    ...(shiftStyle ?? {}),
  };

  return (
    <span
      className="group relative flex cursor-help items-center gap-0.5 text-xs text-gray-500"
      aria-describedby={id}
    >
      <span className="relative flex shrink-0 rounded-full p-0.5 transition-colors group-hover:bg-blue-500/20">
        <svg
          className="h-4 w-4 shrink-0 text-gray-500 transition-colors group-hover:text-blue-400"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden
        >
          <path fillRule="evenodd" d={INFO_ICON_PATH} clipRule="evenodd" />
        </svg>
        {centerOnIcon && (
          <span
            id={id}
            role="tooltip"
            className={`${tooltipBase} ${tooltipClass}`}
            style={tooltipMaxWidth ? { maxWidth: tooltipMaxWidth } : undefined}
          >
            {tooltip}
          </span>
        )}
      </span>
      {text}
      {!centerOnIcon && (
        <span
          id={id}
          role="tooltip"
          className={`${tooltipBase} ${tooltipClass}`}
          style={Object.keys(tooltipStyle).length > 0 ? tooltipStyle : undefined}
        >
          {tooltip}
        </span>
      )}
    </span>
  );
}
