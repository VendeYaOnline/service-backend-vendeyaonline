import { Request, Response } from "express";
import { MercadoPagoConfig, PreApproval } from "mercadopago";

export const createSubscription = async (req: Request, res: Response) => {
  const client = new MercadoPagoConfig({
    accessToken: process.env.ACCESS_TOKEN!,
  });
  const preapproval = new PreApproval(client);
  try {
    const { plan, email } = req.body;

    const subscription = await preapproval.create({
      body: {
        payer_email: email,
        reason: plan === "web" ? "Página web" : "Tienda online",
        external_reference:
          email + "-" + (plan === "web" ? "Página web" : "Tienda online"),
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: plan === "web" ? 30000 : 60000,
          currency_id: "COP",
        },
        back_url: "https://vendeyaonline.com/account",
      },
    });

    const { init_point, application_id } = subscription;
    res.status(201).json({ subscription_url: init_point, application_id });
    return;
  } catch (error: any) {
    return res.status(error.status).json({ message: error.message });
  }
};
