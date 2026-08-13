import Joi from 'joi';
import { Response, NextFunction, Request } from 'express';

export function validate(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, { stripUnknown: true, abortEarly: false });

    if (error) {
      return res.status(400).json({
        error: error.details.map((d) => d.message).join('; '),
        code: 'VALIDATION_ERROR',
      });
    }

    req.body = value;
    next();
  };
}
