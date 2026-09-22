// ===== Graphiques SVG (sans dépendance externe) =====
const Charts = (() => {
 const GOLD = ['#c49b2e', '#d4873a', '#1a1a1a', '#888888', '#b8b0a0', '#8a6e18', '#555555', '#a8841f'];

 // Donut chart -> renvoie HTML (svg + légende)
 function donut(data, { size = 170 } = {}) {
 const total = data.reduce((s, d) => s + d.value, 0) || 1;
 const r = size / 2 - 14;
 const cx = size / 2, cy = size / 2;
 const circ = 2 * Math.PI * r;
 let offset = 0;
 const stroke = 22;
 let segs = '';
 data.forEach((d, i) => {
 const frac = d.value / total;
 const len = frac * circ;
 const color = d.color || GOLD[i % GOLD.length];
 segs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-dasharray="${len} ${circ - len}" stroke-dashoffset="${-offset}" stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>`;
 offset += len;
 });
 const legend = data.map((d, i) => {
 const color = d.color || GOLD[i % GOLD.length];
 const pct = Math.round((d.value / total) * 100);
 return `
<div class="legend-row">
<div class="legend-dot" style="background:${color}"></div>
<span>${UI.esc(d.label)}</span>
<span class="legend-val">${d.value} (${pct}%)</span>
</div>`;
 }).join('');
 return `
<div class="donut-wrap">
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
${segs}
<text x="${cx}" y="${cy - 8}" text-anchor="middle" fill="var(--text)" font-size="28" font-weight="700">${total}</text>
<text x="${cx}" y="${cy + 14}" text-anchor="middle" fill="var(--text-mute)" font-size="11">Total</text>
</svg>
<div class="donut-legend">${legend}</div>
</div>`;
 }

function bars(data) {
const max = Math.max(...data.map((d) => d.value), 1);
return data.map((d) => {
const w = Math.round((d.value / max) * 100);
const color = d.color || '#c49b2e';
return `<div class="bar-row">
<span class="bar-lbl">${UI.esc(d.label)}</span>
<div class="bar-track"><div class="bar-fill" style="width:${w}%;background:linear-gradient(135deg,${color}cc,${color})">${d.value > 0 && w > 14 ? d.value : ''}</div></div>
<span class="bar-val" style="color:${color}">${w <= 14 ? d.value : ''}</span>
</div>`;
}).join('');
}

 // Courbe d'évolution (line chart)
 function line(data, { width = 520, height = 200 } = {}) {
 if (!data.length) return UI.emptyState('📈', 'Aucune donnée');
 const pad = { l: 36, r: 16, t: 18, b: 30 };
 const w = width - pad.l - pad.r;
 const h = height - pad.t - pad.b;
 const max = Math.max(...data.map((d) => d.value), 1);
 const stepX = data.length > 1 ? w / (data.length - 1) : 0;
 const pts = data.map((d, i) => {
 const x = pad.l + i * stepX;
 const y = pad.t + h - (d.value / max) * h;
 return { x, y, d };
 });
 const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
 const area = path + ` L${pts[pts.length - 1].x.toFixed(1)} ${(pad.t + h).toFixed(1)} L${pts[0].x.toFixed(1)} ${(pad.t + h).toFixed(1)} Z`;
 const grid = [0, 0.5, 1].map((f) => {
 const y = pad.t + h - f * h;
 return `<line x1="${pad.l}" y1="${y}" x2="${width - pad.r}" y2="${y}" stroke="var(--border)" stroke-dasharray="4 3"/><text x="${pad.l - 6}" y="${y + 4}" text-anchor="end" fill="var(--text-mute)" font-size="10">${Math.round(max * f)}</text>`;
 }).join('');
 const labels = pts.map((p) => `<text x="${p.x}" y="${height - 6}" text-anchor="middle" fill="var(--text-mute)" font-size="10">${UI.esc(p.d.label)}</text>`).join('');
 const dots = pts.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#c49b2e" stroke="#fff" stroke-width="2"/><title>${p.d.value}</title>`).join('');
 return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="width:100%;max-width:${width}px">
 ${grid}
<path d="${area}" fill="rgba(196,155,46,0.08)"/>
<path d="${path}" fill="none" stroke="#c49b2e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
 ${dots}${labels}
 </svg>`;
 }

 return { donut, bars, line, GOLD };
})();