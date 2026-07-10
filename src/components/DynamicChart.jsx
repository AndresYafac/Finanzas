import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = ['#1d9e75', '#378add', '#ef9f27', '#e24b4a', '#9b59b6', '#3498db', '#e74c3c', '#2ecc71'];

function getThemeColors() {
  if (typeof window === 'undefined') {
    return { primary: COLORS[0], border: '#e8ebf0', text: '#142033', surface: '#ffffff' };
  }
  const styles = window.getComputedStyle(document.documentElement);
  return {
    primary: styles.getPropertyValue('--primary').trim() || COLORS[0],
    accent: styles.getPropertyValue('--accent').trim() || COLORS[1],
    border: styles.getPropertyValue('--border').trim() || '#e8ebf0',
    text: styles.getPropertyValue('--text').trim() || '#142033',
    surface: styles.getPropertyValue('--surface').trim() || '#ffffff',
  };
}

export function DynamicChart({ type = 'bar', data = [], config = {}, height = 300 }) {
  const theme = getThemeColors();
  const chartId = React.useId().replace(/:/g, '');

  if (!data || data.length === 0) {
    return (
      <div className="chart-empty">
        <p>Sin datos disponibles para mostrar</p>
      </div>
    );
  }

  const {
    xKey = 'label',
    yKey = 'value',
    xLabel = 'Categoria',
    yLabel = 'Valor',
    colors = [theme.primary, theme.accent, ...COLORS],
    showGrid = true,
    showLegend = true,
    showTooltip = true,
    curved = false,
  } = config;
  const itemColor = (entry, index) => entry?.color || colors[index % colors.length];

  const commonProps = {
    data,
    margin: { top: 10, right: 22, left: 0, bottom: 8 },
  };

  const axisProps = {
    xAxis: {
      dataKey: xKey,
      label: { value: xLabel, position: 'insideBottom', offset: -5, fill: theme.text },
      tick: { fill: theme.text, fontSize: 12 },
      axisLine: { stroke: theme.border },
      tickLine: { stroke: theme.border },
    },
    yAxis: {
      label: { value: yLabel, angle: -90, position: 'insideLeft', fill: theme.text },
      tick: { fill: theme.text, fontSize: 12 },
      axisLine: { stroke: theme.border },
      tickLine: { stroke: theme.border },
    },
  };

  const gridProps = showGrid ? <CartesianGrid strokeDasharray="3 3" stroke={theme.border} /> : null;
  const tooltipProps = showTooltip ? <Tooltip contentStyle={{ borderRadius: '12px', border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text }} /> : null;
  const legendProps = showLegend ? <Legend /> : null;
  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <defs>
              <linearGradient id={`${chartId}-lineStrokeGradient`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={colors[0]} />
                <stop offset="50%" stopColor={colors[1] || colors[0]} />
                <stop offset="100%" stopColor={colors[2] || colors[0]} />
              </linearGradient>
            </defs>
            {gridProps}
            {tooltipProps}
            {legendProps}
            <XAxis {...axisProps.xAxis} />
            <YAxis {...axisProps.yAxis} />
            <Line
              type={curved ? 'monotone' : 'linear'}
              dataKey={yKey}
              stroke={`url(#${chartId}-lineStrokeGradient)`}
              strokeWidth={3}
              dot={({ cx, cy, payload, index }) => <circle cx={cx} cy={cy} r={4} fill={itemColor(payload, index)} stroke={theme.surface} strokeWidth={2} />}
              activeDot={{ r: 6 }}
              isAnimationActive
            />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id={`${chartId}-areaFillGradient`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors[0]} stopOpacity={0.45} />
                <stop offset="55%" stopColor={colors[1] || colors[0]} stopOpacity={0.22} />
                <stop offset="100%" stopColor={colors[2] || colors[0]} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id={`${chartId}-areaStrokeGradient`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={colors[0]} />
                <stop offset="50%" stopColor={colors[1] || colors[0]} />
                <stop offset="100%" stopColor={colors[2] || colors[0]} />
              </linearGradient>
            </defs>
            {gridProps}
            {tooltipProps}
            {legendProps}
            <XAxis {...axisProps.xAxis} />
            <YAxis {...axisProps.yAxis} />
            <Area
              type={curved ? 'monotone' : 'linear'}
              dataKey={yKey}
              stroke={`url(#${chartId}-areaStrokeGradient)`}
              fill={`url(#${chartId}-areaFillGradient)`}
              fillOpacity={1}
              isAnimationActive
            />
          </AreaChart>
        );

      case 'pie':
        return (
          <PieChart>
            {tooltipProps}
            {legendProps}
            <Pie
              data={data}
              dataKey={yKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius="78%"
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              labelLine
              isAnimationActive
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${entry[xKey] || index}`} fill={itemColor(entry, index)} />
              ))}
            </Pie>
          </PieChart>
        );

      case 'bar':
      default:
        return (
          <BarChart {...commonProps}>
            {gridProps}
            {tooltipProps}
            {legendProps}
            <XAxis {...axisProps.xAxis} />
            <YAxis {...axisProps.yAxis} />
            <Bar dataKey={yKey} radius={[8, 8, 0, 0]} isAnimationActive>
              {data.map((entry, index) => (
                <Cell key={`cell-${entry[xKey] || index}`} fill={itemColor(entry, index)} />
              ))}
            </Bar>
          </BarChart>
        );
    }
  };

  return (
    <div className="dynamic-chart" style={{ width: '100%', height: `${height}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}
