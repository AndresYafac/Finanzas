# Análisis: Diseño Móvil - Menú de Navegación

## Fecha
2026-04-04

## Problema Reportado
En el diseño móvil, el menú de navegación aparece permanentemente en la parte inferior de la pantalla. Se solicita cambiar el flujo a: **Login → Pantalla de selección de módulos → Módulo seleccionado**.

---

## Estado Actual

### Comportamiento en Móvil (≤760px)

**Estructura del Sidebar:**
- El sidebar se transforma en una **barra de navegación inferior fija**
- Altura: 76px
- Posición: `fixed`, `bottom: 0`, `left: 0`, `right: 0`
- Z-index: 200
- Padding inferior incluye `env(safe-area-inset-bottom)` para dispositivos con notch

**Contenido del Menú:**
- Muestra **todos los módulos** en una fila horizontal
- Cada item: icono (20px) + texto (10px)
- Ancho fijo por item: 70px
- Scroll horizontal habilitado para navegación
- Secciones visibles: Principal, Finanzas, Análisis, Sistema

**Espacio Ocupado:**
- El main tiene `padding-bottom: 116px` para evitar superposición
- Altura total del menú: 76px + safe area
- Ocupación permanente en pantalla

**Flujo de Navegación Actual:**
```
1. Login (pantalla Auth)
   ↓
2. Dashboard (directamente)
   ↓
3. Menú inferior siempre visible para navegación entre módulos
```

**Archivos Involucrados:**
- `src/main.jsx` (líneas 314-396): Renderizado del layout con sidebar
- `src/styles.css` (líneas 1103-1382): Estilos responsive para móvil

---

## Problemas Identificados

1. **Espacio desperdiciado:** El menú ocupa 76px permanentes en pantallas pequeñas
2. **Clutter visual:** Muchos módulos visibles simultáneamente (10+ items)
3. **Texto pequeño:** Labels de 10px difíciles de leer
4. **Navegación no intuitiva:** El usuario entra directamente al dashboard sin elegir módulo
5. **Experiencia mobile-first deficiente:** No aprovecha el patrón de "pantalla de inicio" común en apps móviles

---

## Solución Propuesta

### 1. Cambios en `src/main.jsx`

#### Nuevo Estado
```javascript
const [showModuleSelector, setShowModuleSelector] = React.useState(false);
```

#### Efecto para Detectar Móvil
```javascript
React.useEffect(() => {
  if (isMobileViewport() && session && profile && !showModuleSelector) {
    setShowModuleSelector(true);
    setPage('dashboard');
  }
}, [session, profile]);
```

#### Funciones de Navegación Modificadas
```javascript
function openPage(nextPage) {
  if ((nextPage === 'config' || nextPage === 'usuarios-admin') && !isAdmin) return;
  if (!can(nextPage, 'view')) return notify('No tienes permiso para ver este módulo.');
  setPage(nextPage);
  setShowModuleSelector(false); // Ocultar selector al entrar a módulo
}

function showModules() {
  setShowModuleSelector(true);
  setPage('dashboard');
}
```

#### Renderizado Condicional

**En móvil (≤760px):**
- **NO renderizar** el `<aside className="sidebar">`
- Mostrar pantalla de selección de módulos cuando `showModuleSelector = true`
- En topbar: botón para regresar a módulos

**En escritorio (>760px):**
- Mantener sidebar lateral normal
- Comportamiento sin cambios

**Estructura del Topbar en Móvil:**
```jsx
{isMobile && showModuleSelector && (
  <button className="btn btn-icon" onClick={showModules} title="Módulos">
    <LayoutDashboard size={24} />
  </button>
)}
{isMobile && !showModuleSelector && (
  <button className="btn btn-icon" onClick={showModules} title="Módulos">
    <ArrowRightLeft size={24} />
  </button>
)}
{!isMobile && (
  <button className="btn btn-icon sidebar-toggle" onClick={toggleSidebar}>
    <SidebarPanelIcon collapsed={sidebarHidden} size={30} />
  </button>
)}
```

**Renderizado de Contenido:**
```jsx
{showModuleSelector && isMobile ? (
  <div className="page active page-modules">
    <div className="modules-grid">
      {pages.map(([section, items]) => (
        <div key={section} className="module-section">
          <h3 className="module-section-title">{section}</h3>
          <div className="module-cards">
            {items.filter(([, , , visible]) => visible).map(([id, label, Icon]) => (
              <button key={id} className="module-card" onClick={() => openPage(id)}>
                <div className="module-card-icon">
                  <Icon size={28} />
                </div>
                <span className="module-card-label">{label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
) : (
  <div className={`page active page-${page}`}>
    {/* Contenido normal del módulo */}
  </div>
)}
```

---

### 2. Cambios en `src/styles.css`

#### Ocultar Sidebar en Móvil
```css
@media (max-width: 760px) {
  .sidebar {
    display: none;
  }
  
  .main {
    padding-bottom: 0; /* Sin padding extra para menú */
  }
}
```

#### Estilos para Pantalla de Módulos
```css
.page-modules {
  padding: 24px 16px;
}

.modules-grid {
  display: grid;
  gap: 28px;
}

.module-section {
  margin-bottom: 4px;
}

.module-section-title {
  font-size: 12px;
  font-weight: 800;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
  padding: 0 4px;
}

.module-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.module-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 28px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  color: var(--text);
  text-align: center;
  transition: all 0.15s ease;
  min-height: 120px;
}

.module-card:active {
  transform: scale(0.97);
  background: var(--bg);
}

.module-card-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary), #158765);
  border-radius: 16px;
  color: #fff;
  box-shadow: 0 8px 20px rgba(29, 158, 117, 0.2);
}

.module-card-icon svg {
  width: 28px;
  height: 28px;
}

.module-card-label {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
}
```

#### Ajustes en Topbar Móvil
```css
@media (max-width: 760px) {
  .topbar-left {
    gap: 10px;
  }
  
  .mobile-module-selector .sidebar-toggle {
    display: none;
  }
}
```

---

## Flujo de Navegación Propuesto

### Móvil (≤760px)
```
1. Login (pantalla Auth)
   ↓
2. Pantalla de Selección de Módulos
   - Grid 2xN con tarjetas
   - Organizado por secciones
   - Iconos grandes (56px) + labels legibles
   ↓
3. Módulo Seleccionado
   - Contenido completo del módulo
   - Botón en topbar para regresar a módulos
   ↓
4. Regresar a Selección de Módulos
   - Botón con icono ArrowRightLeft
```

### Escritorio (>760px)
```
1. Login (pantalla Auth)
   ↓
2. Dashboard (directamente)
   ↓
3. Sidebar lateral para navegación
   - Sin cambios en comportamiento actual
```

---

## Estructura de Datos

### Módulos por Sección

**Principal:**
- Dashboard
- Clientes

**Finanzas:**
- Cuentas bancarias
- Pendientes por cobrar
- Préstamos otorgados
- Cobros de préstamos
- Préstamos recibidos
- Pagos de préstamos recibidos
- Cobros generales
- Ingresos / Egresos
- Presupuestos
- Metas

**Análisis:**
- Reportes
- Backup
- Auditoría

**Sistema:**
- Mi perfil (todos)
- Usuarios (solo admin)
- Configuración (solo admin)

---

## Consideraciones Técnicas

### Dependencias
- `isMobileViewport()`: Función auxiliar en `src/utils/security.js` que detecta viewport móvil
- `LayoutDashboard` y `ArrowRightLeft`: Iconos de lucide-react (ya importados en main.jsx)

### Persistencia
- No requiere cambios en localStorage
- El estado `showModuleSelector` se resetea al hacer login/logout

### Permisos
- Los módulos ya filtran visibilidad según permisos de usuario
- La pantalla de módulos respeta el filtrado existente

### Accesibilidad
- Botones grandes (mínimo 120px altura) para touch
- Iconos de 56px con contraste adecuado
- Labels legibles de 13px
- Feedback visual con `:active` state

---

## Beneficios de la Solución

1. **Más espacio en pantalla:** Sin menú permanente, el contenido ocupa todo el viewport
2. **Navegación clara:** Pantalla dedicada para elegir módulo
3. **Menos clutter:** Solo se muestra un módulo a la vez
4. **Mejor UX móvil:** Patrón estándar en apps móviles (home screen)
5. **Texto legible:** Labels de 13px vs 10px actual
6. **Touch-friendly:** Tarjetas grandes con feedback visual
7. **Escalable:** Fácil agregar nuevos módulos al grid

---

## Archivos a Modificar

1. **`src/main.jsx`**
   - Agregar estado `showModuleSelector`
   - Agregar efecto para detectar móvil
   - Modificar funciones `openPage()` y agregar `showModules()`
   - Modificar renderizado del layout (condicional para móvil)
   - Modificar topbar (botones condicionales)
   - Modificar renderizado de contenido (condicional para pantalla de módulos)

2. **`src/styles.css`**
   - Ocultar sidebar en móvil
   - Eliminar padding-bottom del main en móvil
   - Agregar estilos para `.page-modules`, `.modules-grid`, `.module-section`, `.module-cards`, `.module-card`

---

## Pruebas Requeridas

1. **Login en móvil:** Verificar que aparece pantalla de módulos
2. **Selección de módulo:** Verificar que entra al módulo correcto
3. **Botón de regreso:** Verificar que regresa a pantalla de módulos
4. **Responsive:** Verificar que en escritorio no cambia el comportamiento
5. **Permisos:** Verificar que respeta filtrado de módulos por rol
6. **Orientación:** Verificar en portrait y landscape
7. **Safe area:** Verificar en dispositivos con notch (iPhone)

---

## Riesgos y Consideraciones

1. **Cambio de flujo:** Los usuarios existentes pueden extrañar el menú inferior
2. **Navegación:** Requiere un paso adicional (seleccionar módulo) antes de acceder a contenido
3. **Compatibilidad:** Asegurar que el breakpoint de 760px funcione correctamente en todos los dispositivos
4. **Performance:** El grid de módulos debe renderizar eficientemente

---

## Recomendación

Implementar la solución propuesta ya que:
- Mejora significativamente la experiencia móvil
- Sigue patrones estándar de diseño mobile-first
- No afecta el comportamiento en escritorio
- Es escalable y mantenible

---

## Estado

✅ Análisis completado  
⏳ Esperando aprobación para implementación