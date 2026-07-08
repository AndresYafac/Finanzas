import {
  actualizarMovimiento,
  eliminarMovimiento,
  registrarMovimiento,
} from '../services/movimientos.service';

export const movimientosController = {
  registrar(supabase, payload) {
    return registrarMovimiento(supabase, payload);
  },
  actualizar(supabase, movimientoId, payload) {
    return actualizarMovimiento(supabase, movimientoId, payload);
  },
  eliminar(supabase, movimientoId) {
    return eliminarMovimiento(supabase, movimientoId);
  },
};

