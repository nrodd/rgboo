import { MouseEventHandler, PropsWithChildren, useRef } from "react";
import { Testable } from "./types";
import { Container, ContainerProps } from "./Container";
import { useClickAway } from "../../libs/useClickAway";

interface DrawerProps extends Testable, ContainerProps {
  /** callback function */
  onClose: () => void;
  /** if `true`, the component is visible */
  open: boolean;
}

export const Drawer = ({
  children,
  "data-testid": testId = "drawer",
  onClose,
  open,
  ...containerProps
}: PropsWithChildren<DrawerProps>) => {
  const drawerRef = useRef(null);

  useClickAway(drawerRef, onClose);

  if (!open) return;

  return (
    <Container
      ref={drawerRef}
      className="fixed b-0 l-0 r-0 z-40 w-full m-1 pt-2"
      {...containerProps}
    >
      <div className="flex flex-col gap-2 items-center justify-center">
        <button
          onClick={onClose}
          data-testid={`${testId}-close-button`}
          className="w-16 h-0.5 bg-arcana-900/25 rounded-full"
        />
        {children}
      </div>
    </Container>
  );
};
