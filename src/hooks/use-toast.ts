import * as React from "react";
import { sileo } from "sileo";

type ToastInput = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive";
  icon?: React.ReactNode;
};

function toast({ title, description, variant = "default", icon }: ToastInput) {
  const id =
    variant === "destructive"
      ? sileo.error({ title: String(title ?? "Error"), description, icon })
      : sileo.success({ title: String(title ?? "Success"), description, icon });

  return {
    id,
    dismiss: () => sileo.dismiss(id),
    update: (next: ToastInput) => {
      sileo.dismiss(id);
      return toast(next);
    },
  };
}

function useToast() {
  const dismiss = (toastId?: string) => {
    if (toastId) sileo.dismiss(toastId);
    else sileo.clear();
  };

  return {
    toasts: [],
    toast,
    dismiss,
  };
}

export { useToast, toast };
