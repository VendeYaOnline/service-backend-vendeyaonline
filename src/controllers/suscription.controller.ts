import { Request, Response } from "express";
import {
  suscriptionSchema,
  suscriptionSchemaUpdated,
} from "../schemas/suscriptionSchema";
import Subscription from "../models/suscriptions";
import { SuscriptionI, UserI } from "../interfaces";
import User from "../models/users";
import CanceledSubscription from "../models/canceled_subscriptions";

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
      error: `Error subscription - ${error.errors[0].message}`,
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
      error: `Error subscription - ${error.errors[0].message}`,
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
        error: `Error creating user - ${error.errors[0].message}`,
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
      await Subscription.update(data, {
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
  res: Response
) => {
  const { error } = suscriptionSchema.validate(req.body);
  if (error) {
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
      res.status(500).json({
        error: `Error creating user - ${error.errors[0].message}`,
      });
    }
  }
};

export const createActiveSubscriptions = async (
  req: Request,
  res: Response
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
          const subscription = await Subscription.create(data);
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
      res.status(500).json({
        error: `Error creating user - ${error.errors[0].message}`,
      });
    }
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
        include: [Subscription, CanceledSubscription],
      });
      const { dataValues } = user as { dataValues: UserI };
      if (
        dataValues.Subscriptions.length &&
        !dataValues.CanceledSubscriptions.length
      ) {
        res.status(200).json({
          subscription: {
            ...dataValues.Subscriptions[0].dataValues,
            status: "Activo",
          },
        });
        return;
      } else if (
        dataValues.CanceledSubscriptions.length &&
        !dataValues.Subscriptions.length
      ) {
        res.status(200).json({
          subscription: {
            ...dataValues.CanceledSubscriptions[0].dataValues,
            status: "Proceso de cancelación",
          },
        });
        return;
      } else {
        res.status(200).json({ subscription: undefined });
        return;
      }
    } catch (error: any) {
      res.status(500).json({
        error: `Error subscription - ${error.errors[0].message}`,
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
        error: `Error cancellation - ${error.errors[0].message}`,
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
  res: Response
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
