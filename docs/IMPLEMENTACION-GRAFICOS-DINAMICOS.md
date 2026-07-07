# Implementación de Gráficos Dinámicos y Configurables

## Análisis y Diseño

### Requerimientos
- Opción para elegir el tipo de gráfico (barras, líneas, área, circular)
- Selección dinámica de datos a mostrar
- Configuración persistente (guardada en localStorage)
- Integración con el dashboard existente
- Interfaz intuitiva y responsive

### Arquitectura Solución

#### 1. **Componente DynamicChart** (`src/components/DynamicChart.jsx`)
- Componente genérico que renderiza diferentes tipos de gráficos
- Soporta: Bar, Line, Area, Pie charts
- Configuraciones personalizables:
  - Tipo de gráfico
  - Claves de datos (xKey, yKey)
  - Etiquetas de ejes
  - Visibilidad de grid, leyenda, tooltip
  - Altura personalizable
  - Líneas curvas (para line/area charts)
  - Colores personalizados

#### 2. **Componente ChartConfig** (`src/components/ChartConfig.jsx`)
- Panel de configuración de gráficos
- Selección de tipo de gráfico con iconos
- Selección de fuente de datos (6 fuentes disponibles)
- Opciones de visualización:
  - Altura del gráfico (200-600px)
  - Mostrar cuadrícula
  - Mostrar leyenda
  - Mostrar tooltip
  - Línea curva (para line/area)
- Botones: Restablecer, Cancelar, Guardar

#### 3. **Servicio chartData.service.js** (`src/services/chartData.service.js`)
Prepara los datos para cada fuente:

**Fuentes disponibles:**
- **accounts**: Balance de cuentas por banco
- **debts**: Cuentas por cobrar (cobrado vs pendiente)
- **payments**: Cobros del mes por día
- **movements**: Ingresos vs Egresos
- **budgets**: Uso de presupuestos
- **goals**: Progreso de metas

Cada fuente retorna:
```javascript
{
  data: [...], // Array de objetos con label y value
  config: { xKey, yKey, xLabel, yLabel }
}
```

#### 4. **Integración en Dashboard** (`src/pages/Dashboard.jsx`)
- Estado para configuración del gráfico (chartConfig)
- Persistencia en localStorage con clave `fintrack_dashboard_chart`
- Botón "Configurar gráfico" en toolbar
- Modal de configuración
- Tarjeta de gráfico dinámico integrada

#### 5. **Estilos** (`src/styles/chart-styles.css`)
- Estilos para el componente DynamicChart
- Estilos para el panel ChartConfig
- Grid responsive para tipos de gráfico
- Opciones de datos con radio buttons
- Checkboxes para opciones de visualización
- Tarjeta de gráfico con hover effects
- Media queries para responsive

## Características Implementadas

### ✅ Tipos de Gráfico
1. **Barras**: Comparativa entre categorías
2. **Líneas**: Tendencias temporales
3. **Área**: Volumen acumulado
4. **Circular**: Distribución porcentual

### ✅ Fuentes de Datos
1. Balance de cuentas
2. Cuentas por cobrar
3. Cobros del mes
4. Ingresos vs Egresos
5. Presupuestos
6. Metas

### ✅ Opciones de Configuración
- Altura ajustable (200-600px)
- Cuadrícula visible/oculta
- Leyenda visible/oculta
- Tooltip visible/oculto
- Línea curva (para line/area charts)
- Colores automáticos por categoría

### ✅ Persistencia
- Configuración guardada en localStorage
- Se mantiene entre sesiones
- Valores por defecto definidos

### ✅ Responsive
- Adaptable a móviles (760px)
- Adaptable a tablets (1000px)
- Grid flexible

## Uso

### Para el usuario:
1. Hacer clic en "Configurar gráfico" en el dashboard
2. Seleccionar tipo de gráfico deseado
3. Elegir fuente de datos
4. Ajustar opciones de visualización
5. Hacer clic en "Guardar configuración"

### Para desarrolladores:

#### Agregar nueva fuente de datos:
```javascript
// En src/services/chartData.service.js
case 'nueva_fuente':
  return {
    data: [...], // Transformar datos
    config: {
      xKey: 'label',
      yKey: 'value',
      xLabel: 'Eje X',
      yLabel: 'Eje Y'
    }
  };
```

#### Agregar nuevo tipo de gráfico:
```javascript
// En src/components/DynamicChart.jsx
case 'nuevo_tipo':
  return (
    <NuevoChart {...commonProps}>
      {/* Configuración del gráfico */}
    </NuevoChart>
  );
```

#### Modificar opciones de visualización:
```javascript
// En src/components/ChartConfig.jsx
// Agregar en la sección "Opciones de visualización"
<label className="checkbox-option">
  <input
    type="checkbox"
    checked={draft.nuevaOpcion}
    onChange={(e) => updateDraft('nuevaOpcion', e.target.checked)}
  />
  <span>Nueva opción</span>
</label>
```

## Dependencias
- **recharts**: Librería de gráficos para React
  - Instalada: v2.15.0
  - Componentes utilizados: BarChart, LineChart, AreaChart, PieChart, etc.

## Estructura de Archivos

```
src/
├── components/
│   ├── DynamicChart.jsx      # Componente genérico de gráficos
│   └── ChartConfig.jsx       # Panel de configuración
├── services/
│   └── chartData.service.js  # Preparación de datos
├── styles/
│   └── chart-styles.css      # Estilos del sistema
└── pages/
    └── Dashboard.jsx          # Integración en dashboard
```

## Próximas Mejoras Posibles

1. **Múltiples gráficos**: Permitir agregar varios gráficos al dashboard
2. **Comparativas**: Gráficos comparativos entre períodos
3. **Exportación**: Exportar gráficos como imagen/PDF
4. **Filtros avanzados**: Filtros por fecha, categoría, etc.
5. **Tiempo real**: Actualización automática de datos
6. **Animaciones**: Transiciones suaves entre configuraciones
7. **Temas**: Modo oscuro para gráficos
8. **API propia**: Endpoint para obtener datos de gráficos

## Notas Técnicas

- Los gráficos usan ResponsiveContainer para adaptarse al contenedor
- Los colores se definen en array COLORS y se ciclan según cantidad de datos
- El estado se guarda en localStorage con clave única por usuario
- La configuración se mergea con defaults para evitar valores undefined
- El servicio prepareChartData es puro (sin side effects)

## Testing

Para probar la implementación:

1. Ejecutar `npm run dev`
2. Abrir http://127.0.0.1:5174/
3. Hacer clic en "Configurar gráfico"
4. Probar diferentes combinaciones de:
   - Tipos de gráfico
   - Fuentes de datos
   - Opciones de visualización
5. Verificar que la configuración se persiste al recargar la página
6. Verificar responsive en diferentes tamaños de pantalla

## Conclusión

Se implementó un sistema completo de gráficos dinámicos y configurables que:
- ✅ Es totalmente configurable por el usuario
- ✅ Es dinámico (cambia según datos y configuración)
- ✅ Se integra perfectamente con el dashboard existente
- ✅ Persiste la configuración entre sesiones
- ✅ Es responsive y accesible
- ✅ Es extensible para futuras mejoras