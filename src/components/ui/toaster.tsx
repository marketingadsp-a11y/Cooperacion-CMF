"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useIsMobile } from "@/hooks/use-mobile"

export function Toaster() {
  const { toasts } = useToast()
  const isMobile = useIsMobile()

  // En móvil duran 2 segundos (2000ms), en desktop 4 segundos (4000ms)
  const defaultDuration = isMobile ? 2000 : 4000

  return (
    <ToastProvider duration={defaultDuration}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast
            key={id}
            duration={(props as { duration?: number }).duration ?? defaultDuration}
            {...props}
          >
            <div className="grid gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
