import { useMemo } from "react";

export const useDevEmbed = () => {
  return useMemo(() => {
    const raw = import.meta.env.VITE_DEV_EMBED;

    return raw === "true";
  }, [import.meta.env.VITE_DEV_EMBED]);
};
