/// <reference types="vite-plugin-svgr/client" />

declare module "*.svg?react" {
  import * as React from "react";
  const Component: React.ComponentType<any>;
  export default Component;
}

declare module "*.svg?url" {
  const src: string;
  export default src;
}

// Fallbacks for different import styles
declare module "*.svg" {
  import * as React from "react";
  const Component: React.ComponentType<any>;
  export default Component;
}

declare module "*?react" {
  import * as React from "react";
  const Component: React.FC<React.SVGProps<SVGSVGElement>>;
  export default Component;
}

declare global {
  interface Window {
    Twitch?: any;
  }
}

export {};
