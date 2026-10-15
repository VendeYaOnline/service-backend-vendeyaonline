import axios from "axios";

/**
 * Complementos que se suman a la mensualidad del plan (vistas de pago del
 * panel de la tienda). El precio lo define este servidor, nunca el cliente.
 * `subscriptions.price` sigue siendo el precio del plan; lo que cobra Mercado
 * Pago es plan + complementos (ver `subscriptionTotal`).
 *
 * `subscriptions.addons` guarda cada complemento con el precio con el que se
 * activó: { key, price }. Así, si el precio cambia, quien ya lo tenía sigue
 * pagando lo mismo (es lo que Mercado Pago le cobra). Las entradas antiguas
 * son solo la clave ("marketing") y valen LEGACY_PRICES.
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
}

export const ADDON_KEYS = Object.keys(ADDONS) as AddonKey[];

export const isAddonKey = (value: unknown): value is AddonKey =>
  typeof value === "string" && (ADDON_KEYS as string[]).includes(value);

/** Lo guardado en la columna → complementos conocidos con su precio, sin repetir. */
export const addonEntries = (raw: unknown): AddonEntry[] => {
  if (!Array.isArray(raw)) return [];
  const entries: AddonEntry[] = [];
  for (const item of raw) {
    const key = typeof item === "string" ? item : item?.key;
    if (!isAddonKey(key) || entries.some((entry) => entry.key === key)) continue;
    const price = typeof item === "object" && Number.isFinite(Number(item?.price)) ? Math.round(Number(item.price)) : LEGACY_PRICES[key];
    entries.push({ key, price });
  }
  return entries;
};

/** Claves de los complementos activos. */
export const normalizeAddons = (raw: unknown): AddonKey[] => addonEntries(raw).map((entry) => entry.key);

/** Entrada nueva con el precio vigente. */
export const newAddonEntry = (key: AddonKey): AddonEntry => ({ key, price: ADDONS[key].price });

/** `raw` = lo guardado en la columna (no solo las claves). */
export const addonsTotal = (raw: unknown) => addonEntries(raw).reduce((sum, entry) => sum + entry.price, 0);

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
