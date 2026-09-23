type IconProps = {
  className?: string;
};

export function EyeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M1.8 10s3-5.6 8.2-5.6S18.2 10 18.2 10s-3 5.6-8.2 5.6S1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.6" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="10" cy="10" r="7.4" />
      <path d="M10 5.8V10l2.8 1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="m5 10.4 3.2 3.1L15 6.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CrossIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="m6 6 8 8M14 6l-8 8" strokeLinecap="round" />
    </svg>
  );
}
