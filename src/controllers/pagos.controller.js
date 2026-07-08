import {
  actualizarPago,
  eliminarPago,
  registrarPago,
} from '../services/pagos.service';

export const pagosController = {
  registrar(supabase, payload) {
    return registrarPago(supabase, payload);
  },
  actualizar(supabase, pagoId, payload) {
    return actualizarPago(supabase, pagoId, payload);
  },
  eliminar(supabase, pagoId) {
    return eliminarPago(supabase, pagoId);
  },
};

