import {
  Banknote,
  BookOpenText,
  ClipboardList,
  FileText,
  ShieldCheck,
  Stethoscope,
  Tags,
  Truck,
  type LucideIcon,
} from "lucide-react";

export type ItemNav = { href: string; titulo: string; icono: LucideIcon };
export type GrupoNav = { titulo: string; items: ItemNav[] };

// Grupos del sidebar — docs/design-system.md §9.
export const GRUPOS_NAV: GrupoNav[] = [
  {
    titulo: "Producción",
    items: [
      { href: "/ordenes", titulo: "Órdenes", icono: ClipboardList },
      { href: "/remitos", titulo: "Remitos", icono: Truck },
    ],
  },
  {
    titulo: "Cuentas",
    items: [
      { href: "/cuenta-corriente", titulo: "Cuenta corriente", icono: BookOpenText },
      { href: "/pagos", titulo: "Pagos", icono: Banknote },
      { href: "/liquidaciones", titulo: "Liquidaciones", icono: FileText },
    ],
  },
  {
    titulo: "Datos",
    items: [
      { href: "/doctores", titulo: "Doctores", icono: Stethoscope },
      { href: "/trabajos", titulo: "Trabajos", icono: Tags },
      { href: "/obras-sociales", titulo: "Obras sociales", icono: ShieldCheck },
    ],
  },
];

const TITULOS_FUERA_DEL_NAV: Record<string, string> = {
  "/": "Inicio",
  "/reportes": "Reportes del mes",
  "/tokens": "Tokens del design system",
  "/odontograma": "Odontograma",
  "/ordenes/nueva": "Nueva orden",
  "/trabajos/precios": "Actualizar precios",
};

export function esRutaActiva(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function tituloDeRuta(pathname: string): string {
  const propio = TITULOS_FUERA_DEL_NAV[pathname];
  if (propio) return propio;

  for (const grupo of GRUPOS_NAV) {
    const item = grupo.items.find((i) => esRutaActiva(pathname, i.href));
    if (item) return item.titulo;
  }
  return "";
}
