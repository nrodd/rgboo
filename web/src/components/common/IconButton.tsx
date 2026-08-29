import { ReactNode } from "react";
import { BaseButtonProps } from "./types";
import { Container, ContainerProps } from "./Container";
import { cn } from "../../libs/cn";

interface IconButtonProps extends BaseButtonProps, ContainerProps {
  icon: ReactNode;
}

export const IconButton = ({
  "data-testid": testId = "button",
  disabled,
  icon,
  label,
  onClick,
  type = "button",
  ...containerProps
}: IconButtonProps) => (
  <button
    className="group button-base w-[48px] h-[48px]"
    data-testid={testId}
    disabled={disabled}
    aria-label={label}
    onClick={onClick}
    type={type}
  >
    <Container
      className={cn(
        "button-container px-1 py-1 inset-1.5",
        !disabled && [
          "group-hover:inset-0.5 group-hover:text-md",
          "group-active:inset-1 group-active:text-md",
        ],
      )}
      {...containerProps}
      data-testid={`${testId}-container`}
    >
      {icon}
    </Container>
  </button>
);
