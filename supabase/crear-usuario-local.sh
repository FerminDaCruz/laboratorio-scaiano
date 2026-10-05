#!/usr/bin/env bash
# Crea un usuario en el Supabase LOCAL (el de `supabase start`) y le da su fila
# en public.usuarios. No sirve para el proyecto de producción.
#
#   bash supabase/crear-usuario-local.sh correo@ejemplo.test unaClaveDePrueba [admin|operador] [Nombre]
#
# La contraseña tiene que tener al menos 6 caracteres.
set -euo pipefail

EMAIL="${1:?falta el email}"
PASSWORD="${2:?falta la contraseña}"
ROL="${3:-admin}"
NOMBRE="${4:-$EMAIL}"

if [ "${#PASSWORD}" -lt 6 ]; then
  echo "La contraseña tiene que tener al menos 6 caracteres." >&2
  exit 1
fi

# `supabase status -o env` imprime VARIABLE="valor", así que se puede leer
# directamente desde bash, sin depender de node.
ESTADO="$(npx supabase status -o env 2>/dev/null)" || {
  echo "No se pudo leer el estado de Supabase. ¿Está levantado? Probá: npx supabase start" >&2
  exit 1
}
eval "$(printf '%s\n' "$ESTADO" | grep -E '^(API_URL|SERVICE_ROLE_KEY|DB_URL)=')"

if [ -z "${API_URL:-}" ] || [ -z "${SERVICE_ROLE_KEY:-}" ]; then
  echo "Supabase local no está corriendo. Probá: npx supabase start" >&2
  exit 1
fi

RESPUESTA="$(curl -s -X POST "$API_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true}")"

# Si el usuario ya existía, se sigue igual: solo hace falta su fila en usuarios.
if printf '%s' "$RESPUESTA" | grep -q '"error\|"msg"'; then
  if printf '%s' "$RESPUESTA" | grep -qi "already been registered"; then
    echo "El usuario $EMAIL ya existía; le actualizo la contraseña y el rol."
    ID="$(docker exec "supabase_db_$(basename "$PWD")" psql -U postgres -tA -c       "select id from auth.users where email = '$EMAIL';")"
    curl -s -X PUT "$API_URL/auth/v1/admin/users/$ID"       -H "apikey: $SERVICE_ROLE_KEY"       -H "Authorization: Bearer $SERVICE_ROLE_KEY"       -H "Content-Type: application/json"       -d "{\"password\":\"$PASSWORD\"}" > /dev/null
  else
    echo "No se pudo crear el usuario:" >&2
    printf '%s\n' "$RESPUESTA" >&2
    exit 1
  fi
fi

CONTENEDOR="supabase_db_$(basename "$PWD")"
docker exec "$CONTENEDOR" psql -U postgres -q -c \
  "insert into public.usuarios (id, nombre, rol)
   select id, '$NOMBRE', '$ROL' from auth.users where email = '$EMAIL'
   on conflict (id) do update set rol = excluded.rol, nombre = excluded.nombre, activo = true;"

echo "Usuario local listo: $EMAIL ($ROL)"
