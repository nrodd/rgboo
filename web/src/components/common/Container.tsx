import { PropsWithChildren } from "react";

export const Container = ({ children }: PropsWithChildren) => (
  <div className="bg-pumpkin-400 border-2 border-solid">{children}</div>
);
