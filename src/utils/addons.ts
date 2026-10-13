import axios from "axios";

/**
 * Complementos que se suman a la mensualidad del plan (vistas de pago del
 * panel de la tienda). El precio lo define este servidor, nunca el cliente.
 * `subscriptions.price` sigue siendo el precio del plan; lo que cobra Mercado
 * Pago es plan + complementos (ver `subscriptionTotal`).
 */
export const ADDONS = {
  marketing: { label: "Marketing", price: 10000 },
} as const;

export type AddonKey = keyof typeof ADDONS;

export const ADDON_KEYS = Object.keys(ADDONS) as AddonKey[];

export const isAddonKey = (value: unknown): value is AddonKey =>
  typeof value === "string" && (ADDON_KEYS as string[]).includes(value);

/** Lo guardado en la columna → claves conocidas, sin repetir. */
export const normalizeAddons = (raw: unknown): AddonKey[] =>
  Array.isArray(raw) ? ADDON_KEYS.filter((key) => raw.includes(key)) : [];

export const addonsTotal = (addons: unknown) =>
  normalizeAddons(addons).reduce((sum, key) => sum + ADDONS[key].price, 0);

/** Lo que se cobra cada mes: plan + complementos. */
export const subscriptionTotal = (price: number, addons: unknown) =>
  Math.round(price) + addonsTotal(addons);

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
