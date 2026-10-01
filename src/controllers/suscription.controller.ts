import { Request, Response } from "express";
import {
  suscriptionSchema,
  suscriptionSchemaUpdated,
} from "../schemas/suscriptionSchema";
import Subscription from "../models/suscriptions";
import { SuscriptionI, UserI } from "../interfaces";
import User from "../models/users";
import CanceledSubscription from "../models/canceled_subscriptions";
import PreapprovaldSubscription from "../models/preapprovald_subscriptions";
import { planSchemaUpdated } from "../schemas/planSchema";
import axios from "axios";
import jwt from "jsonwebtoken";

export const getAllSuscription = async (_req: Request, res: Response) => {
  try {
    const subscription = await Subscription.findAll();
    if (subscription.length) {
      res.status(200).json({ subscription });
      return;
    } else {
      res.status(200).json({ subscription: [] });
      return;
    }
  } catch (error: any) {
    res.status(500).json({
      message: "Error subscription",
    });
    return;
  }
};

export const getSuscriptionByUser = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const user = await User.findOne({
      where: { id },
      include: [Subscription, CanceledSubscription],
    });
    const { dataValues } = user as { dataValues: UserI };
    if (
      dataValues.Subscriptions.length ||
      dataValues.CanceledSubscriptions.length
    ) {
      res.status(200).json({
        subscription: true,
      });
      return;
    } else {
      res.status(200).json({
        subscription: false,
      });
      return;
    }
  } catch (error: any) {
    res.status(500).json({
      message: "Error subscription",
    });
    return;
  }
};

export const getAllCancellations = async (_req: Request, res: Response) => {
  try {
    const subscription = await CanceledSubscription.findAll();
    if (subscription.length) {
      res.status(200).json({ subscription });
      return;
    } else {
      res.status(200).json({ subscription: [] });
      return;
    }
  } catch (error: any) {
    res.status(500).json({
      message: "Error subscription",
    });
    return;
  }
};

export const createSuscription = async (req: Request, res: Response) => {
  const { error } = suscriptionSchema.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.details[0].message });
    return;
  } else {
    try {
      const data = req.body;
      const user = await User.findByPk(data.client, {
        include: [Subscription, CanceledSubscription],
      });
      if (!user) {
        res.status(404).json({
          message: "The client does not exist",
        });
        return;
      } else {
        const { dataValues } = user as { dataValues: UserI };
        await removeCanceledSuscription(dataValues);
        if (dataValues.Subscriptions.length) {
          res.status(409).json({
            message: "The user already has an active subscription",
          });
          return;
        } else {
          const subscription = await Subscription.create(data);
          const { dataValues } = subscription as { dataValues: SuscriptionI };
          res.status(201).json({
            message: `Subscription created successfully ${dataValues.type}`,
          });
        }
      }
    } catch (error: any) {
      res.status(500).json({
        message: "Error creating user",
      });
    }
  }
};

export const updatedSuscription = async (req: Request, res: Response) => {
  const { error } = suscriptionSchemaUpdated.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.details[0].message });
    return;
  } else {
    try {
      const data = req.body;
      const { id } = req.params;
      const headers = {
        Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      };
      const subscription = await Subscription.update(data, {
        returning: true,
        where: { id },
      });
      const { dataValues } = subscription[1][0] as { dataValues: SuscriptionI };
      const preapprovalUrl = `https://api.mercadopago.com/preapproval/${dataValues.subscriptionId}`;
      if (data.status === "active") {
        await axios.put(preapprovalUrl, { status: "authorized" }, { headers });
        res.status(200).json({ message: "Updated Subscription" });
        return;
      } else {
        await axios.put(preapprovalUrl, { status: "paused" }, { headers });
        res.status(200).json({ message: "Updated Subscription" });
        return;
      }
    } catch (error) {
      res.status(500).json({ error: "Error updating" });
      return;
    }
  }
};

const FIXED_PLANS: Record<string, { products: number; price: number }> = {
  Emprendedor: { products: 50, price: 50000 },
  Crecimiento: { products: 100, price: 80000 },
};

// Precio oficial de un plan; null si type/quantityProducts no corresponden a un plan válido.
const getPlanPrice = (type: string, quantityProducts: number) => {
  const fixed = FIXED_PLANS[type];
  if (fixed) return fixed.products === quantityProducts ? fixed.price : null;
  if (type === "Corporativo") {
    const valid =
      quantityProducts >= 150 &&
      quantityProducts <= 1000 &&
      (quantityProducts - 150) % 50 === 0;
    return valid ? 130000 + (quantityProducts - 150) * 1000 : null;
  }
  return null;
};

export const updatedPlan = async (req: Request, res: Response) => {
  const { error } = planSchemaUpdated.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const data = req.body;
    const user = await User.findByPk(data.client, { include: Subscription });

    if (!user) {
      return res.status(404).json({ message: "The client does not exist" });
    }

    const { dataValues } = user as { dataValues: UserI };

    // El cliente solo puede cambiar su propio plan.
    const token = req.header("Authorization")?.split(" ")[1];
    const payload = token ? jwt.decode(token) : null;
    if (
      !payload ||
      typeof payload === "string" ||
      payload.email !== dataValues.email
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const subscription = dataValues.Subscriptions[0]?.dataValues;

    if (!subscription) {
      return res.status(404).json({ message: "No subscription found" });
    }

    const { id, numberProductsCreated, status, subscriptionId } = subscription;

    if (status !== "active" && status !== "pause") {
      return res
        .status(400)
        .json({ message: "It is not possible to update the plan" });
    }

    // El precio lo define el servidor, no el cliente.
    const price = getPlanPrice(data.type, data.quantityProducts);
    if (price === null || price !== data.price) {
      return res.status(400).json({ message: "Invalid plan or price" });
    }

    if (numberProductsCreated > data.quantityProducts) {
      return res.status(400).json({ message: "Error updating plan" });
    }

    const preapprovalUrl = `https://api.mercadopago.com/preapproval/${subscriptionId}`;
    const headers = {
      Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    };
    const amountBody = {
      reason: "Plan " + data.type,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: price,
        currency_id: "COP",
      },
    };

    // Primero Mercado Pago; la BD solo se actualiza si este paso funciona.
    if (status === "pause") {
      // Mercado Pago solo permite cambiar el monto en estado authorized.
      await axios.put(preapprovalUrl, { status: "authorized" }, { headers });
      try {
        await axios.put(preapprovalUrl, amountBody, { headers });
      } finally {
        // Se vuelve a pausar aunque falle el cambio de monto.
        await axios.put(preapprovalUrl, { status: "paused" }, { headers });
      }
    } else {
      await axios.put(preapprovalUrl, amountBody, { headers });
    }

    await Subscription.update(
      { type: data.type, price, quantityProducts: data.quantityProducts },
      { where: { id } },
    );

    return res.status(200).json({ message: "Updated Subscription" });
  } catch (error) {
    return res.status(500).json({ error: "Error updating" });
  }
};

export const cancellationsSuscription = async (req: Request, res: Response) => {
  const { error } = suscriptionSchemaUpdated.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.details[0].message });
    return;
  } else {
    try {
      const data = req.body;
      const { id } = req.params;
      await CanceledSubscription.update(data, {
        where: { id },
      });
      res.status(200).json({ message: "Updated Subscription" });
      return;
    } catch (error) {
      res.status(500).json({ error: "Error updating" });
      return;
    }
  }
};

export const createCanceledSubscriptions = async (
  req: Request,
  res: Response,
) => {
  const { error } = suscriptionSchema.validate(req.body);
  if (error) {
    console.log("sass", error);
    res.status(400).json({ error: error.details[0].message });
    return;
  } else {
    try {
      const data = req.body;
      const user = await User.findByPk(data.client, { include: Subscription });
      if (!user) {
        res.status(404).json({
          message: "The client does not exist",
        });
        return;
      } else {
        const { dataValues } = user as { dataValues: UserI };
        if (dataValues.Subscriptions.length) {
          await Subscription.destroy({
            where: { id: dataValues.Subscriptions[0].dataValues.id },
          });
          const canceledSubscription = await CanceledSubscription.create(data);
          const { dataValues: dataSubscription } = canceledSubscription as {
            dataValues: SuscriptionI;
          };
          res.status(201).json({
            message: `Subscription created successfully ${dataSubscription.type}`,
          });
          return;
        } else {
          res.status(409).json({
            message: "The user does not have a subscription",
          });
          return;
        }
      }
    } catch (error: any) {
      console.log("Error al canelar", error);
      res.status(500).json({
        message: "Error creating user",
      });
    }
  }
};

export const createActiveSubscriptions = async (
  req: Request,
  res: Response,
) => {
  const { error } = suscriptionSchema.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.details[0].message });
    return;
  } else {
    try {
      const data = req.body;
      const user = await User.findByPk(data.client, {
        include: CanceledSubscription,
      });
      if (!user) {
        res.status(404).json({
          message: "The client does not exist",
        });
        return;
      } else {
        const { dataValues } = user as { dataValues: UserI };
        if (dataValues.CanceledSubscriptions.length) {
          await CanceledSubscription.destroy({
            where: { id: dataValues.CanceledSubscriptions[0].dataValues.id },
          });
          const subscription = await Subscription.create({
            ...data,
            status: "active",
          });
          const { dataValues: dataSubscription } = subscription as {
            dataValues: SuscriptionI;
          };
          res.status(201).json({
            message: `Subscription created successfully ${dataSubscription.type}`,
          });
          return;
        } else {
          res.status(409).json({
            message: "The user does not have a subscription",
          });
          return;
        }
      }
    } catch (error: any) {
      console.log("Error al activar", error);
      res.status(500).json({
        message: "Error creating user",
      });
    }
  }
};

export const createCanceledSubscriptionsPause = async (
  req: Request,
  res: Response,
) => {
  try {
    const data = req.body;
    const user = await User.findByPk(data.client, {
      include: Subscription,
    });
    if (!user) {
      res.status(404).json({
        message: "The client does not exist",
      });
      return;
    } else {
      const { dataValues } = user as { dataValues: UserI };
      if (dataValues.Subscriptions.length) {
        await Subscription.update(
          { status: "pause-canceled" },
          { where: { id: dataValues.Subscriptions[0].dataValues.id || 0 } },
        );
        res.status(201).json({
          message: "Subscription updated successfully",
        });
        return;
      } else {
        res.status(409).json({
          message: "The user does not have a subscription",
        });
        return;
      }
    }
  } catch (error: any) {
    console.log("Error al activar", error);
    res.status(500).json({
      message: "Error creating user",
    });
  }
};

export const createActiveSubscriptionsPause = async (
  req: Request,
  res: Response,
) => {
  try {
    const data = req.body;
    const user = await User.findByPk(data.client, {
      include: Subscription,
    });
    if (!user) {
      res.status(404).json({
        message: "The client does not exist",
      });
      return;
    } else {
      const { dataValues } = user as { dataValues: UserI };
      if (dataValues.Subscriptions.length) {
        await Subscription.update(
          { status: "pause" },
          { where: { id: dataValues.Subscriptions[0].dataValues.id || 0 } },
        );
        res.status(201).json({
          message: "Subscription updated successfully",
        });
        return;
      } else {
        res.status(409).json({
          message: "The user does not have a subscription",
        });
        return;
      }
    }
  } catch (error: any) {
    console.log("Error al activar", error);
    res.status(500).json({
      message: "Error creating user",
    });
  }
};

export const getSuscription = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || id === "undefined") {
    res.status(400).json({ error: "ID is missing" });
    return;
  } else {
    try {
      const user = await User.findOne({
        where: { id },
        include: [Subscription, CanceledSubscription, PreapprovaldSubscription],
      });
      const { dataValues } = user as { dataValues: UserI };
      if (
        dataValues.Subscriptions.length &&
        !dataValues.CanceledSubscriptions.length
      ) {
        const subscriptionData = dataValues.Subscriptions[0].dataValues;
        // El preapproval id se persiste en subscriptionId al crear la suscripción,
        // así evitamos una consulta en vivo a MercadoPago en cada lectura.
        res.status(200).json({
          subscription: {
            ...subscriptionData,
            email: dataValues.email,
            date_limit: "",
            preapproval_id: subscriptionData.subscriptionId,
          },
          preapproval: false,
        });
        return;
      } else if (
        dataValues.CanceledSubscriptions.length &&
        !dataValues.Subscriptions.length
      ) {
        res.status(200).json({
          subscription: {
            ...dataValues.CanceledSubscriptions[0].dataValues,
            email: dataValues.email,
          },
          preapproval: false,
        });
        return;
      } else {
        res.status(200).json({
          subscription: undefined,
          preapproval: dataValues.PreapprovaldSubscription ? true : false,
        });
        return;
      }
    } catch (error: any) {
      res.status(500).json({
        message: "Error subscription",
      });
      return;
    }
  }
};

export const getCanceledSuscription = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || id === "undefined") {
    res.status(400).json({ error: "ID is missing" });
    return;
  } else {
    try {
      const user = await User.findOne({
        where: { id },
        include: CanceledSubscription,
      });
      const { dataValues } = user as { dataValues: UserI };
      if (dataValues.CanceledSubscriptions.length) {
        return res.status(200).json({
          subscription: [dataValues.CanceledSubscriptions[0].dataValues],
        });
      } else {
        return res.status(200).json({ subscription: [] });
      }
    } catch (error: any) {
      res.status(500).json({
        error: "Error cancellation",
      });
      return;
    }
  }
};

const removeCanceledSuscription = async (user: UserI) => {
  if (user.CanceledSubscriptions.length) {
    await CanceledSubscription.destroy({
      where: { id: user.CanceledSubscriptions[0].dataValues.id },
    });
  }
};

export const deleteSuscription = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ message: "ID required" });
    return;
  } else {
    await Subscription.destroy({ where: { id } });
    res.status(204).json({ message: "Subscription deleted" });
    return;
  }
};

export const deleteCanceledSuscription = async (
  req: Request,
  res: Response,
) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ message: "ID required" });
    return;
  } else {
    await CanceledSubscription.destroy({ where: { id } });
    res.status(204).json({ message: "Subscription deleted" });
    return;
  }
};

export const deletePreapprovald = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ message: "ID required" });
    return;
  } else {
    await PreapprovaldSubscription.destroy({
      where: { client: id },
    });
  }
};
