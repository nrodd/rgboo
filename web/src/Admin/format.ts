export const formatWait = (seconds?: number) => {
  if (seconds === undefined || seconds <= 0) return "Ready now";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (!minutes) return `In ${remainingSeconds}s`;
  return `In ${minutes}m${remainingSeconds ? ` ${remainingSeconds}s` : ""}`;
};

export const formatSyncTime = (date: Date | null) => {
  if (!date) return "Connecting…";
  return `Synced ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}`;
};
