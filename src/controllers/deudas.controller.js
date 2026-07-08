import { createCrudController } from './entity.controller';
import { deudasService } from '../services/deudas.service';

export const deudasController = createCrudController({
  service: deudasService,
  entityName: 'cuenta por cobrar',
  requiredFields: ['descripcion', 'monto_total', 'cliente_id'],
  allowedFields: [
    'cliente_id',
    'cuenta_id',
    'descripcion',
    'monto_total',
    'monto_pagado',
    'interes',
    'tipo',
    'fecha_inicio',
    'fecha_vencimiento',
    'estado',
    'notas',
  ],
});

