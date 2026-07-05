import { createEntityService } from './entity.service';

export const prestamosOtorgadosService = createEntityService('deudas');
export const prestamosRecibidosService = createEntityService('prestamos_recibidos');
export const pagosPrestamosRecibidosService = createEntityService('pagos_prestamos_recibidos');
