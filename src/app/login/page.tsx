"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ErrorConfiguracion, RUTA_LOGIN } from "@/components/layout/app-shell";
import { useSesion } from "@/components/layout/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabase } from "@/lib/supabase";

const esquema = z.object({
  email: z.string().trim().min(1, "Ingresá el email.").email("El email no es válido."),
  password: z.string().min(1, "Ingresá la contraseña."),
});

type Datos = z.infer<typeof esquema>;

/** Solo rutas internas, para que ?next= no pueda mandar a otro sitio. */
function destinoSeguro(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//") || next === RUTA_LOGIN) {
    return "/";
  }
  return next;
}

export default function LoginPage() {
  const router = useRouter();
  const sesion = useSesion();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (sesion.estado === "autenticado") router.replace(destinoSeguro());
  }, [sesion.estado, router]);

  async function entrar(datos: Datos) {
    const { error } = await getSupabase().auth.signInWithPassword(datos);
    if (!error) return; // la redirección la hace el efecto al cambiar la sesión

    if (error.code === "invalid_credentials") {
      setError("password", { message: "El email o la contraseña no son correctos." });
      return;
    }
    toast.error("No se pudo iniciar sesión. Revisá la conexión y probá de nuevo.", {
      duration: Infinity,
    });
  }

  // §6: Enter avanza al campo siguiente; Ctrl/Cmd + Enter envía.
  function alTeclear(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Enter" || !(e.target instanceof HTMLInputElement)) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      e.currentTarget.requestSubmit();
      return;
    }
    const enfocables = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>("input, button[type=submit]"),
    );
    enfocables[enfocables.indexOf(e.target) + 1]?.focus();
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-4 shadow-sm">
        <h1 className="text-xl font-semibold">Iniciar sesión</h1>

        {sesion.estado === "sin-configurar" ? (
          <div className="mt-6">
            <ErrorConfiguracion />
          </div>
        ) : (
          <form
            className="mt-6 flex flex-col gap-3"
            noValidate
            onSubmit={handleSubmit(entrar)}
            onKeyDown={alTeclear}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? "email-error" : undefined}
                {...register("email")}
              />
              {errors.email && (
                <p id="email-error" className="text-xs text-danger">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? "password-error" : undefined}
                {...register("password")}
              />
              {errors.password && (
                <p id="password-error" className="text-xs text-danger">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="flex justify-end pt-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Ingresando…" : "Iniciar sesión"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
