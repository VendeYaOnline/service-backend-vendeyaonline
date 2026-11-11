import axios from "axios";

/**
 * Productos creados por la tienda en su panel (backend-cliente), consultados
 * servidor a servidor para la barra "Uso de productos" de "Mi cuenta" y para
 * no permitir bajar a un plan con menos productos de los que ya tiene.
 *
 * El panel ubica la tienda por el correo de la cuenta de VendeYaOnline
 * (companies.vendeya_account_email; una cuenta = una tienda).
 *
 * VENDEYA_PANEL_URL: URL del backend del panel, sin /api.
 * VENDEYA_SERVICE_KEY: la misma clave compartida que usan los complementos.
 *
 * Devuelve null si no está configurado, si la cuenta no tiene una tienda
 * vinculada o si el panel no responde a tiempo: quien llama usa entonces el
 * valor guardado en subscriptions.numberProductsCreated.
 */

const TIMEOUT_MS = 3000;

const config = () => ({
  url: String(process.env.VENDEYA_PANEL_URL ?? "").replace(/\/+$/, ""),
  key: String(process.env.VENDEYA_SERVICE_KEY ?? ""),
});

export const getPanelProductCount = async (email: string): Promise<number | null> => {
  const { url, key } = config();
  if (!url || key.length < 32 || !email) return null;
  try {
    const { data } = await axios.post(
      `${url}/api/service/products/usage`,
      { email },
      { headers: { "x-service-key": key }, timeout: TIMEOUT_MS },
    );
    const products = Number(data?.products);
    return Number.isInteger(products) && products >= 0 ? products : null;
  } catch (error: any) {
    // Sin tienda vinculada es normal (cuentas sin tienda aún): no se registra.
    if (error?.response?.data?.code !== "ACCOUNT_NOT_FOUND") {
      const detail = error?.response ? `${error.response.status} ${error.response.data?.code ?? ""}` : error?.code ?? "error";
      console.error(`[panel-usage] No se pudo consultar el uso de productos: ${detail}`);
    }
    return null;
  }
};
