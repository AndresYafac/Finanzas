import { createCrudController } from './entity.controller';
import { presupuestosService } from '../services/presupuestos.service';

export const presupuestosController = createCrudController({
  service: presupuestosService,
  entityName: 'presupuesto',
  requiredFields: ['tipo', 'monto_limite', 'mes'],
  allowedFields: [
    'tipo',
    'tipo_movimiento_id',
    'categoria',
    'monto_limite',
    'mes',
    'notas',
  ],
});

