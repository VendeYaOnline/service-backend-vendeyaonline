import { Request, Response } from "express";
import { MercadoPagoConfig, PreApproval } from "mercadopago";
import axios from "axios";
import User from "../models/users";
import Subscription from "../models/suscriptions";
import { SuscriptionI, UserI } from "../interfaces";
import { formatDate, getSubscriptionType } from "../utils";
import PreapprovaldSubscription from "../models/preapprovald_subscriptions";

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
    res.status(201).json({ subscription_url: init_point });
    return;
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};

export const updatePaymentMethod = async (req: Request, res: Response) => {
  const { id } = req.body;

  if (!id) {
    res.status(400).json({ message: "No se pudo obtener la URL de actualización de pago" });
    return;
  }

  try {
    const subscription = await Subscription.findByPk(id);

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
      `https://api.mercadopago.com/preapproval/${dataValues.subscriptionId}`,
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

    res.status(200).json({ url: init_point });
    return;
  } catch (error: any) {
    console.error("Error al obtener URL de actualización de pago:", error);
    res.status(500).json({ message: "No se pudo obtener la URL de actualización de pago" });
    return;
  }
};

export const webhook = async (req: Request, res: Response) => {
  try {
    const { action, type, data } = req.body;
    console.log("[WEBHOOK] Body recibido:", JSON.stringify(req.body, null, 2));
    console.log(`[WEBHOOK] type="${type}" action="${action}" data.id="${data?.id}"`);
    if (type === "subscription_authorized_payment" && action === "created") {
      // Paso 1: Consultar la API de Mercado Pago
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

      // Paso 2: Extraer el external_reference como ID del usuario
      console.log("[WEBHOOK] paymentData:", JSON.stringify(paymentData, null, 2));
      if (!paymentData.external_reference) {
        console.error("[WEBHOOK] external_reference no disponible en el pago autorizado", paymentId);
        res.sendStatus(200);
        return;
      }
      const resultExternalReference = paymentData.external_reference.split("-");
      const clientId = resultExternalReference[0];
      const quantityProducts = resultExternalReference[1];
      console.log(`[WEBHOOK] clientId="${clientId}" quantityProducts="${quantityProducts}"`);

      // Paso 3: Validar el usuario en la base de datos
      const user = await User.findByPk(clientId, {
        include: [Subscription],
      });

      if (!user) {
        console.log("El cliente no existe");
        res.sendStatus(200);
        return;
      }

      const { dataValues } = user as { dataValues: UserI };

      // Paso 4: Verificar si ya tiene una suscripción activa
      if (dataValues.Subscriptions.length) {
        console.log("El usuario ya tiene una suscripción activa");
        res.sendStatus(200);
        return;
      }

      // Paso 5: Crear la suscripción con los datos de Mercado Pago
      const subscriptionData = {
        client: clientId,
        price: Math.round(paymentData.transaction_amount),
        quantityProducts: quantityProducts,
        type: getSubscriptionType(paymentData.reason),
        date: formatDate(paymentData.date_created),
        subscriptionId: subscriptionId,
      };

      console.log("[WEBHOOK] Creando suscripción:", JSON.stringify(subscriptionData, null, 2));
      await Subscription.create(subscriptionData);
      console.log("[WEBHOOK] Suscripción creada exitosamente en BD");
      await PreapprovaldSubscription.destroy({
        where: { client: clientId },
      });

      // Pausar la suscripción en MP después de guardar en BD
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

      // Enviar email de confirmación (no bloquea si falla)
      try {
        await axios.post(
          "https://app-email-production.up.railway.app/subscription-confirmed",
          {
            to: dataValues.email,
            client: dataValues.username,
            plan: getSubscriptionType(paymentData.reason),
            price: Math.round(paymentData.transaction_amount),
            date: formatDate(paymentData.date_created),
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

      const client = externalReference.split("-")[0];
      await PreapprovaldSubscription.create({ client: client });
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
