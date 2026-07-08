import {
  actualizarPagoPrestamoRecibido,
  actualizarPrestamoOtorgado,
  actualizarPrestamoRecibido,
  eliminarPagoPrestamoRecibido,
  eliminarPrestamoOtorgado,
  eliminarPrestamoRecibido,
  registrarPagoPrestamoRecibido,
  registrarPrestamoOtorgado,
  registrarPrestamoRecibido,
} from '../services/prestamos.service';

export const prestamosController = {
  otorgados: {
    registrar: registrarPrestamoOtorgado,
    actualizar: actualizarPrestamoOtorgado,
    eliminar: eliminarPrestamoOtorgado,
  },
  recibidos: {
    registrar: registrarPrestamoRecibido,
    actualizar: actualizarPrestamoRecibido,
    eliminar: eliminarPrestamoRecibido,
  },
  pagosRecibidos: {
    registrar: registrarPagoPrestamoRecibido,
    actualizar: actualizarPagoPrestamoRecibido,
    eliminar: eliminarPagoPrestamoRecibido,
  },
};

