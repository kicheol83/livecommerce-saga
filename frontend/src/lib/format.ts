const wonFormatter = new Intl.NumberFormat("ko-KR");

export function formatWon(amount: number): string {
  return `${wonFormatter.format(amount)}원`;
}

export function discountRate(price: number, originalPrice: number): number {
  if (originalPrice <= 0 || price >= originalPrice) {
    return 0;
  }
  return Math.round((1 - price / originalPrice) * 100);
}

export function formatRemaining(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

const timeFormatter = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});

export function formatClock(value: string | number): string {
  return timeFormatter.format(new Date(value));
}

export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

export function formatDuration(seconds: number): string {
  if (seconds < 1) {
    return `${Math.round(seconds * 1000)}ms`;
  }
  if (seconds < 60) {
    return `${seconds.toFixed(seconds < 10 ? 1 : 0)}초`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest === 0 ? `${minutes}분` : `${minutes}분 ${rest}초`;
}

export function formatRelative(value: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000));
  if (seconds < 5) {
    return "방금";
  }
  if (seconds < 60) {
    return `${seconds}초 전`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}분 전`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}시간 전`;
  }
  return `${Math.floor(seconds / 86400)}일 전`;
}

export function formatCount(value: number): string {
  return wonFormatter.format(value);
}
