import Joi from "joi";

export const suscriptionSchema = Joi.object({
  price: Joi.number().required(),
  quantityProducts: Joi.number().required(),
  type: Joi.string()
    .valid("Emprendedor", "Crecimiento", "Corporativo")
    .required(),
  date: Joi.string().required(),
  date_limit: Joi.string().optional(),
  subscriptionId: Joi.string(),
  status: Joi.string().optional(),
  client: Joi.number().required(),
});

export const suscriptionSchemaUpdated = Joi.object({
  price: Joi.number().optional(),
  quantityProducts: Joi.number().optional(),
  status: Joi.string().optional(),
  type: Joi.string()
    .valid("Emprendedor", "Crecimiento", "Corporativo")
    .optional(),
  date: Joi.string().optional(),
  client: Joi.number().optional(),
});
