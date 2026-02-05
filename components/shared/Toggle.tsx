"use client";

export function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0f0f0f] ${
          on
            ? "border-blue-500/50 bg-blue-600"
            : "border-[#3f3f3f] bg-[#262626]"
        }`}
      >
        <span
          className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow transition-all duration-200 ease-out ${
            on ? "left-[calc(100%-1.125rem)]" : "left-0.5"
          }`}
          aria-hidden
        />
      </button>
      <span className={`min-w-[1.75rem] text-xs tabular-nums ${on ? "text-blue-400 font-medium" : "text-gray-500"}`}>
        {on ? "On" : "Off"}
      </span>
    </div>
  );
}
