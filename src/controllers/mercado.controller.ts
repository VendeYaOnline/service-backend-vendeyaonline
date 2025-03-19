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
        external_reference: "10",
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
    const { action, type } = req.body;
    if (type === "subscription_authorized_payment" && action === "created") {
      const subscriptionId = req.body.data.id;
      console.log("Pago aprobado:", req.body);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Error procesando la notificación:", error);
    res.sendStatus(500);
  }
};
