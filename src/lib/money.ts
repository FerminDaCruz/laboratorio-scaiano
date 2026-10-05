// Montos en enteros de centavos. Nunca float, nunca parseFloat sobre un monto.

export type Centavos = number;

function assertCentavos(valor: number): void {
  if (!Number.isSafeInteger(valor)) {
    throw new Error(`Monto inválido: ${valor} no es un entero de centavos`);
  }
}

/** 14400000 → "$ 144.000,00" · -1200000 → "($ 12.000,00)" */
export function formatARS(centavos: Centavos): string {
  assertCentavos(centavos);
  const abs = Math.abs(centavos);
  const pesos = String(Math.trunc(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cent = String(abs % 100).padStart(2, "0");
  const texto = `$ ${pesos},${cent}`;
  return centavos < 0 ? `(${texto})` : texto;
}

const NUMERIC = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Convierte un `numeric(12,2)` tal como llega de Supabase a centavos.
 * PostgREST lo manda como número JSON; se convierte pasando por el texto,
 * sin multiplicar floats.
 */
export function centavosDesdeNumeric(valor: number | string): Centavos {
  const texto = typeof valor === "number" ? String(valor) : valor.trim();
  const partes = NUMERIC.exec(texto);
  if (!partes) {
    throw new Error(`Monto inválido: "${texto}" no es un numeric(12,2)`);
  }
  const [, signo, enteros, decimales = ""] = partes;
  const centavos = Number(enteros) * 100 + Number(decimales.padEnd(2, "0"));
  assertCentavos(centavos);
  return signo && centavos !== 0 ? -centavos : centavos;
}

/**
 * Lee un monto tipeado por una persona y lo pasa a centavos.
 * Acepta "185000", "185.000,50", "185000,5" y "185000.50". Devuelve null si no se entiende.
 */
export function centavosDesdeTexto(texto: string): Centavos | null {
  const limpio = texto.replace(/[\s$]/g, "");
  if (limpio === "") return null;

  let normalizado: string;
  if (limpio.includes(",")) {
    // Con coma, el punto es separador de miles.
    normalizado = limpio.replace(/\./g, "").replace(",", ".");
  } else {
    const puntos = limpio.split(".").length - 1;
    const decimalesTrasPunto = limpio.slice(limpio.lastIndexOf(".") + 1).length;
    normalizado =
      puntos === 1 && decimalesTrasPunto <= 2 ? limpio : limpio.replace(/\./g, "");
  }

  if (!/^-?\d+(\.\d{1,2})?$/.test(normalizado)) return null;
  return centavosDesdeNumeric(normalizado);
}

/**
 * Formatea lo que se va tipeando en un campo de monto: separa los miles con
 * punto y deja como mucho dos decimales después de la coma.
 * "185000" → "185.000" · "1234567,5" → "1.234.567,5"
 */
export function formatearEntradaMonto(texto: string): string {
  const soloValidos = texto.replace(/[^\d.,]/g, "");
  // El punto es separador de miles: se descarta y se vuelve a calcular.
  const sinMiles = soloValidos.replace(/\./g, "");
  const tieneComa = sinMiles.includes(",");
  const [crudos = "", ...resto] = sinMiles.split(",");
  const decimales = resto.join("").slice(0, 2);

  let enteros = crudos.replace(/^0+(?=\d)/, "");
  if (enteros === "" && tieneComa) enteros = "0";

  const agrupados = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return tieneComa ? `${agrupados},${decimales}` : agrupados;
}

/** 18500050 → "185000,50", para mostrar dentro de un campo de texto. */
export function textoDesdeCentavos(centavos: Centavos): string {
  assertCentavos(centavos);
  const abs = Math.abs(centavos);
  const texto = `${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
  return centavos < 0 ? `-${texto}` : texto;
}

/**
 * Aumenta (o baja) un monto un porcentaje, con aritmética entera.
 * El porcentaje se pasa a puntos básicos para no multiplicar floats.
 */
export function aplicarPorcentaje(centavos: Centavos, porcentaje: number): Centavos {
  assertCentavos(centavos);
  const puntosBasicos = Math.round((100 + porcentaje) * 100);
  const resultado = Math.round((centavos * puntosBasicos) / 10000);
  assertCentavos(resultado);
  return resultado;
}

/**
 * Monto listo para mandar a Postgres. Viaja como texto para no pasar nunca por
 * un float; los tipos generados declaran `number`, así que el casteo vive acá
 * y en ningún otro lado.
 */
export function numericParaPostgres(centavos: Centavos): number {
  return centavosANumeric(centavos) as unknown as number;
}

/** 14400050 → "144000.50", para mandar a Postgres como numeric. */
export function centavosANumeric(centavos: Centavos): string {
  assertCentavos(centavos);
  const abs = Math.abs(centavos);
  const texto = `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return centavos < 0 ? `-${texto}` : texto;
}
