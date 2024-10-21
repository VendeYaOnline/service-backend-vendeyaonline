import Joi from "joi";

export const suscriptionSchema = Joi.object({
  price: Joi.number().required(),
  type: Joi.string().valid("Tienda Online", "Página web").required(),
  date: Joi.string().required(),
  client: Joi.number().required(),
});

export const suscriptionSchemaUpdated = Joi.object({
  price: Joi.number().optional(),
  type: Joi.string().valid("Tienda Online", "Página web").optional(),
  date: Joi.string().optional(),
  client: Joi.number().optional(),
});
