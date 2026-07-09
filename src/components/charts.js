/** Gráficos CSS/SVG leves para o dashboard admin */

export function renderDonutChart(data, size = 140) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let cumulative = 0;
  const segments = data.map((d) => {
    const pct = (d.value / total) * 100;
    const start = cumulative;
    cumulative += pct;
    return { ...d, start, end: cumulative };
  });

  const gradient = segments
    .map((s) => `${s.color} ${s.start}% ${s.end}%`)
    .join(', ');

  const legend = segments
    .map(
      (s) => `
      <div class="chart-legend-item">
        <span class="chart-legend-dot" style="background:${s.color}"></span>
        <span>${s.label}</span>
        <strong>${s.value}</strong>
      </div>`
    )
    .join('');

  return `
    <div class="donut-chart-wrap">
      <div class="donut-chart" style="width:${size}px;height:${size}px;background:conic-gradient(${gradient})">
        <div class="donut-hole"><span>${total}</span><small>total</small></div>
      </div>
      <div class="chart-legend">${legend}</div>
    </div>
  `;
}

export function renderHorizontalBarChart(data, maxValue) {
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);
  return `
    <div class="hbar-chart">
      ${data.map((d) => `
        <div class="hbar-item">
          <span class="hbar-label">${d.label}</span>
          <div class="hbar-track">
            <div class="hbar-fill" style="width:${(d.value / max) * 100}%;background:${d.color || '#1351B4'}"></div>
          </div>
          <span class="hbar-value">${d.value}</span>
        </div>`).join('')}
    </div>`;
}

export function renderBarChart(data, maxValue) {
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);
  return `
    <div class="bar-chart">
      ${data
        .map(
          (d) => `
        <div class="bar-chart-item">
          <div class="bar-chart-bar-wrap">
            <div class="bar-chart-bar" style="height:${(d.value / max) * 100}%"></div>
          </div>
          <span class="bar-chart-label">${d.label}</span>
          <span class="bar-chart-value">${d.value}</span>
        </div>`
        )
        .join('')}
    </div>
  `;
}

export function renderMapPlaceholder(municipios) {
  const pins = municipios.slice(0, 8).map((m, i) => {
    const top = 15 + (i % 4) * 18 + Math.random() * 5;
    const left = 20 + Math.floor(i / 4) * 35 + (i % 3) * 12;
    const colors = ['#1351B4', '#168821', '#FF9900', '#E52207', '#6f42c1'];
    return `<span class="map-pin" style="top:${top}%;left:${left}%;background:${colors[i % colors.length]}" title="${m.nome}"></span>`;
  }).join('');

  return `
    <div class="map-widget">
      <div class="map-shape">${pins}</div>
      <p class="map-caption">${municipios.length} municípios com programações</p>
    </div>
  `;
}
