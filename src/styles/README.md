# Organización de estilos

`src/styles.css` es solo el punto de entrada. Los estilos reales están separados por responsabilidad:

- `base.css`: tokens iniciales, reset, componentes base y estilos legacy.
- `visual-refresh.css`: capa visual principal de escritorio y componentes modernos.
- `responsive.css`: breakpoints, layout móvil, sidebar móvil, modales móviles.
- `dark.css`: overrides finales del modo oscuro. Debe importarse al final.

Regla práctica:

- Cambios de color global o variables: `base.css` o `dark.css`.
- Ajustes visuales de cards, tablas, botones o formularios: `visual-refresh.css`.
- Correcciones móviles: `responsive.css`.
- Correcciones exclusivas de modo oscuro: `dark.css`.

No agregar reglas nuevas directamente en `src/styles.css`; ese archivo debe conservar solo los `@import`.
