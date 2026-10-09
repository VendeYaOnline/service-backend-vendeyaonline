import { Request, Response } from "express";
import { MercadoPagoConfig, PreApproval } from "mercadopago";
import axios from "axios";
import crypto from "crypto";
import User from "../models/users";
import Subscription from "../models/suscriptions";
import { SuscriptionI, UserI } from "../interfaces";
import { formatDate, getSubscriptionType } from "../utils";
import PreapprovaldSubscription from "../models/preapprovald_subscriptions";

// MercadoPago devuelve el init_point con "&activation=true", pero su checkout de
// suscripciones (mp-subscriptions-checkout-fe) responde INVALID_PARAMS ("Esta
// página no existe") cuando recibe ese parámetro. Sin él, la URL carga bien.
const sanitizeInitPoint = (initPoint?: string | null): string | undefined => {
  if (!initPoint) return undefined;
  try {
    const url = new URL(initPoint);
    url.searchParams.delete("activation");
    return url.toString();
  } catch {
    return initPoint.replace(/[?&]activation=true/, "");
  }
};

export const createSubscription = async (req: Request, res: Response) => {
  const client = new MercadoPagoConfig({
    accessToken: process.env.ACCESS_TOKEN!,
  });
  const preapproval = new PreApproval(client);
  try {
    const { plan, email, amount, user_id, quantityProducts } = req.body;

    const subscription = await preapproval.create({
      body: {
        payer_email: email,
        reason: "Plan " + plan,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: amount,
          currency_id: "COP",
        },
        back_url: "https://www.vendeyaonline.com/account",
        notification_url: "https://service-backend-vendeyaonline-production.up.railway.app/api/subscription_notification",
        status: "pending",
        external_reference: user_id + "-" + quantityProducts,
      } as any,
    });
    const { init_point, id: preapprovalId } = subscription;
    if (preapprovalId) {
      await Subscription.update(
        { subscriptionId: preapprovalId },
        { where: { client: user_id } }
      );
    }
    res.status(201).json({ subscription_url: sanitizeInitPoint(init_point) });
    return;
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};

export const updatePaymentMethod = async (req: Request, res: Response) => {
  const { preapproval_id } = req.body;

  if (!preapproval_id) {
    res.status(400).json({ message: "No se pudo obtener la URL de actualización de pago" });
    return;
  }

  try {
    // Buscamos por subscriptionId (== preapproval id) para conservar el guard de estado.
    const subscription = await Subscription.findOne({
      where: { subscriptionId: preapproval_id },
    });

    if (!subscription) {
      res.status(404).json({ message: "No se pudo obtener la URL de actualización de pago" });
      return;
    }

    const { dataValues } = subscription as { dataValues: SuscriptionI };

    if (dataValues.status !== "active" && dataValues.status !== "pause") {
      res.status(400).json({ message: "No se pudo obtener la URL de actualización de pago" });
      return;
    }

    const mpResponse = await axios.get(
      `https://api.mercadopago.com/preapproval/${preapproval_id}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { init_point } = mpResponse.data;

    if (!init_point) {
      res.status(500).json({ message: "No se pudo obtener la URL de actualización de pago" });
      return;
    }

    res.status(200).json({ url: sanitizeInitPoint(init_point) });
    return;
  } catch (error: any) {
    console.error("Error al obtener URL de actualización de pago:", error);
    res.status(500).json({ message: "No se pudo obtener la URL de actualización de pago" });
    return;
  }
};

// Devuelve el medio de pago vigente de la suscripción del usuario.
// Busca el pago más reciente asociado por external_reference y extrae marca,
// tipo y últimos 4 dígitos. Útil para que el cliente sepa qué tarjeta tiene
// antes de actualizarla y no repita la misma.
export const getPaymentMethod = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id || id === "undefined") {
    res.status(400).json({ message: "ID is missing" });
    return;
  }

  try {
    const user = await User.findByPk(id, { include: [Subscription] });
    if (!user) {
      res.status(404).json({ message: "The client does not exist" });
      return;
    }

    const { dataValues } = user as { dataValues: UserI };
    if (!dataValues.Subscriptions.length) {
      res.status(200).json({ paymentMethod: null });
      return;
    }

    const subscription = dataValues.Subscriptions[0].dataValues;
    const mpHeaders = {
      Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    };

    // El external_reference del preapproval es inmutable; lo preferimos sobre
    // reconstruirlo desde quantityProducts (que cambia si el cliente actualiza el plan).
    let externalReference = `${subscription.client}-${subscription.quantityProducts}`;
    try {
      const preapprovalResponse = await axios.get(
        `https://api.mercadopago.com/preapproval/${subscription.subscriptionId}`,
        { headers: mpHeaders }
      );
      if (preapprovalResponse.data?.external_reference) {
        externalReference = preapprovalResponse.data.external_reference;
      }
    } catch (preapprovalError: any) {
      console.error(
        "Error al obtener el preapproval, se usa external_reference reconstruido:",
        preapprovalError?.response?.data ?? preapprovalError?.message ?? preapprovalError
      );
    }

    const searchResponse = await axios.get(
      `https://api.mercadopago.com/v1/payments/search`,
      {
        params: {
          external_reference: externalReference,
          sort: "date_created",
          criteria: "desc",
          limit: 1,
        },
        headers: mpHeaders,
      }
    );

    const payment = searchResponse.data?.results?.[0];
    if (!payment) {
      res.status(200).json({ paymentMethod: null });
      return;
    }

    res.status(200).json({
      paymentMethod: {
        brand: payment.payment_method_id ?? null, // visa, master, account_money...
        type: payment.payment_type_id ?? null, // credit_card, debit_card, account_money...
        lastFourDigits: payment.card?.last_four_digits ?? null,
      },
    });
    return;
  } catch (error: any) {
    console.error(
      "Error al obtener el medio de pago:",
      error?.response?.data ?? error?.message ?? error
    );
    res.status(500).json({ message: "No se pudo obtener el medio de pago" });
    return;
  }
};

// Valida la firma del webhook de MercadoPago (header x-signature).
// Si MP_WEBHOOK_SECRET no está configurado, no bloquea (fail-open) pero avisa.
const isValidSignature = (req: Request): boolean => {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    console.warn(
      "[WEBHOOK] MP_WEBHOOK_SECRET no configurado; se omite la validación de firma."
    );
    return true;
  }

  const signature = req.headers["x-signature"] as string | undefined;
  const requestId = req.headers["x-request-id"] as string | undefined;
  if (!signature) {
    console.error("[WEBHOOK] Falta el header x-signature");
    return false;
  }

  const parts = signature.split(",").reduce<Record<string, string>>(
    (acc, part) => {
      const [key, value] = part.split("=");
      if (key && value) acc[key.trim()] = value.trim();
      return acc;
    },
    {}
  );

  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) {
    console.error("[WEBHOOK] x-signature mal formado");
    return false;
  }

  const dataId =
    (req.query["data.id"] as string) ?? req.body?.data?.id ?? "";

  // Plantilla del manifiesto según la documentación de MercadoPago.
  let manifest = "";
  if (dataId) manifest += `id:${String(dataId).toLowerCase()};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  const hmac = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  try {
    const valid = crypto.timingSafeEqual(
      Buffer.from(hmac),
      Buffer.from(v1)
    );
    if (!valid) console.error("[WEBHOOK] Firma inválida");
    return valid;
  } catch {
    console.error("[WEBHOOK] Error comparando la firma");
    return false;
  }
};

// El external_reference de las suscripciones creadas por esta app es
// "<idUsuario>-<cantidadProductos>". Suscripciones antiguas usan otro formato
// (p. ej. "<email>-Tienda online"); devolvemos null para poder ignorarlas.
const parseExternalReference = (reference: unknown) => {
  const match = /^(\d+)-(\d+)$/.exec(String(reference ?? ""));
  if (!match) return null;
  return { clientId: match[1], quantityProducts: match[2] };
};

// Crea la suscripción real en BD a partir de los datos de MercadoPago.
// Idempotente: si el usuario ya tiene una suscripción no hace nada, por lo que
// puede dispararse tanto desde "subscription_preapproval" como desde
// "subscription_authorized_payment" sin duplicar.
const activateSubscription = async (params: {
  clientId: string;
  quantityProducts: string;
  price: number;
  reason: string;
  dateCreated: string;
  subscriptionId: string;
}) => {
  const { clientId, quantityProducts, price, reason, dateCreated, subscriptionId } =
    params;

  // Si este preapproval ya está guardado, la suscripción existe (aunque el
  // external_reference apunte a otro id de usuario, p. ej. tras restaurar la BD).
  if (subscriptionId) {
    const existing = await Subscription.findOne({ where: { subscriptionId } });
    if (existing) {
      console.log("[WEBHOOK] El preapproval ya está registrado, se omite", subscriptionId);
      return;
    }
  }

  const user = await User.findByPk(clientId, { include: [Subscription] });
  if (!user) {
    console.log("[WEBHOOK] El cliente no existe", clientId);
    return;
  }

  const { dataValues } = user as { dataValues: UserI };

  if (dataValues.Subscriptions.length) {
    console.log("[WEBHOOK] El usuario ya tiene una suscripción, se omite (idempotencia)");
    return;
  }

  const subscriptionData = {
    client: clientId,
    price: Math.round(price),
    quantityProducts: quantityProducts,
    type: getSubscriptionType(reason),
    date: formatDate(dateCreated),
    subscriptionId: subscriptionId,
  };

  console.log("[WEBHOOK] Creando suscripción:", JSON.stringify(subscriptionData, null, 2));
  await Subscription.create(subscriptionData);
  console.log("[WEBHOOK] Suscripción creada exitosamente en BD");

  await PreapprovaldSubscription.destroy({ where: { client: clientId } });

  // Pausar la suscripción en MP después de guardar en BD (regla de negocio).
  if (subscriptionId) {
    try {
      await axios.put(
        `https://api.mercadopago.com/preapproval/${subscriptionId}`,
        { status: "paused" },
        {
          headers: {
            Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (pauseError) {
      console.error("Error al pausar suscripción en MP:", pauseError);
    }
  }

  // Enviar email de confirmación (no bloquea si falla).
  try {
    await axios.post(
      "https://app-email-production.up.railway.app/subscription-confirmed",
      {
        to: dataValues.email,
        client: dataValues.username,
        plan: getSubscriptionType(reason),
        price: Math.round(price),
        date: formatDate(dateCreated),
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (emailError) {
    console.error("Error al enviar email de confirmación:", emailError);
  }
};

export const webhook = async (req: Request, res: Response) => {
  try {
    if (!isValidSignature(req)) {
      res.sendStatus(401);
      return;
    }

    const { action, type, data } = req.body;
    console.log("[WEBHOOK] Body recibido:", JSON.stringify(req.body, null, 2));
    console.log(`[WEBHOOK] type="${type}" action="${action}" data.id="${data?.id}"`);
    // Señal MÁS RÁPIDA: el preapproval pasa a "authorized" en cuanto el usuario
    // confirma la suscripción, mucho antes que el primer cobro autorizado.
    if (type === "subscription_preapproval") {
      const preapprovalId = data.id;
      const mpResponse = await axios.get(
        `https://api.mercadopago.com/preapproval/${preapprovalId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      const preapproval = mpResponse.data;
      console.log("[WEBHOOK] preapproval:", JSON.stringify(preapproval, null, 2));

      if (preapproval.status !== "authorized") {
        console.log(`[WEBHOOK] preapproval ${preapprovalId} con status "${preapproval.status}", ignorando.`);
        res.sendStatus(200);
        return;
      }

      if (!preapproval.external_reference) {
        console.error("[WEBHOOK] external_reference no disponible en el preapproval", preapprovalId);
        res.sendStatus(200);
        return;
      }

      const reference = parseExternalReference(preapproval.external_reference);
      if (!reference) {
        console.log(`[WEBHOOK] external_reference con formato no reconocido "${preapproval.external_reference}", ignorando.`);
        res.sendStatus(200);
        return;
      }
      const { clientId, quantityProducts } = reference;
      console.log(`[WEBHOOK] clientId="${clientId}" quantityProducts="${quantityProducts}"`);

      await activateSubscription({
        clientId,
        quantityProducts,
        price: preapproval.auto_recurring?.transaction_amount,
        reason: preapproval.reason,
        dateCreated: preapproval.date_created,
        subscriptionId: preapprovalId,
      });

      res.sendStatus(200);
      return;
    } else if (type === "subscription_authorized_payment" && action === "created") {
      // Respaldo (idempotente) del primer cobro autorizado.
      const paymentId = data.id;
      const mercadopagoResponse = await axios.get(
        `https://api.mercadopago.com/authorized_payments/${paymentId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      const paymentData = mercadopagoResponse.data;
      const subscriptionId = paymentData.preapproval_id;

      console.log("[WEBHOOK] paymentData:", JSON.stringify(paymentData, null, 2));
      if (!paymentData.external_reference) {
        console.error("[WEBHOOK] external_reference no disponible en el pago autorizado", paymentId);
        res.sendStatus(200);
        return;
      }

      const reference = parseExternalReference(paymentData.external_reference);
      if (!reference) {
        console.log(`[WEBHOOK] external_reference con formato no reconocido "${paymentData.external_reference}", ignorando.`);
        res.sendStatus(200);
        return;
      }
      const { clientId, quantityProducts } = reference;
      console.log(`[WEBHOOK] clientId="${clientId}" quantityProducts="${quantityProducts}"`);

      await activateSubscription({
        clientId,
        quantityProducts,
        price: paymentData.transaction_amount,
        reason: paymentData.reason,
        dateCreated: paymentData.date_created,
        subscriptionId,
      });

      res.sendStatus(200);
      return;
    } else if (type === "payment" && action === "payment.created") {
      let mercadopagoResponse;
      try {
        mercadopagoResponse = await axios.get(
          `https://api.mercadopago.com/v1/payments/${data.id}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
          }
        );
      } catch (paymentError: any) {
        console.log(`[WEBHOOK] Pago ${data.id} no encontrado o rechazado, ignorando.`);
        res.sendStatus(200);
        return;
      }

      const paymentStatus = mercadopagoResponse.data.status;
      if (paymentStatus !== "approved") {
        console.log(`[WEBHOOK] Pago ${data.id} con status "${paymentStatus}", ignorando.`);
        res.sendStatus(200);
        return;
      }

      const externalReference = mercadopagoResponse.data.external_reference;
      if (!externalReference) {
        console.log(`[WEBHOOK] Pago ${data.id} sin external_reference, ignorando.`);
        res.sendStatus(200);
        return;
      }

      const reference = parseExternalReference(externalReference);
      if (!reference) {
        console.log(`[WEBHOOK] Pago ${data.id} con external_reference no reconocido "${externalReference}", ignorando.`);
        res.sendStatus(200);
        return;
      }

      // Solo sirve para el primer cobro (usuario aún sin suscripción en BD).
      // Los cobros mensuales de quien ya tiene suscripción no deben crear filas.
      const user = await User.findByPk(reference.clientId, { include: [Subscription] });
      const { dataValues: userData } = (user ?? { dataValues: null }) as {
        dataValues: UserI | null;
      };
      if (!userData || userData.Subscriptions.length) {
        console.log(`[WEBHOOK] Pago ${data.id}: usuario inexistente o con suscripción, ignorando.`);
        res.sendStatus(200);
        return;
      }

      await PreapprovaldSubscription.create({ client: reference.clientId });
      res.sendStatus(200);
      return;
    } else {
      res.sendStatus(200);
      return;
    }
  } catch (error: any) {
    console.error("[WEBHOOK] Error procesando la notificación:", error?.response?.data ?? error?.message ?? error);
    res.sendStatus(500);
  }
};
