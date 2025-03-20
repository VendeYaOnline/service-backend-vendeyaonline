import { Request, Response } from "express";
import { MercadoPagoConfig, PreApproval } from "mercadopago";
import axios from "axios";
import User from "../models/users";
import Subscription from "../models/suscriptions";
import { UserI } from "../interfaces";
import { formatDate, getSubscriptionType } from "../utils";

export const createSubscription = async (req: Request, res: Response) => {
  const client = new MercadoPagoConfig({
    accessToken: process.env.ACCESS_TOKEN!,
  });
  const preapproval = new PreApproval(client);
  try {
    const { plan, email, amount, user_id, quantityProducts } = req.body;

    const subscription = await preapproval.create({
      body: {
        payer_email: "test_user_1539335675@testuser.com",
        reason: "Plan " + plan,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: amount,
          currency_id: "COP",
        },
        back_url: "https://vendeyaonline.com/account",
        status: "pending",
        external_reference: user_id + "-" + quantityProducts,
      },
    });
    const { init_point, application_id } = subscription;
    res.status(201).json({ subscription_url: init_point, application_id });
    return;
  } catch (error: any) {
    return res.status(error.status).json({ message: error.message });
  }
};

export const webhook = async (req: Request, res: Response) => {
  try {
    const { action, type, data } = req.body;

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

      // Paso 2: Extraer el external_reference como ID del usuario
      const resultExternalReference = paymentData.external_reference.split("-");
      const clientId = resultExternalReference[0];
      const quantityProducts = resultExternalReference[1];

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
      };

      const subscription = await Subscription.create(subscriptionData);
      console.log("Suscripción creada:", subscription.dataValues);
    }
    console.log("LO QUE ME ENVIA MERCADO PAGO:", req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error("Error procesando la notificación:", error);
    res.sendStatus(500);
  }
};
