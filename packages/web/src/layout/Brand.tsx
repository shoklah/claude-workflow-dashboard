/** The app's name and mark: an outline eye in the current ink, its pupil two of the backdrop's orbs (docs/design/2026-11-17-menu/mark.svg). */
export function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-3 pt-1 pb-2">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path
          d="M2 12c2.6-4.6 6-7 10-7s7.4 2.4 10 7c-2.6 4.6-6 7-10 7s-7.4-2.4-10-7z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="10.6" cy="11" r="3.6" className="fill-mark-pink" />
        <circle cx="13.4" cy="13" r="3.6" className="fill-mark-teal" opacity=".9" />
      </svg>
      <span className="text-xl font-light tracking-tight">
        ed<b className="font-bold">ward</b>
      </span>
    </div>
  );
}
