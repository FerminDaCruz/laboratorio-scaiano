"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// Colores desde los tokens (docs/design-system.md §7): el éxito va neutro,
// el error de sistema en danger. Que un error no se cierre solo se pide al
// llamar: toast.error(mensaje, { duration: Infinity }).
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          fontFamily: "var(--font-sans)",
          "--normal-bg": "var(--color-surface)",
          "--normal-text": "var(--color-ink)",
          "--normal-border": "var(--color-border)",
          "--success-bg": "var(--color-surface)",
          "--success-text": "var(--color-ink)",
          "--success-border": "var(--color-border)",
          "--error-bg": "var(--color-danger-soft)",
          "--error-text": "var(--color-danger)",
          "--error-border": "var(--color-danger)",
          "--warning-bg": "var(--color-warn-soft)",
          "--warning-text": "var(--color-warn)",
          "--warning-border": "var(--color-warn)",
          "--info-bg": "var(--color-info-soft)",
          "--info-text": "var(--color-info)",
          "--info-border": "var(--color-info)",
          "--border-radius": "var(--radius-md)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
