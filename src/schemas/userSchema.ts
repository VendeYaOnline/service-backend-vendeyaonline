import Joi from "joi";

export const userSchema = Joi.object({
  username: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  lastname: Joi.string().required(),
  department: Joi.string().required(),
  phone: Joi.string().required(),
  city: Joi.string().required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});
