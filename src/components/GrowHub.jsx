import { useState, useEffect } from "react";
import { getStates, toggleEntity, getEntityHistory } from "../services/homeAssistant";
import "./GrowHub.css";

// Light schedule configuration
const LIGHTS = [
  { id: "switch.lab1a", name: "Lab 1A", zone: "flower" },
  { id: "switch.lab_diablo", name: "Diablo", zone: "flower" },
  { id: "switch.mother_light", name: "Mother", zone: "mother" },
  { id: "switch.garage_light_timer", name: "Garage", zone: "garage" },
  { id: "light.nursery_lamp_2", name: "Nursery", zone: "nursery" },
];

// Zone configuration
const ZONES = [
  {
    id: "flower",
    name: "Flower",
    vpd: "sensor.flower_vpd",
    temp: "sensor.avg_flower_temp",
    humidity: "sensor.avg_flower_humidity",
    altTemp: "sensor.flower_climate_1_temperature",
    altHumidity: "sensor.flower_climate_1_humidity",
    water: [
      { id: "switch.mister", name: "Mister" },
      { id: "switch.lab_water_2", name: "Lab Water" },
      { id: "switch.water_refill", name: "Refill" },
    ],
  },
  {
    id: "mother",
    name: "Mother",
    vpd: "sensor.mother_vpd",
    temp: "sensor.moth_a_mother_temperature",
    humidity: "sensor.moth_a_mother_humidity",
    altTemp: "sensor.garage2_mother_3_temperature",
    altHumidity: "sensor.garage2_mother_3_humidity",
    water: [
      { id: "switch.mother_water", name: "Water 1" },
      { id: "switch.mother_water_2", name: "Water 2" },
    ],
  },
  {
    id: "garage",
    name: "Garage",
    vpd: "sensor.garage_vpd",
    temp: "sensor.garage_climate_temperature",
    humidity: "sensor.garage_climate_humidity",
    altTemp: "sensor.garage_tent_room_temperature",
    altHumidity: "sensor.garage_tent_room_humidity",
    water: [
      { id: "switch.garage_water_1", name: "Water 1" },
      { id: "switch.garage_water_2", name: "Water 2" },
    ],
  },
  {
    id: "lab",
    name: "Lab",
    vpd: "sensor.lab_vpd",
    temp: "sensor.lab_climate2_temperature",
    humidity: "sensor.lab_climate2_humidity",
    altTemp: "sensor.lab_lab_temperature",
    altHumidity: "sensor.lab_lab_humidity",
    water: [],
  },
];

function getVPDZone(vpd) {
  const v = parseFloat(vpd);
  if (isNaN(v)) return { label: "--", color: "#666" };
  if (v < 0.4) return { label: "Low", color: "#60a5fa" };
  if (v < 0.8) return { label: "Clone", color: "#4ade80" };
  if (v < 1.2) return { label: "Veg", color: "#22c55e" };
  if (v < 1.6) return { label: "Flower", color: "#84cc16" };
  return { label: "High", color: "#f97316" };
}

function formatValue(state, fallback = "--") {
  if (!state || state === "unavailable" || state === "unknown") return fallback;
  const num = parseFloat(state);
  return isNaN(num) ? fallback : num.toFixed(1);
}

function formatDuration(seconds) {
  if (!seconds || seconds < 1) return "0s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// Calculate how long a switch was ON in history
function calculateOnTime(history) {
  if (!history || history.length === 0) return 0;

  let totalOnSeconds = 0;
  let lastOnTime = null;

  for (const entry of history) {
    const time = new Date(entry.last_changed || entry.last_updated);
    const state = entry.state;

    if (state === "on") {
      lastOnTime = time;
    } else if (state === "off" && lastOnTime) {
      totalOnSeconds += (time - lastOnTime) / 1000;
      lastOnTime = null;
    }
  }

  // If still on, count until now
  if (lastOnTime) {
    totalOnSeconds += (Date.now() - lastOnTime) / 1000;
  }

  return totalOnSeconds;
}

// Build timeline segments from history
function buildTimeline(history, hoursBack = 24) {
  const segments = [];
  const now = Date.now();
  const startTime = now - hoursBack * 60 * 60 * 1000;

  if (!history || history.length === 0) return segments;

  // Sort by time
  const sorted = [...history].sort((a, b) =>
    new Date(a.last_changed || a.last_updated) - new Date(b.last_changed || b.last_updated)
  );

  let currentState = sorted[0]?.state;
  let segmentStart = startTime;

  for (const entry of sorted) {
    const time = new Date(entry.last_changed || entry.last_updated).getTime();
    if (time < startTime) {
      currentState = entry.state;
      continue;
    }

    if (entry.state !== currentState) {
      // Close previous segment
      segments.push({
        start: Math.max(segmentStart, startTime),
        end: time,
        state: currentState,
      });
      segmentStart = time;
      currentState = entry.state;
    }
  }

  // Close final segment
  segments.push({
    start: segmentStart,
    end: now,
    state: currentState,
  });

  return segments;
}

export default function GrowHub() {
  const [states, setStates] = useState({});
  const [runtimes, setRuntimes] = useState({});
  const [lightHistory, setLightHistory] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStates();
    loadRuntimes();
    loadLightHistory();
    const stateInterval = setInterval(loadStates, 5000);
    const runtimeInterval = setInterval(loadRuntimes, 60000);
    const historyInterval = setInterval(loadLightHistory, 60000);
    return () => {
      clearInterval(stateInterval);
      clearInterval(runtimeInterval);
      clearInterval(historyInterval);
    };
  }, []);

  async function loadStates() {
    try {
      const allStates = await getStates();
      const stateMap = {};
      allStates.forEach(s => { stateMap[s.entity_id] = s; });
      setStates(stateMap);
    } catch (err) {
      console.error("Failed to load states:", err);
    }
    setLoading(false);
  }

  async function loadRuntimes() {
    const waterSwitches = ZONES.flatMap(z => z.water.map(w => w.id));
    const newRuntimes = {};

    await Promise.all(waterSwitches.map(async (entityId) => {
      try {
        const history = await getEntityHistory(entityId, 24);
        newRuntimes[entityId] = calculateOnTime(history);
      } catch (err) {
        console.error(`Failed to load history for ${entityId}:`, err);
      }
    }));

    setRuntimes(newRuntimes);
  }

  async function loadLightHistory() {
    const newHistory = {};

    await Promise.all(LIGHTS.map(async (light) => {
      try {
        const history = await getEntityHistory(light.id, 24);
        newHistory[light.id] = buildTimeline(history, 24);
      } catch (err) {
        console.error(`Failed to load history for ${light.id}:`, err);
      }
    }));

    setLightHistory(newHistory);
  }

  async function handleToggle(entityId) {
    await toggleEntity(entityId);
    setTimeout(loadStates, 500);
  }

  function getEntityValue(entityId) {
    return states[entityId]?.state;
  }

  if (loading) {
    return <div className="grow-hub"><div className="loading">Loading...</div></div>;
  }

  // Generate hour labels for timeline
  const now = new Date();
  const hours = [];
  for (let i = 24; i >= 0; i -= 6) {
    const h = new Date(now - i * 60 * 60 * 1000);
    hours.push(h.getHours());
  }

  return (
    <div className="grow-hub">
      {/* Light Schedule */}
      <div className="lights-section">
        <h3>Light Schedule (24h)</h3>
        <div className="lights-timeline">
          <div className="timeline-hours">
            <span></span>
            {hours.map((h, i) => (
              <span key={i}>{h}:00</span>
            ))}
          </div>
          {LIGHTS.map(light => {
            const segments = lightHistory[light.id] || [];
            const isOn = states[light.id]?.state === "on";
            const startTime = Date.now() - 24 * 60 * 60 * 1000;
            const duration = 24 * 60 * 60 * 1000;

            return (
              <div key={light.id} className="timeline-row">
                <span className={`timeline-label ${isOn ? "on" : ""}`}>
                  {light.name}
                </span>
                <div className="timeline-bar">
                  {segments.map((seg, i) => {
                    const left = ((seg.start - startTime) / duration) * 100;
                    const width = ((seg.end - seg.start) / duration) * 100;
                    const isOnSeg = seg.state === "on";

                    const startDate = new Date(seg.start);
                    const endDate = new Date(seg.end);
                    const formatT = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const durationMins = Math.round((seg.end - seg.start) / 60000);
                    const durationStr = durationMins >= 60
                      ? `${Math.floor(durationMins/60)}h ${durationMins%60}m`
                      : `${durationMins}m`;

                    return (
                      <div
                        key={i}
                        className={`timeline-segment ${isOnSeg ? "on" : "off"}`}
                        style={{
                          left: `${Math.max(0, left)}%`,
                          width: `${Math.min(100 - Math.max(0, left), width)}%`,
                        }}
                        title={isOnSeg ? `ON: ${formatT(startDate)} → ${formatT(endDate)} (${durationStr})` : ''}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Zone Cards */}
      <div className="zone-grid">
        {ZONES.map(zone => {
          const vpd = getEntityValue(zone.vpd);
          const temp = getEntityValue(zone.temp) || getEntityValue(zone.altTemp);
          const humidity = getEntityValue(zone.humidity) || getEntityValue(zone.altHumidity);
          const vpdInfo = getVPDZone(vpd);
          const tempUnit = states[zone.temp]?.attributes?.unit_of_measurement || "°F";

          return (
            <div key={zone.id} className="zone-card">
              <div className="zone-header">
                <h3>{zone.name}</h3>
                {vpd && vpd !== "unavailable" && (
                  <div className="vpd-badge" style={{ background: vpdInfo.color }}>
                    {vpdInfo.label}
                  </div>
                )}
              </div>

              <div className="zone-vpd" style={{ color: vpdInfo.color }}>
                <span className="vpd-value">{formatValue(vpd)}</span>
                <span className="vpd-unit">kPa</span>
              </div>

              <div className="zone-readings">
                <div className="reading">
                  <span className="reading-label">Temp</span>
                  <span className="reading-value">{formatValue(temp)}{tempUnit}</span>
                </div>
                <div className="reading">
                  <span className="reading-label">RH</span>
                  <span className="reading-value">{formatValue(humidity)}%</span>
                </div>
              </div>

              {/* Water controls for this zone */}
              {zone.water.length > 0 && (
                <div className="zone-water">
                  {zone.water.map(w => {
                    const state = states[w.id];
                    const isOn = state?.state === "on";
                    const runtime = runtimes[w.id] || 0;

                    return (
                      <div
                        key={w.id}
                        className={`water-btn ${isOn ? "on" : "off"}`}
                        onClick={() => handleToggle(w.id)}
                      >
                        <div className="water-btn-top">
                          <span className="water-icon">🚿</span>
                          <span className="water-name">{w.name}</span>
                        </div>
                        <div className="water-btn-bottom">
                          <span className={`water-status ${isOn ? "on" : ""}`}>
                            {isOn ? "ON" : "OFF"}
                          </span>
                          <span className="water-runtime">
                            {formatDuration(runtime)}/day
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* VPD Legend */}
      <div className="vpd-legend">
        <div className="legend-items">
          <div className="legend-item"><span className="dot" style={{background: "#60a5fa"}} />&lt;0.4 Low</div>
          <div className="legend-item"><span className="dot" style={{background: "#4ade80"}} />0.4-0.8 Clone</div>
          <div className="legend-item"><span className="dot" style={{background: "#22c55e"}} />0.8-1.2 Veg</div>
          <div className="legend-item"><span className="dot" style={{background: "#84cc16"}} />1.2-1.6 Flower</div>
          <div className="legend-item"><span className="dot" style={{background: "#f97316"}} />&gt;1.6 High</div>
        </div>
      </div>
    </div>
  );
}
