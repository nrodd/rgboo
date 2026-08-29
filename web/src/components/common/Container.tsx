import { PropsWithChildren } from "react";
import { cn } from "../../libs/cn";
import { Styled, Testable } from "./types";

export interface ContainerProps extends Styled, Testable {
  /** level of transparency **/
  variant?: "default" | "thick" | "thin";
}

export const Container = ({
  children,
  className,
  "data-testid": testId = "container",
  variant = "default",
}: PropsWithChildren<ContainerProps>) => (
  <div
    data-testid={testId}
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
