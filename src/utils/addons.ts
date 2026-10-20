import axios from "axios";

/**
 * Complementos que se suman a la mensualidad del plan (vistas de pago del
 * panel de la tienda). El precio lo define este servidor, nunca el cliente.
 * `subscriptions.price` sigue siendo el precio del plan; lo que cobra Mercado
 * Pago es plan + complementos (ver `subscriptionTotal`).
 *
 * `subscriptions.addons` guarda cada complemento con el precio con el que se
 * activó: { key, price, cancel_at? }. Así, si el precio cambia, quien ya lo
 * tenía sigue pagando lo mismo hasta que se le aplique el cambio programado
 * (utils/addon-prices.ts). Las entradas antiguas son solo la clave
 * ("marketing") y valen LEGACY_PRICES.
 *
 * Cancelación al terminar el mes: `cancel_at` = fecha del próximo cobro. Desde
 * que se cancela ya no se suma al monto de Mercado Pago (el próximo cobro sale
 * sin él), pero la tienda la sigue usando hasta esa fecha. Pasada la fecha, la
 * entrada se ignora (y se borra en la siguiente escritura).
 */
export const ADDONS = {
  marketing: { label: "Marketing", price: 20000 },
} as const;

export type AddonKey = keyof typeof ADDONS;

/** Precio de las entradas antiguas (solo la clave), el vigente cuando se activaron. */
const LEGACY_PRICES: Record<AddonKey, number> = { marketing: 10000 };

export interface AddonEntry {
  key: AddonKey;
  price: number;
  /** Fecha (ISO) en que deja de estar activo; null = activo y cobrándose. */
  cancel_at: string | null;
}

export const ADDON_KEYS = Object.keys(ADDONS) as AddonKey[];

export const isAddonKey = (value: unknown): value is AddonKey =>
  typeof value === "string" && (ADDON_KEYS as string[]).includes(value);

const expired = (entry: AddonEntry, now = Date.now()) => Boolean(entry.cancel_at) && new Date(entry.cancel_at as string).getTime() <= now;

/** Lo guardado en la columna → complementos vigentes con su precio, sin repetir (sin los ya vencidos). */
export const addonEntries = (raw: unknown): AddonEntry[] => {
  if (!Array.isArray(raw)) return [];
  const entries: AddonEntry[] = [];
  for (const item of raw) {
    const key = typeof item === "string" ? item : item?.key;
    if (!isAddonKey(key) || entries.some((entry) => entry.key === key)) continue;
    const price = typeof item === "object" && Number.isFinite(Number(item?.price)) ? Math.round(Number(item.price)) : LEGACY_PRICES[key];
    const cancelAt = typeof item === "object" && typeof item?.cancel_at === "string" ? item.cancel_at : null;
    const entry = { key, price, cancel_at: cancelAt };
    if (!expired(entry)) entries.push(entry);
  }
  return entries;
};

/** Claves de los complementos activos (incluye los cancelados que siguen vigentes hasta su fecha). */
export const normalizeAddons = (raw: unknown): AddonKey[] => addonEntries(raw).map((entry) => entry.key);

/** Lo que se cobra en la próxima mensualidad por complementos: los activos sin cancelación. */
export const addonsTotal = (raw: unknown) =>
  addonEntries(raw)
    .filter((entry) => !entry.cancel_at)
    .reduce((sum, entry) => sum + entry.price, 0);

/** Lo que se cobra cada mes: plan + complementos (`raw` = lo guardado en la columna). */
export const subscriptionTotal = (price: number, raw: unknown) =>
  Math.round(price) + addonsTotal(raw);

/**
 * API de Mercado Pago. MERCADOPAGO_API_URL solo se usa para pruebas locales
 * (un Mercado Pago simulado); en producción no se define.
 */
export const MP_API_URL = (process.env.MERCADOPAGO_API_URL || "https://api.mercadopago.com").replace(/\/+$/, "");

const mpHeaders = () => ({
  Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
  "Content-Type": "application/json",
});

export const getPreapproval = async (subscriptionId: string) =>
  (await axios.get(`${MP_API_URL}/preapproval/${subscriptionId}`, { headers: mpHeaders() })).data;

/**
 * Cambia el monto mensual del preapproval en Mercado Pago. MP solo permite
 * cambiarlo en estado "authorized", así que se autoriza temporalmente y se
 * deja en `finalStatus` aunque falle el cambio de monto.
 */
export const setPreapprovalAmount = async (
  subscriptionId: string,
  type: string,
  amount: number,
  finalStatus: "authorized" | "paused",
) => {
  const preapprovalUrl = `${MP_API_URL}/preapproval/${subscriptionId}`;
  const headers = mpHeaders();

  const preapproval = await getPreapproval(subscriptionId);
  if (preapproval.status !== "authorized") {
    await axios.put(preapprovalUrl, { status: "authorized" }, { headers });
  }
  try {
    await axios.put(
      preapprovalUrl,
      {
        reason: "Plan " + type,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: amount,
          currency_id: "COP",
        },
      },
      { headers },
    );
  } finally {
    if (finalStatus === "paused") {
      await axios.put(preapprovalUrl, { status: "paused" }, { headers });
    }
  }
};
