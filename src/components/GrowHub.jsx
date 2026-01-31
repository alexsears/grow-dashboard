import { useState, useEffect } from "react";
import { getStates, toggleEntity, callService } from "../services/homeAssistant";
import "./GrowHub.css";

// Zone configuration with specific entity IDs
const ZONES = [
  {
    id: "lab",
    name: "Lab",
    vpd: "sensor.lab_vpd",
    temp: "sensor.lab_climate2_temperature",
    humidity: "sensor.lab_climate2_humidity",
    altTemp: "sensor.lab_lab_temperature",
    altHumidity: "sensor.lab_lab_humidity",
  },
  {
    id: "flower",
    name: "Flower",
    vpd: "sensor.flower_vpd",
    temp: "sensor.avg_flower_temp",
    humidity: "sensor.avg_flower_humidity",
    altTemp: "sensor.flower_climate_1_temperature",
    altHumidity: "sensor.flower_climate_1_humidity",
  },
  {
    id: "mother",
    name: "Mother",
    vpd: "sensor.mother_vpd",
    temp: "sensor.moth_a_mother_temperature",
    humidity: "sensor.moth_a_mother_humidity",
    altTemp: "sensor.garage2_mother_3_temperature",
    altHumidity: "sensor.garage2_mother_3_humidity",
  },
  {
    id: "garage",
    name: "Garage",
    vpd: "sensor.garage_vpd",
    temp: "sensor.garage_climate_temperature",
    humidity: "sensor.garage_climate_humidity",
    altTemp: "sensor.garage_tent_room_temperature",
    altHumidity: "sensor.garage_tent_room_humidity",
  },
];

// Water-related entities
const WATER_ENTITIES = [
  "switch.garage_water_1",
  "switch.garage_water_2",
  "switch.lab_water_2",
  "switch.mother_water",
  "switch.mother_water_2",
  "switch.water_refill",
  "counter.water",
  "counter.water_1a",
  "counter.water_1b",
  "counter.water_2a",
  "counter.water_2b",
  "counter.refill_water",
  "timer.tent_water",
  "timer.water_1a",
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

export default function GrowHub() {
  const [states, setStates] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStates();
    const interval = setInterval(loadStates, 5000);
    return () => clearInterval(interval);
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

  async function handleToggle(entityId) {
    const domain = entityId.split(".")[0];
    if (domain === "switch" || domain === "input_boolean") {
      await toggleEntity(entityId);
      setTimeout(loadStates, 500);
    }
  }

  function getEntityValue(entityId) {
    const state = states[entityId];
    return state?.state;
  }

  function getEntityName(entityId) {
    const state = states[entityId];
    return state?.attributes?.friendly_name || entityId.split(".")[1].replace(/_/g, " ");
  }

  if (loading) {
    return <div className="grow-hub"><div className="loading">Loading...</div></div>;
  }

  // Get water entities that exist
  const waterEntities = WATER_ENTITIES
    .map(id => states[id])
    .filter(Boolean);

  return (
    <div className="grow-hub">
      {/* VPD Zone Cards */}
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
            </div>
          );
        })}
      </div>

      {/* Water Controls */}
      {waterEntities.length > 0 && (
        <div className="water-section">
          <h3>Water</h3>
          <div className="water-grid">
            {waterEntities.map(entity => {
              const domain = entity.entity_id.split(".")[0];
              const isSwitch = domain === "switch";
              const isOn = entity.state === "on";
              const name = entity.attributes?.friendly_name ||
                          entity.entity_id.split(".")[1].replace(/_/g, " ");
              const value = entity.state;
              const unit = entity.attributes?.unit_of_measurement || "";

              return (
                <div
                  key={entity.entity_id}
                  className={`water-card ${isSwitch ? "switch" : "sensor"} ${isOn ? "on" : ""}`}
                  onClick={isSwitch ? () => handleToggle(entity.entity_id) : undefined}
                >
                  <span className="water-icon">{isSwitch ? "🚿" : "💧"}</span>
                  <span className="water-name">{name}</span>
                  <span className={`water-value ${isOn ? "active" : ""}`}>
                    {isSwitch ? (isOn ? "ON" : "OFF") : `${value}${unit}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
