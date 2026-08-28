import { type ClassValue } from "clsx";
import { PropsWithChildren } from "react";
import { cn } from "../../libs/cn";

interface ContainerProps {
  /** class overrides or additional styles */
  className?: string;
  /** level of transparency **/
  variant?: "default" | "thick" | "thin";
}

export const Container = ({
  children,
  className,
  variant = "default",
}: PropsWithChildren<ContainerProps>) => (
  <div
    className={cn(
      "px-6 py-3 glass align-center justify-center",
      variant === "thick" ? "glass-thick" : "",
      variant === "thin" ? "glass-thin" : "",
      className,
    )}
  >
    {children}
  </div>
);
