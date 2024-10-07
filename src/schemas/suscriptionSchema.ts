import Joi from "joi";

export const suscriptionSchema = Joi.object({
  price: Joi.string().required(),
  type: Joi.string().valid("Tienda Online", "Página web").required(),
  date: Joi.string().required(),
  client: Joi.number().required(),
});
