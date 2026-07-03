# Arquitectura MVC - FinTrack Pro

El proyecto ya inicio la separacion por capas. React sigue siendo la capa de interfaz, pero la logica comun se esta moviendo fuera de `main.jsx`.

## Estructura actual

```txt
src/
  components/
    ui.jsx
  config/
    supabase.js
  constants/
    authStorage.js
  controllers/
    auth.controller.js
    profile.controller.js
  services/
    feedback.js
  utils/
    format.js
    security.js
  main.jsx
  styles.css
```

## Responsabilidades

- `components/`: componentes visuales reutilizables.
- `config/`: inicializacion y configuracion de Supabase.
- `constants/`: claves y constantes compartidas.
- `controllers/`: acciones de negocio que ejecutan login, registro, perfil y PIN.
- `services/`: servicios transversales como alertas y confirmaciones.
- `utils/`: funciones puras de formato, fechas, seguridad y PIN.
- `main.jsx`: por ahora contiene el contenedor principal y las vistas grandes.

## Siguiente fase recomendada

Mover cada pantalla grande desde `main.jsx` hacia `views/`:

```txt
src/views/
  auth/
  dashboard/
  clientes/
  cuentas/
  deudas/
  pagos/
  movimientos/
  reportes/
  perfil/
  config/
```

Luego mover la logica de cada pantalla a su controller correspondiente:

```txt
src/controllers/
  clientes.controller.js
  cuentas.controller.js
  deudas.controller.js
  pagos.controller.js
  movimientos.controller.js
```

La regla es: la vista muestra datos y llama funciones; el controller consulta Supabase, valida y transforma datos.

