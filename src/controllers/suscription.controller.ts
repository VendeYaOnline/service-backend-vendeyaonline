import { Request, Response } from "express";
import { suscriptionSchema } from "../schemas/suscriptionSchema";
import Subscription from "../models/suscriptions";
import { SuscriptionI, UserI } from "../interfaces";
import User from "../models/users";

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
            .send(`Subscription created successfully ${dataValues.type}`);
        }
      }
    } catch (error: any) {
      res.status(500).json({
        error: `Error al crear el usuario - ${error.errors[0].message}`,
      });
    }
  }
};
