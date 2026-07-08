import { createCrudController } from './entity.controller';
import { cuentasService } from '../services/cuentas.service';

export const cuentasController = createCrudController({
  service: cuentasService,
  entityName: 'cuenta',
  requiredFields: ['banco', 'tipo', 'moneda'],
  allowedFields: [
    'banco',
    'tipo',
    'moneda',
    'saldo',
    'numero',
    'cci',
    'notas',
  ],
});

