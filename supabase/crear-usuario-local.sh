#!/usr/bin/env bash
# Crea un usuario en el Supabase LOCAL (el de `supabase start`) y le da su fila
# en public.usuarios. No sirve para el proyecto de producción.
#
#   bash supabase/crear-usuario-local.sh correo@ejemplo.test unaClaveDePrueba [admin|operador]
set -euo pipefail

EMAIL="${1:?falta el email}"
PASSWORD="${2:?falta la contraseña}"
ROL="${3:-admin}"
NOMBRE="${4:-$EMAIL}"

CLAVE_SERVICIO="$(npx supabase status -o json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).SERVICE_ROLE_KEY))')"
API="$(npx supabase status -o json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).API_URL))')"

curl -s -X POST "$API/auth/v1/admin/users" \
  -H "apikey: $CLAVE_SERVICIO" \
  -H "Authorization: Bearer $CLAVE_SERVICIO" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true}" > /dev/null

docker exec "supabase_db_$(basename "$PWD")" psql -U postgres -q -c \
  "insert into public.usuarios (id, nombre, rol)
   select id, '$NOMBRE', '$ROL' from auth.users where email = '$EMAIL'
   on conflict (id) do update set rol = excluded.rol, activo = true;"

echo "Usuario local listo: $EMAIL ($ROL)"
