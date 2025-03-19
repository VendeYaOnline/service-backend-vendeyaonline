import { Request, Response } from "express";
import { MercadoPagoConfig, PreApproval } from "mercadopago";

export const createSubscription = async (req: Request, res: Response) => {
  const client = new MercadoPagoConfig({
    accessToken: process.env.ACCESS_TOKEN!,
  });
  const preapproval = new PreApproval(client);
  try {
    const { plan, email, amount } = req.body;

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
      },
    });
    const { init_point, application_id } = subscription;
    res.status(201).json({ subscription_url: init_point, application_id });
    return;
  } catch (error: any) {
    return res.status(error.status).json({ message: error.message });
  }
};

export const webhook = (req: Request, res: Response) => {
  try {
    console.log("Notificación recibida:", req.body);

    // Verifica si la notificación es de tipo suscripción
    if (
      req.body.action === "subscription_create" ||
      req.body.action === "subscription_update"
    ) {
      const subscriptionId = req.body.data.id;
      console.log("ID de la suscripción:", subscriptionId);

      // Aquí puedes consultar la API de Mercado Pago si necesitas más detalles
    }

    res.sendStatus(200); // Responde a Mercado Pago para confirmar recepción
  } catch (error) {
    console.error("Error procesando la notificación:", error);
    res.sendStatus(500);
  }
};
