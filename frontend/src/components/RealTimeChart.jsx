import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useEnergy } from '../context/EnergyContext';

const maxDataPoints = 50;
const SAMPLE_MS = 1200;

/** Live fleet mean of per-sensor interval kWh — changes every Redis/processor update. */
function computeLiveEnergyPoint(sensors, stats) {
  const list = Array.isArray(sensors) ? sensors : [];
  const nums = list
    .map((s) => Number(s?.energy_consumption))
    .filter((v) => Number.isFinite(v) && v >= 0);
  if (nums.length > 0) {
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }
  const avg = Number(stats?.average_consumption);
  if (Number.isFinite(avg) && avg > 0) return avg;
  return null;
}

function formatAxisValue(n) {
  if (!Number.isFinite(n)) return '0';
  const a = Math.abs(n);
  if (a >= 1000) return `${(n / 1000).toFixed(2)}k`;
  if (a >= 100) return n.toFixed(1);
  if (a >= 10) return n.toFixed(2);
  return n.toFixed(2);
}

function formatTotal(n) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e4) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

const RealTimeChart = () => {
  const { realTimeData } = useEnergy();
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const dataHistory = useRef([]);
  const liveRef = useRef(realTimeData);
  const [resizeTick, setResizeTick] = useState(0);

  liveRef.current = realTimeData;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.max(wrap.clientWidth || 600, 280);
    const cssH = Math.max(wrap.clientHeight || 260, 220);
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const padding = { top: 18, right: 20, bottom: 40, left: 56 };
    const chartW = cssW - padding.left - padding.right;
    const chartH = cssH - padding.top - padding.bottom;

    const bgGrad = ctx.createLinearGradient(0, 0, 0, cssH);
    bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.92)');
    bgGrad.addColorStop(1, 'rgba(15, 23, 42, 0.98)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cssW, cssH);

    if (dataHistory.current.length < 2) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Collecting live fleet samples…', cssW / 2, cssH / 2);
      return;
    }

    const series = dataHistory.current.map((d) => d.value);
    let minY = Math.min(...series);
    let maxY = Math.max(...series);
    let span = maxY - minY;
    const padY = Math.max(span * 0.15, Math.max(Math.abs(maxY), 1) * 0.06, 0.25);
    minY -= padY;
    maxY += padY;
    span = Math.max(maxY - minY, 1e-6);

    const n = dataHistory.current.length;
    const xAt = (i) => padding.left + (chartW / (n - 1)) * i;
    const yAt = (v) => padding.top + chartH - ((v - minY) / span) * chartH;

    const pts = dataHistory.current.map((d, i) => ({
      x: xAt(i),
      y: yAt(d.value)
    }));

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(cssW - padding.right, y);
      ctx.stroke();
      const val = maxY - (span / 5) * i;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatAxisValue(val), padding.left - 8, y);
    }

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    for (let g = 1; g <= 3; g++) {
      const gx = padding.left + (chartW / 4) * g;
      ctx.beginPath();
      ctx.moveTo(gx, padding.top);
      ctx.lineTo(gx, padding.top + chartH);
      ctx.stroke();
    }

    const areaGrad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    areaGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    areaGrad.addColorStop(0.45, 'rgba(59, 130, 246, 0.15)');
    areaGrad.addColorStop(1, 'rgba(59, 130, 246, 0.02)');
    ctx.fillStyle = areaGrad;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, padding.top + chartH);
    pts.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, padding.top + chartH);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i];
      const q = pts[i + 1];
      const mx = (p.x + q.x) / 2;
      const my = (p.y + q.y) / 2;
      ctx.quadraticCurveTo(p.x, p.y, mx, my);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(56, 189, 248, 0.45)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const lx = last.x;
    const ly = last.y;
    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath();
    ctx.arc(lx, ly, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.stroke();

    const lastVal = series[series.length - 1];
    const lastTotal = dataHistory.current[dataHistory.current.length - 1].totalEnergy;
    const labelW = 210;
    let tx = lx - 10;
    if (tx < padding.left + labelW) tx = padding.left + labelW;
    const boxTop = Math.max(padding.top + 4, Math.min(ly - 40, cssH - 44));
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    roundRect(ctx, tx - labelW, boxTop, labelW, 34, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`${formatAxisValue(lastVal)} kWh avg (fleet)`, tx - 10, boxTop + 14);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 10px system-ui, sans-serif';
    ctx.fillText(`Cumulative total ${formatTotal(lastTotal)} kWh`, tx - 10, boxTop + 28);

    ctx.fillStyle = '#64748b';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const t0 = dataHistory.current[0].timestamp;
    const t1 = dataHistory.current[Math.floor((n - 1) / 2)].timestamp;
    const t2 = dataHistory.current[n - 1].timestamp;
    ctx.fillText(formatTime(t0), padding.left, padding.top + chartH + 8);
    ctx.fillText(formatTime(t1), padding.left + chartW / 2, padding.top + chartH + 8);
    ctx.fillText(formatTime(t2), padding.left + chartW, padding.top + chartH + 8);

    ctx.fillStyle = '#475569';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('Live mean kWh per sensor · ~1.2s samples', cssW / 2, cssH - 8);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => setResizeTick((t) => t + 1));
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const sample = () => {
      const { sensors, stats } = liveRef.current;
      const v = computeLiveEnergyPoint(sensors, stats);
      if (v == null) return;
      const te = Number(stats?.total_energy ?? stats?.total_energy_consumption);
      const totalEnergy = Number.isFinite(te) ? te : 0;
      dataHistory.current.push({
        value: v,
        totalEnergy,
        timestamp: Date.now()
      });
      if (dataHistory.current.length > maxDataPoints) {
        dataHistory.current = dataHistory.current.slice(-maxDataPoints);
      }
      draw();
    };

    sample();
    const id = setInterval(sample, SAMPLE_MS);
    return () => clearInterval(id);
  }, [draw]);

  useEffect(() => {
    draw();
  }, [draw, resizeTick]);

  return (
    <div className="realtime-chart" ref={wrapRef}>
      <canvas ref={canvasRef} className="realtime-chart-canvas" />
    </div>
  );
};

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export default RealTimeChart;
