import { MouseEventHandler } from "react";

export interface Styled {
  /** class overrides or additional styles */
  className?: string;
}

export interface Testable {
  "data-testid"?: string;
}

export interface BaseButtonProps {
  /** if `true`, the component is disabled */
  disabled?: boolean;
  /** button label. Doubles as `aria-label` */
  label: string;
  /** callback function */
  onClick?: MouseEventHandler<HTMLButtonElement> | undefined;
  /** The HTML `type` attribute applied to `button` and `a` elements. */
  type?: "button" | "submit" | "reset";
}
