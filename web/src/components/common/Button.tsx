import { MouseEventHandler, PropsWithChildren } from "react";
import { cn } from "../../libs/cn";
import { Container, ContainerProps } from "./Container";
import { BaseButtonProps } from "./types";

interface ButtonProps extends BaseButtonProps, ContainerProps {
  /** if `true`, the component is disabled */
  disabled?: boolean;
  /** if `true`, the component fills its container's width */
  fullWidth?: boolean;
}

export const Button = ({
  "data-testid": testId = "button",
  disabled,
  fullWidth = false,
  label,
  onClick,
  type = "button",
  ...containerProps
}: ButtonProps) => (
  <button
    className={cn(
      "group button-base min-w-[48px] min-h-[48px]",
      "px-4 py-1",
      fullWidth ? "w-full" : "w-fit",
    )}
    data-testid={testId}
    disabled={disabled}
    aria-label={label}
    onClick={onClick}
    type={type}
  >
    {/* Invisible element establishes the maximum size */}
    <span className="invisible px-0 py-1 font-main text-2xl uppercase">
      {label}
    </span>
    <Container
      className={cn(
        "button-container inset-2",
        !disabled && [
          "group-hover:inset-x-0 group-hover:inset-y-1 group-hover:text-md",
          "group-active:inset-x-0.5 group-active:inset-y-1.5 group-active:text-md",
        ],
      )}
      {...containerProps}
      data-testid={`${testId}-container`}
    >
      {label}
    </Container>
  </button>
);
