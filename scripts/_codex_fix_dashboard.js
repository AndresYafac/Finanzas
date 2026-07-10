import fs from 'fs';

const path = 'src/pages/Dashboard.jsx';
let source = fs.readFileSync(path, 'utf8');

source = source.replace('GripVertical, ', '');

const metric = [
  'function MetricCard({ icon, label, value, helper, danger = false, trend = "up", chart }) {',
  '  const isDown = danger || trend === "down";',
  '  const isNeutral = trend === "neutral";',
  '  const trendLabel = isDown ? "Tendencia negativa" : isNeutral ? "Tendencia estable" : "Tendencia positiva";',
  '  const trendClass = "metric-trend " + (isDown ? "down" : isNeutral ? "neutral" : "up");',
  '  const valueClass = "metric-value " + (danger ? "danger-text" : "");',
  '  return (',
  '    <div className="metric-card" title={String(label) + ": " + String(value) + ". " + String(helper || "")}>',
  '      <span className={trendClass} aria-label={trendLabel}>',
  '        {isDown ? "v" : isNeutral ? "-" : "^"}',
  '      </span>',
  '      <div className="metric-label">{icon}{label}</div>',
  '      <div className={valueClass}>{value}</div>',
  '      {chart}',
  '      <div className="metric-change neutral">{helper}</div>',
  '    </div>',
  '  );',
  '}',
  '',
].join('\n');

source = source.replace(/function MetricCard[\s\S]*?\r?\n}\r?\n\r?\nfunction MiniBarChart/, `${metric}function MiniBarChart`);
source = source.replace(/\r?\n  const \[draggingCard, setDraggingCard\] = React\.useState\(null\);/, '');
source = source.replace(/\r?\n  function moveDraftCard[\s\S]*?\r?\n  const openChartConfig/, '\n  const openChartConfig');
source = source.replace(/Â·/g, '-').replace(/Ã‚Â·/g, '-');

fs.writeFileSync(path, source, 'utf8');
