import { MouseEventHandler, PropsWithChildren } from "react";
import { cn } from "../../libs/cn";
import { Container, ContainerProps } from "./Container";

interface ButtonProps extends ContainerProps {
  /** if `true`, the component is disabled */
  disabled?: boolean;
  /** if `true`, the component fills its container's width */
  fullWidth?: boolean;
  /** text label that renders when `children` is excluded */
  label?: string;
  /** callback function */
  onClick?: MouseEventHandler<HTMLButtonElement> | undefined;
  /** The HTML `type` attribute applied to `button` and `a` elements. */
  type?: "button" | "submit" | "reset";
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
      "group relative inline-flex min-w-[48px] min-h-[48px]",
      "px-4 py-1",
      "font-main uppercase text-base",
      "duration-100 ease-out",
      disabled
        ? "cursor-wait text-ghoul-900"
        : "cursor-pointer text-ghoul-400 active:text-ghoul-600",
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
        "absolute inset-2",
        "flex items-center justify-center",
        "rounded-full",
        "font-main uppercase text-base",
        "transition-[inset,font-size] duration-150 ease-in-out",

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
