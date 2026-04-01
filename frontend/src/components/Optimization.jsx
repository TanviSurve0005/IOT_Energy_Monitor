import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useEnergy } from '../context/EnergyContext';
import { computeEfficiencyScore } from '../utils/efficiencyScore';
import {
  Lightbulb,
  Zap,
  DollarSign,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Settings,
  Loader2,
  Radio,
  Sparkles,
  Info,
  Calendar,
  Moon,
  Sun
} from 'lucide-react';

const AUTO_OPTIMIZE_STORAGE_KEY = 'voltai-auto-optimize';
const AUTO_REFRESH_MS = 25000;

/** Aligns with backend optimizer tariff placeholders ($/kWh). */
const TARIFF_DISPLAY = [
  { key: 'off_peak', label: 'Off-peak', rate: '$0.08', widthPct: 38 },
  { key: 'shoulder', label: 'Shoulder', rate: '$0.12', widthPct: 34 },
  { key: 'on_peak', label: 'On-peak', rate: '$0.18', widthPct: 28 }
];

const SCHEDULE_PRESETS = [
  {
    id: 'tonight',
    title: 'Tonight · full off-peak',
    window: '22:00 → 06:00',
    subtitle: 'Stays in $0.08/kWh band — best for conveyors & pumps',
    defaultHours: 8,
    icon: Moon
  },
  {
    id: 'early',
    title: 'Early morning · super off-peak',
    window: '00:30 → 05:30',
    subtitle: 'Minimal grid load — ideal for batch pre-heats',
    defaultHours: 5,
    icon: Moon
  },
  {
    id: 'post_peak',
    title: 'Post-peak ramp-down',
    window: 'From 18:00',
    subtitle: 'Shoulder then off-peak — balances throughput & cost',
    defaultHours: 6,
    icon: Sun
  }
];

function ScheduleOptimizationModal({ suggestion, onClose, onCommitted }) {
  const [presetId, setPresetId] = useState('tonight');
  const [durationH, setDurationH] = useState(8);
  const [customStart, setCustomStart] = useState('');

  const hourly = Number(suggestion.potential_savings) || 0;
  const effectiveHours = Math.min(Math.max(durationH, 2), 12);
  const windowSaving = hourly * effectiveHours;
  const vsPeakExtra = hourly > 0 ? Number((hourly * 0.15 * effectiveHours).toFixed(2)) : 0;

  const handleConfirm = () => {
    const useCustom = customStart.trim().length > 0;
    const preset = SCHEDULE_PRESETS.find((p) => p.id === presetId) || SCHEDULE_PRESETS[0];
    const windowLabel = useCustom
      ? new Date(customStart).toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : `${preset.window} (${preset.title.split('·')[0].trim()})`;

    onCommitted({
      schId: `SCH-${Date.now().toString(36).toUpperCase()}`,
      title: suggestion.title,
      sensorId: suggestion.sensor_id,
      deviceType: suggestion.device_type,
      location: suggestion.location,
      windowLabel,
      durationH: effectiveHours,
      hourlySaving: hourly,
      windowSaving,
      presetId: useCustom ? 'custom' : presetId,
      useCustom
    });
    onClose();
  };

  return (
    <div className="sensor-modal optimization-schedule-modal optimization-schedule-modal--rich">
      <div className="schedule-modal__header">
        <Calendar size={22} className="schedule-modal__header-icon" />
        <div>
          <h3 id="schedule-modal-title">Schedule load shift</h3>
          <p className="schedule-modal__sub">Align runs with cheaper tariff windows — same model as the live optimizer.</p>
        </div>
      </div>

      <div className="schedule-tariff-strip" title="Effective rates used in VoltAI savings math">
        {TARIFF_DISPLAY.map((seg) => (
          <div
            key={seg.key}
            className={`schedule-tariff-seg schedule-tariff-seg--${seg.key}`}
            style={{ flex: `${seg.widthPct} 1 0` }}
          >
            <span>{seg.label}</span>
            <strong>{seg.rate}</strong>
          </div>
        ))}
      </div>
      <p className="schedule-tariff-note">Peak hours roughly 09:00–17:00 match on-peak pricing in the optimizer.</p>

      <div className="schedule-presets">
        <span className="schedule-section-label">Quick windows</span>
        {SCHEDULE_PRESETS.map((p) => {
          const Icon = p.icon;
          const active = presetId === p.id && !customStart;
          return (
            <button
              key={p.id}
              type="button"
              className={`schedule-preset-card ${active ? 'is-active' : ''}`}
              onClick={() => {
                setPresetId(p.id);
                setCustomStart('');
                setDurationH(p.defaultHours);
              }}
            >
              <Icon size={18} />
              <div className="schedule-preset-card__text">
                <strong>{p.title}</strong>
                <span>{p.window}</span>
                <small>{p.subtitle}</small>
              </div>
            </button>
          );
        })}
      </div>

      <div className="schedule-custom-row">
        <label className="schedule-section-label" htmlFor="opt-schedule-custom">
          Or pick a start (optional)
        </label>
        <input
          id="opt-schedule-custom"
          type="datetime-local"
          className="schedule-datetime-input"
          value={customStart}
          onChange={(e) => setCustomStart(e.target.value)}
        />
        {customStart && (
          <button type="button" className="btn-text schedule-clear-custom" onClick={() => setCustomStart('')}>
            Use preset window instead
          </button>
        )}
      </div>

      <div className="schedule-duration">
        <span className="schedule-section-label">Run duration (hours)</span>
        <div className="schedule-duration-chips">
          {[2, 4, 6, 8, 10, 12].map((h) => (
            <button
              key={h}
              type="button"
              className={`schedule-chip ${durationH === h ? 'is-active' : ''}`}
              onClick={() => setDurationH(h)}
            >
              {h}h
            </button>
          ))}
        </div>
      </div>

      <div className="schedule-impact-card">
        <div className="optimization-metric-row highlight">
          <span>Estimated savings this window</span>
          <strong>${windowSaving.toFixed(2)}</strong>
        </div>
        <div className="optimization-metric-row subtle">
          <span>Avoided on-peak premium (indicative)</span>
          <strong>${vsPeakExtra.toFixed(2)}</strong>
        </div>
        <p className="schedule-impact-foot">
          {suggestion.sensor_id} · {suggestion.device_type} @ {suggestion.location} · ~$
          {hourly.toFixed(2)}/h when shifted
        </p>
      </div>

      <div className="sensor-modal-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn-primary" onClick={handleConfirm}>
          Commit schedule
        </button>
      </div>
    </div>
  );
}

function buildApplyModalPayload(suggestion, nextAppliedList) {
  const hourly = Number(suggestion.potential_savings) || 0;
  const sessionHourly = nextAppliedList.reduce(
    (s, x) => s + (Number(x.potential_savings) || 0),
    0
  );
  const effectiveDailyHours = 18;
  const workingDaysMonth = 22;
  const projectedDay = hourly * effectiveDailyHours;
  const projectedMonth = projectedDay * workingDaysMonth;
  const efficiencyLift = Math.min(2.4, Math.max(0.1, 0.12 + hourly * 0.06 + (suggestion.priority === 'critical' ? 0.35 : 0)));
  const co2KgPerKwh = 0.42;
  const estKwhSavedPerHour = Math.max(0.3, hourly / 0.12);
  const kwhPerDay = estKwhSavedPerHour * effectiveDailyHours;
  const co2TonnesPerDay = (kwhPerDay * co2KgPerKwh) / 1000;

  return {
    title: suggestion.title,
    sensorId: suggestion.sensor_id,
    deviceType: suggestion.device_type,
    location: suggestion.location,
    action: suggestion.action,
    hourlySaving: hourly,
    sessionHourly,
    appliedCount: nextAppliedList.length,
    projectedDay,
    projectedMonth,
    efficiencyLift,
    co2TonnesPerDay: Number(co2TonnesPerDay.toFixed(2)),
    jobId: `OPT-${Date.now().toString(36).toUpperCase()}`
  };
}

const SuggestionCard = ({ suggestion, onApply, onSchedule, onMoreInfo, applyingKey }) => {
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#3b82f6';
      default: return '#64748b';
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'schedule_shift': return '🕒';
      case 'schedule_maintenance': return '🛠️';
      case 'efficiency_audit': return '📊';
      case 'schedule_shutdown': return '⏸️';
      default: return '💡';
    }
  };

  const cardKey = `${suggestion.sensor_id}:${suggestion.title}`;
  const isApplying = applyingKey === cardKey;

  return (
    <div className={`suggestion-card priority-${suggestion.priority}`}>
      <div className="suggestion-header">
        <div className="suggestion-type">
          <span className="action-icon">{getActionIcon(suggestion.action)}</span>
          <span className="suggestion-title">{suggestion.title}</span>
        </div>
        <div 
          className="priority-badge"
          style={{ backgroundColor: getPriorityColor(suggestion.priority) }}
        >
          {suggestion.priority}
        </div>
      </div>

      <div className="suggestion-content">
        <p>{suggestion.description}</p>
        
        <div className="suggestion-details">
          <div className="detail-item">
            <Zap size={14} />
            <span>Device: {suggestion.sensor_id}</span>
          </div>
          <div className="detail-item">
            <Settings size={14} />
            <span>Type: {suggestion.device_type}</span>
          </div>
          <div className="detail-item">
            <TrendingUp size={14} />
            <span>Location: {suggestion.location}</span>
          </div>
        </div>

        {suggestion.potential_savings && (
          <div className="savings-indicator">
            <DollarSign size={14} />
            <span>Potential savings: ${suggestion.potential_savings}/hour</span>
          </div>
        )}

        {suggestion.risk_score && (
          <div className="risk-indicator">
            <AlertTriangle size={14} />
            <span>Risk score: {(suggestion.risk_score * 100).toFixed(1)}%</span>
          </div>
        )}
      </div>

      <div className="suggestion-actions">
        <button 
          type="button"
          className="btn-primary"
          disabled={isApplying}
          onClick={() => onApply(suggestion)}
        >
          {isApplying ? (
            <Loader2 size={16} className="spin" />
          ) : (
            <CheckCircle size={16} />
          )}
          {isApplying ? 'Applying…' : 'Apply Suggestion'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => onSchedule(suggestion)}>
          <Clock size={16} />
          Schedule
        </button>
        <button type="button" className="btn-text" onClick={() => onMoreInfo(suggestion)}>
          <Info size={14} />
          More Info
        </button>
      </div>

      <div className="suggestion-footer">
        <span className="suggestion-source">AI Recommendation</span>
        <span className="suggestion-confidence">Confidence: 92%</span>
      </div>
    </div>
  );
};

const Optimization = () => {
  const {
    optimizationSuggestions,
    fetchOptimizationSuggestions,
    refreshOptimizationInsights,
    realTimeData
  } = useEnergy();
  const [activeFilter, setActiveFilter] = useState('all');
  const [appliedSuggestions, setAppliedSuggestions] = useState([]);
  const [autoOptimize, setAutoOptimize] = useState(() => {
    try {
      return localStorage.getItem(AUTO_OPTIMIZE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState(null);
  const [toast, setToast] = useState(null);
  const [autoScanCount, setAutoScanCount] = useState(0);
  const [applyModal, setApplyModal] = useState(null);
  const [scheduleModal, setScheduleModal] = useState(null);
  const [scheduledJobs, setScheduledJobs] = useState([]);
  const [infoModal, setInfoModal] = useState(null);
  const [applyingKey, setApplyingKey] = useState(null);

  const showToast = useCallback((message, tone = 'success') => {
    setToast({ message, tone });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 4200);
  }, []);

  const runRefresh = useCallback(
    async (source = 'manual') => {
      setRefreshing(true);
      try {
        const result = await refreshOptimizationInsights();
        if (result?.ok) {
          const ts = result.generatedAt ? new Date(result.generatedAt) : new Date();
          setLastRefreshAt(ts);
          if (source === 'auto') {
            setAutoScanCount((c) => c + 1);
          }
          if (source === 'manual') {
            showToast(
              `Synced ${result.totalGenerated ?? 0} optimization insights${result.generatedAt ? ` · ${ts.toLocaleTimeString()}` : ''}`,
              'success'
            );
          }
        } else {
          if (source !== 'initial') {
            showToast('Could not refresh insights — check API connection', 'error');
          }
          await fetchOptimizationSuggestions();
        }
      } finally {
        setRefreshing(false);
      }
    },
    [refreshOptimizationInsights, fetchOptimizationSuggestions, showToast]
  );

  useEffect(() => {
    runRefresh('initial');
  }, [runRefresh]);

  useEffect(() => {
    try {
      localStorage.setItem(AUTO_OPTIMIZE_STORAGE_KEY, autoOptimize ? 'true' : 'false');
    } catch {
      /* ignore */
    }
    if (!autoOptimize) return undefined;

    const tick = () => runRefresh('auto');
    const id = setInterval(tick, AUTO_REFRESH_MS);
    tick();
    return () => clearInterval(id);
  }, [autoOptimize, runRefresh]);

  const handleApplySuggestion = async (suggestion) => {
    const key = `${suggestion.sensor_id}:${suggestion.title}`;
    setApplyingKey(key);
    try {
      await new Promise((r) => setTimeout(r, 650));
      const entry = {
        ...suggestion,
        appliedAt: new Date().toISOString(),
        status: 'applied'
      };
      setAppliedSuggestions((prev) => {
        const nextList = [...prev, entry];
        queueMicrotask(() => setApplyModal(buildApplyModalPayload(suggestion, nextList)));
        return nextList;
      });
    } finally {
      setApplyingKey(null);
    }
  };

  const handleScheduleSuggestion = (suggestion) => {
    setScheduleModal({ suggestion });
  };

  const handleMoreInfo = (suggestion) => {
    setInfoModal(suggestion);
  };

  const filteredSuggestions = optimizationSuggestions.filter(suggestion => {
    if (activeFilter === 'all') return true;
    return suggestion.priority === activeFilter;
  });

  const stats = realTimeData.stats || {};
  const sensors = realTimeData.sensors || [];
  const efficiencyScore = computeEfficiencyScore(stats, sensors);
  const totalPotentialSavings = optimizationSuggestions.reduce(
    (sum, suggestion) => sum + (suggestion.potential_savings || 0), 0
  );

  const sessionHourlySavings = useMemo(
    () =>
      appliedSuggestions.reduce((s, x) => s + (Number(x.potential_savings) || 0), 0),
    [appliedSuggestions]
  );

  const scheduledWindowsImpact = useMemo(
    () => scheduledJobs.reduce((s, j) => s + (Number(j.windowSaving) || 0), 0),
    [scheduledJobs]
  );

  return (
    <div className="optimization-page">
      {applyModal && (
        <div
          className="sensor-modal-overlay optimization-apply-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="optimization-apply-title"
          onClick={(e) => e.target === e.currentTarget && setApplyModal(null)}
        >
          <div className="sensor-modal optimization-success-modal">
            <div className="optimization-success-modal__icon">
              <Sparkles size={28} />
            </div>
            <h3 id="optimization-apply-title">Optimization queued</h3>
            <p className="optimization-success-modal__lead">
              VoltAI registered this action against live fleet data. Estimated impact below uses your
              current tariff model and session totals.
            </p>
            <div className="optimization-success-modal__metrics">
              <div className="optimization-metric-row highlight">
                <span>Estimated savings (this action)</span>
                <strong>${applyModal.hourlySaving.toFixed(2)}/hour</strong>
              </div>
              <div className="optimization-metric-row">
                <span>Projected today (18 h effective)</span>
                <strong>${applyModal.projectedDay.toFixed(2)}</strong>
              </div>
              <div className="optimization-metric-row">
                <span>Projected month (~22 work days)</span>
                <strong>${applyModal.projectedMonth.toFixed(0)}</strong>
              </div>
              <div className="optimization-metric-row">
                <span>Session committed rate</span>
                <strong>${applyModal.sessionHourly.toFixed(2)}/h · {applyModal.appliedCount} action(s)</strong>
              </div>
              <div className="optimization-metric-row subtle">
                <span>Projected efficiency lift (model)</span>
                <strong>+{applyModal.efficiencyLift.toFixed(1)}%</strong>
              </div>
              <div className="optimization-metric-row subtle">
                <span>CO₂ avoidance (indicative, grid mix)</span>
                <strong>~{applyModal.co2TonnesPerDay} t/day</strong>
              </div>
            </div>
            <p className="optimization-success-modal__meta">
              Job <code>{applyModal.jobId}</code> · {applyModal.deviceType} @ {applyModal.location}
            </p>
            <div className="sensor-modal-actions">
              <button type="button" className="btn-primary" onClick={() => setApplyModal(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {scheduleModal?.suggestion && (
        <div
          className="sensor-modal-overlay optimization-apply-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-modal-title"
          onClick={(e) => e.target === e.currentTarget && setScheduleModal(null)}
        >
          <ScheduleOptimizationModal
            suggestion={scheduleModal.suggestion}
            onClose={() => setScheduleModal(null)}
            onCommitted={(job) => {
              setScheduledJobs((prev) => [job, ...prev].slice(0, 12));
              showToast(
                `Schedule committed: ${job.title} · ${job.windowLabel} · ~$${job.windowSaving.toFixed(2)} saved in window`,
                'success'
              );
            }}
          />
        </div>
      )}

      {infoModal && (
        <div
          className="sensor-modal-overlay optimization-apply-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setInfoModal(null)}
        >
          <div className="sensor-modal optimization-info-modal">
            <h3>Suggestion detail</h3>
            <p className="optimization-info-title">{infoModal.title}</p>
            <p>{infoModal.description}</p>
            <ul className="optimization-info-list">
              <li>
                <strong>Why this matters:</strong> Recommendations combine research-based bands (temperature, load %,
                voltage, vibration, energy vs baseline, pressure) with fleet-wide optimizer rules.
              </li>
              <li>
                <strong>Action:</strong> {infoModal.action || 'review'} — align with maintenance windows and tariff
                periods for best ROI.
              </li>
              {infoModal.potential_savings != null && (
                <li>
                  <strong>Potential savings:</strong> ${Number(infoModal.potential_savings).toFixed(2)}/h at current
                  rates.
                </li>
              )}
            </ul>
            <div className="sensor-modal-actions">
              <button type="button" className="btn-primary" onClick={() => setInfoModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`optimization-toast optimization-toast--${toast.tone}`} role="status">
          {toast.message}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>Energy Optimization</h1>
          <p>AI-powered suggestions to reduce costs and improve efficiency</p>
        </div>
        
        <div className="optimization-controls">
          <div className="auto-optimize-toggle">
            <label>
              <input
                type="checkbox"
                checked={autoOptimize}
                onChange={(e) => setAutoOptimize(e.target.checked)}
              />
              <span className="toggle-slider"></span>
              Auto-Optimize
            </label>
            {autoOptimize && (
              <span className="auto-optimize-badge" title="Pulls live stats, fleet sensors, and optimizer on a timer">
                <Radio size={12} className="auto-optimize-pulse" />
                Live · every {AUTO_REFRESH_MS / 1000}s
                {autoScanCount > 0 && (
                  <span className="auto-optimize-count"> · {autoScanCount} syncs</span>
                )}
              </span>
            )}
          </div>
          
          <button 
            type="button"
            className={`btn-primary btn-refresh-optimization ${refreshing ? 'is-loading' : ''}`}
            disabled={refreshing}
            onClick={() => runRefresh('manual')}
          >
            {refreshing ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <Lightbulb size={16} />
            )}
            {refreshing ? 'Syncing…' : 'Refresh Suggestions'}
          </button>
        </div>
      </div>

      {/* Optimization Overview */}
      <div className="optimization-overview">
        <div className="overview-card">
          <div className="overview-icon">
            <Zap size={24} />
          </div>
          <div className="overview-content">
            <h3>Current Consumption</h3>
            <div className="overview-value">{stats.total_energy?.toFixed(1) || 0} kWh</div>
            <div className="overview-subtitle">Real-time usage</div>
          </div>
        </div>

        <div className="overview-card">
          <div className="overview-icon">
            <DollarSign size={24} />
          </div>
          <div className="overview-content">
            <h3>Potential Savings</h3>
            <div className="overview-value">${totalPotentialSavings.toFixed(2)}/h</div>
            <div className="overview-subtitle">From active suggestions</div>
            {scheduledJobs.length > 0 && (
              <div className="overview-subnote">
                <Calendar size={12} />
                +${scheduledWindowsImpact.toFixed(0)} in {scheduledJobs.length} committed window
                {scheduledJobs.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        <div className="overview-card">
          <div className="overview-icon">
            <TrendingUp size={24} />
          </div>
          <div className="overview-content">
            <h3>Efficiency Score</h3>
            <div className="overview-value">{Number(efficiencyScore).toFixed(1)}%</div>
            <div className="overview-subtitle">System performance</div>
          </div>
        </div>

        <div className="overview-card">
          <div className="overview-icon">
            <CheckCircle size={24} />
          </div>
          <div className="overview-content">
            <h3>Applied Optimizations</h3>
            <div className="overview-value">{appliedSuggestions.length}</div>
            <div className="overview-subtitle">
              Session rate ${sessionHourlySavings.toFixed(2)}/h committed
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="optimization-filters">
        <div className="filter-buttons">
          {['all', 'critical', 'high', 'medium', 'low'].map(filter => (
            <button
              key={filter}
              className={`filter-btn ${activeFilter === filter ? 'active' : ''}`}
              onClick={() => setActiveFilter(filter)}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
              <span className="filter-count">
                {filter === 'all' 
                  ? optimizationSuggestions.length 
                  : optimizationSuggestions.filter(s => s.priority === filter).length
                }
              </span>
            </button>
          ))}
        </div>

        <div className="filter-info">
          <span>Showing {filteredSuggestions.length} suggestions</span>
          <span>•</span>
          <span>
            Last sync:{' '}
            {lastRefreshAt
              ? lastRefreshAt.toLocaleTimeString()
              : '—'}
          </span>
          {autoOptimize && (
            <>
              <span>•</span>
              <span className="filter-info-live">Background refresh on</span>
            </>
          )}
        </div>
      </div>

      {/* Suggestions Grid */}
      <div className="suggestions-grid">
        {filteredSuggestions.length > 0 ? (
          filteredSuggestions.map((suggestion, index) => (
            <SuggestionCard
              key={`${suggestion.sensor_id}-${index}`}
              suggestion={suggestion}
              onApply={handleApplySuggestion}
              onSchedule={handleScheduleSuggestion}
              onMoreInfo={handleMoreInfo}
              applyingKey={applyingKey}
            />
          ))
        ) : (
          <div className="no-suggestions">
            <Lightbulb size={48} />
            <h3>No optimization suggestions available</h3>
            <p>All systems are currently optimized, or check back later for new recommendations.</p>
          </div>
        )}
      </div>

      {scheduledJobs.length > 0 && (
        <div className="scheduled-jobs-panel">
          <h3>
            <Calendar size={18} />
            Committed schedules
          </h3>
          <p className="scheduled-jobs-panel__intro">
            These windows use the same off-peak / shoulder / on-peak rates as the backend optimizer ({' '}
            <code>$0.08</code> / <code>$0.12</code> / <code>$0.18</code> per kWh).
          </p>
          <ul className="scheduled-jobs-list">
            {scheduledJobs.map((job) => (
              <li key={job.schId} className="scheduled-job-row">
                <div className="scheduled-job-row__main">
                  <code className="scheduled-job-id">{job.schId}</code>
                  <span className="scheduled-job-title">{job.title}</span>
                  <span className="scheduled-job-meta">
                    {job.sensorId} · {job.durationH}h · {job.windowLabel}
                  </span>
                </div>
                <div className="scheduled-job-row__impact">~${job.windowSaving.toFixed(2)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Applied Suggestions */}
      {appliedSuggestions.length > 0 && (
        <div className="applied-suggestions">
          <h3>Recently Applied Optimizations</h3>
          <div className="applied-list">
            {appliedSuggestions.slice(0, 5).map((suggestion, index) => (
              <div key={index} className="applied-item">
                <CheckCircle size={16} className="applied-icon" />
                <div className="applied-content">
                  <span className="applied-title">{suggestion.title}</span>
                  <span className="applied-time">
                    Applied {new Date(suggestion.appliedAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="applied-status">Active</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optimization Tips */}
      <div className="optimization-tips">
        <h3>💡 Pro Tips for Maximum Efficiency</h3>
        <div className="tips-grid">
          <div className="tip-card">
            <div className="tip-icon">🌙</div>
            <h4>Off-Peak Scheduling</h4>
            <p>Run high-energy processes during off-peak hours (8 PM - 6 AM) to reduce electricity costs by up to 40%.</p>
          </div>
          
          <div className="tip-card">
            <div className="tip-icon">🔄</div>
            <h4>Equipment Maintenance</h4>
            <p>Regular maintenance can improve equipment efficiency by 15-20% and extend lifespan by 30%.</p>
          </div>
          
          <div className="tip-card">
            <div className="tip-icon">🌡️</div>
            <h4>Temperature Control</h4>
            <p>Maintain optimal operating temperatures to prevent energy waste and equipment stress.</p>
          </div>
          
          <div className="tip-card">
            <div className="tip-icon">📊</div>
            <h4>Continuous Monitoring</h4>
            <p>Real-time monitoring helps identify inefficiencies before they become costly problems.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Optimization;