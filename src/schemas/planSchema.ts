import Joi from "joi";

export const planSchemaUpdated = Joi.object({
  price: Joi.number().required(),
  client: Joi.number().required(),
  quantityProducts: Joi.number().optional(),
  type: Joi.string()
    .valid("Emprendedor", "Crecimiento", "Corporativo")
    .optional(),
});
