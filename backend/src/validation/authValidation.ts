import Joi from 'joi';

export const registerSchema = Joi.object({
  email: Joi.string().trim().email().max(255).required(),
  name: Joi.string().trim().min(1).max(100).required(),
  password: Joi.string().min(8).max(128).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().trim().email().max(255).required(),
  password: Joi.string().min(1).max(128).required(),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().trim().email().max(255).required(),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().trim().min(1).required(),
  password: Joi.string().min(8).max(128).required(),
});
