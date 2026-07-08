import { createCrudController } from './entity.controller';
import { metasService } from '../services/metas.service';

export const metasController = createCrudController({
  service: metasService,
  entityName: 'meta',
  requiredFields: ['nombre', 'monto_objetivo'],
  allowedFields: [
    'nombre',
    'descripcion',
    'monto_objetivo',
    'monto_actual',
    'fecha_objetivo',
    'estado',
  ],
});

