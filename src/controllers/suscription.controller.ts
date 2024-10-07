import { Request, Response } from "express";
import { suscriptionSchema } from "../schemas/suscriptionSchema";
import Subscription from "../models/suscriptions";
import { SuscriptionI, UserI } from "../interfaces";
import User from "../models/users";
import CanceledSubscription from "../models/canceled_subscriptions";

export const createSuscription = async (req: Request, res: Response) => {
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
          res.status(409).json({
            message: "The user already has an active subscription",
          });
          return;
        } else {
          const subscription = await Subscription.create(data);
          const { dataValues } = subscription as { dataValues: SuscriptionI };
          res
            .status(201)
            .json({
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
