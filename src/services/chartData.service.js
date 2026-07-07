export function prepareChartData(dataSources, dashboardData) {
  const { deudas = [], pagos = [], cuentas = [], movimientos = [], presupuestos = [], metas = [] } = dashboardData;

  const sources = Array.isArray(dataSources) ? dataSources : [dataSources];

  const dataMap = {};

  sources.forEach((source) => {
    switch (source) {
      case 'accounts':
        dataMap.accounts = {
          data: cuentas.map((cuenta, index) => ({
            label: cuenta.banco || 'Sin nombre',
            value: Number(cuenta.saldo || 0),
            color: CHART_COLORS[index % CHART_COLORS.length],
          })),
          config: {
            xKey: 'label',
            yKey: 'value',
            xLabel: 'Banco',
            yLabel: 'Saldo',
          },
        };
        break;

      case 'debts': {
        const cobrado = deudas.reduce((sum, d) => sum + Number(d.monto_pagado || 0), 0);
        const pendiente = deudas.reduce((sum, d) => sum + Math.max(0, Number(d.monto_total || 0) - Number(d.monto_pagado || 0)), 0);
        dataMap.debts = {
          data: [
            { label: 'Cobrado', value: cobrado, color: '#1d9e75' },
            { label: 'Pendiente', value: pendiente, color: '#ef4444' },
          ],
          config: {
            xKey: 'label',
            yKey: 'value',
            xLabel: 'Estado',
            yLabel: 'Monto',
          },
        };
        break;
      }

      case 'payments': {
        const pagosPorDia = pagos
          .filter((pago) => pago.fecha?.startsWith(getCurrentMonth()))
          .reduce((map, pago) => {
            const day = pago.fecha.slice(-2);
            map[day] = (map[day] || 0) + Number(pago.monto || 0);
            return map;
          }, {});
        const data = Object.entries(pagosPorDia)
          .slice(-10)
          .map(([label, value], index) => ({ label: `Dia ${label}`, value, color: CHART_COLORS[index % CHART_COLORS.length] }));
        dataMap.payments = {
          data,
          config: {
            xKey: 'label',
            yKey: 'value',
            xLabel: 'Dia del mes',
            yLabel: 'Monto cobrado',
          },
        };
        break;
      }

      case 'movements': {
        const ingresos = movimientos
          .filter((m) => m.tipo === 'ingreso')
          .reduce((sum, m) => sum + Number(m.monto || 0), 0);
        const egresos = movimientos
          .filter((m) => m.tipo === 'egreso')
          .reduce((sum, m) => sum + Number(m.monto || 0), 0);
        dataMap.movements = {
          data: [
            { label: 'Ingresos', value: ingresos, color: '#1d9e75' },
            { label: 'Egresos', value: egresos, color: '#ef4444' },
          ],
          config: {
            xKey: 'label',
            yKey: 'value',
            xLabel: 'Tipo',
            yLabel: 'Monto',
          },
        };
        break;
      }

      case 'budgets': {
        const currentMonthMovements = movimientos.filter((m) => m.fecha?.startsWith(getCurrentMonth()));
        const data = presupuestos
          .map((presupuesto, index) => {
            const usado = currentMonthMovements
              .filter((movimiento) => {
                if (presupuesto.tipo_movimiento_id) {
                  return movimiento.tipo_movimiento_id === presupuesto.tipo_movimiento_id;
                }
                return (movimiento.categoria || '') === (presupuesto.categoria || '');
              })
              .reduce((sum, movimiento) => sum + Number(movimiento.monto || 0), 0);
            const limite = Number(presupuesto.monto_limite || 0);
            return {
              label: presupuesto.tipos_movimiento?.nombre || presupuesto.categoria || presupuesto.tipo,
              value: usado,
              limite,
              color: CHART_COLORS[index % CHART_COLORS.length],
            };
          })
          .filter((item) => item.limite > 0);
        dataMap.budgets = {
          data,
          config: {
            xKey: 'label',
            yKey: 'value',
            xLabel: 'Presupuesto',
            yLabel: 'Usado',
          },
        };
        break;
      }

      case 'goals': {
        const data = metas
          .filter((meta) => meta.estado === 'activa')
          .filter((meta) => Number(meta.monto_objetivo || 0) > 0)
          .map((meta, index) => ({
            label: meta.nombre,
            value: Number(meta.monto_actual || 0),
            objetivo: Number(meta.monto_objetivo || 0),
            color: CHART_COLORS[index % CHART_COLORS.length],
          }));
        dataMap.goals = {
          data,
          config: {
            xKey: 'label',
            yKey: 'value',
            xLabel: 'Meta',
            yLabel: 'Progreso',
          },
        };
        break;
      }
    }
  });

  return {
    dataMap,
    sources,
  };
}

const CHART_COLORS = ['#1d9e75', '#378add', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444', '#22c55e', '#ec4899'];

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
