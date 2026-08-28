import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** utility function to merge lists of classnames */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
