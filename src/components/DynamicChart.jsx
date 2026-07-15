import React from 'react';
import ReactApexChart from 'react-apexcharts';

const COLORS = ['#1d9e75', '#378add', '#ef9f27', '#e24b4a', '#9b59b6', '#06b6d4', '#22c55e', '#ec4899'];

function getThemeColors() {
  if (typeof window === 'undefined') {
    return { primary: COLORS[0], accent: COLORS[1], border: '#d9e4ef', text: '#142033', surface: '#ffffff' };
  }

  const styles = window.getComputedStyle(document.documentElement);
  return {
    primary: styles.getPropertyValue('--primary').trim() || COLORS[0],
    accent: styles.getPropertyValue('--accent').trim() || COLORS[1],
    border: styles.getPropertyValue('--border').trim() || '#d9e4ef',
    text: styles.getPropertyValue('--text').trim() || '#142033',
    surface: styles.getPropertyValue('--surface').trim() || '#ffffff',
  };
}

function formatValue(value) {
  return `S/ ${Number(value || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function buildOptions({ type, data, config, theme }) {
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

  const labels = data.map((item) => item[xKey] || 'Sin nombre');
  const values = data.map((item) => Number(item[yKey] || 0));
  const axisData = labels.map((label, index) => ({ x: label, y: values[index] }));
  const chartColors = data.map((item, index) => item.color || colors[index % colors.length]);
  const isPie = type === 'pie' || type === 'donut';

  const options = {
    chart: {
      type,
      toolbar: { show: true, tools: { download: true, selection: false, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true } },
      animations: { enabled: true, easing: 'easeinout', speed: 650 },
      foreColor: theme.text,
      background: 'transparent',
    },
    colors: chartColors,
    grid: {
      show: showGrid,
      borderColor: theme.border,
      strokeDashArray: 4,
    },
    legend: {
      show: showLegend,
      position: 'bottom',
      fontWeight: 700,
      labels: { colors: theme.text },
    },
    tooltip: {
      enabled: showTooltip,
      theme: 'light',
      y: { formatter: formatValue },
    },
    stroke: {
      curve: curved ? 'smooth' : 'straight',
      width: type === 'bar' ? 0 : 3,
    },
    fill: {
      type: type === 'area' ? 'gradient' : 'solid',
      gradient: {
        shadeIntensity: 0.35,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [0, 90, 100],
      },
    },
    dataLabels: {
      enabled: isPie,
      style: { fontWeight: 800 },
      formatter: isPie ? (value) => `${Number(value || 0).toFixed(0)}%` : undefined,
    },
    responsive: [
      {
        breakpoint: 640,
        options: {
          chart: { toolbar: { show: false } },
          legend: { position: 'bottom' },
          plotOptions: { bar: { columnWidth: '68%' } },
        },
      },
    ],
  };

  if (isPie) {
    options.labels = labels;
    options.plotOptions = {
      pie: {
        donut: { size: '58%' },
      },
    };
  } else {
    options.xaxis = {
        title: { text: xLabel, style: { color: theme.text, fontWeight: 700 } },
        labels: { style: { colors: theme.text, fontSize: '12px', fontWeight: 600 } },
        axisBorder: { color: theme.border },
        axisTicks: { color: theme.border },
    };
    options.yaxis = {
      title: { text: yLabel, style: { color: theme.text, fontWeight: 700 } },
      labels: { style: { colors: theme.text, fontSize: '12px', fontWeight: 600 }, formatter: (value) => Number(value || 0).toLocaleString('es-PE') },
    };
    options.plotOptions = {
      bar: {
        borderRadius: 9,
        columnWidth: '55%',
        distributed: true,
      },
    };
  }

  return {
    series: isPie ? values : [{ name: yLabel, data: axisData }],
    options,
  };
}

export function DynamicChart({ type = 'bar', data = [], config = {}, height = 300 }) {
  const theme = getThemeColors();

  if (!data || data.length === 0) {
    return (
      <div className="tailwind-page flex min-h-[220px] w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm font-bold text-slate-500">
        Sin datos disponibles para mostrar
      </div>
    );
  }

  const apexType = type === 'pie' ? 'donut' : type;
  const { series, options } = buildOptions({ type: apexType, data, config, theme });

  return (
    <div className="tailwind-page w-full overflow-hidden rounded-2xl bg-white" style={{ minHeight: `${height}px` }}>
      <ReactApexChart options={options} series={series} type={apexType} height={height} width="100%" />
    </div>
  );
}
