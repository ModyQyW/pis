"use client";

import type { ReactNode } from "react";

import { Toaster as BaseToaster, toast as baseToast } from "@/components/ui/toast";

type Options = {
  description?: ReactNode;
  timeout?: number;
};

type ToastFn = ((message: ReactNode, options?: Options) => void) & {
  success: (message: ReactNode, options?: Options) => void;
  error: (message: ReactNode, options?: Options) => void;
  warning: (message: ReactNode, options?: Options) => void;
  info: (message: ReactNode, options?: Options) => void;
  promise: <T>(
    promise: Promise<T>,
    options: {
      loading: ReactNode;
      success: ReactNode | ((value: T) => ReactNode);
      error: ReactNode | ((error: unknown) => ReactNode);
    },
  ) => Promise<T>;
};

function add(type: string | undefined, message: ReactNode, options?: Options) {
  baseToast.add({
    type,
    title: message,
    description: options?.description,
    timeout: options?.timeout,
  });
}

export const toast = Object.assign(
  ((message: ReactNode, options?: Options) => add(undefined, message, options)) as ToastFn,
  {
    success: (message: ReactNode, options?: Options) => add("success", message, options),
    error: (message: ReactNode, options?: Options) => add("error", message, options),
    warning: (message: ReactNode, options?: Options) => add("warning", message, options),
    info: (message: ReactNode, options?: Options) => add("info", message, options),
    promise: <T,>(
      promise: Promise<T>,
      options: {
        loading: ReactNode;
        success: ReactNode | ((value: T) => ReactNode);
        error: ReactNode | ((error: unknown) => ReactNode);
      },
    ) =>
      baseToast.promise(promise, {
        loading: { title: options.loading },
        success: (value: T) => ({
          title: typeof options.success === "function" ? options.success(value) : options.success,
        }),
        error: (error: unknown) => ({
          title: typeof options.error === "function" ? options.error(error) : options.error,
        }),
      }),
  },
);

export function Toaster() {
  return <BaseToaster />;
}
