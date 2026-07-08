import { createCrudController } from './entity.controller';
import { clientesService } from '../services/clientes.service';

export const clientesController = createCrudController({
  service: clientesService,
  entityName: 'cliente',
  requiredFields: ['nombre'],
  allowedFields: [
    'nombre',
    'apellido',
    'tipo_doc',
    'documento',
    'email',
    'telefono',
    'direccion',
    'notas',
    'user_id',
  ],
});

