import { useState, useEffect } from "react";
import { getStates, toggleEntity } from "../services/homeAssistant";
import "./GrowHub.css";

// VPD calculation
function calculateVPD(tempF, humidity) {
  const tempC = (tempF - 32) * (5 / 9);
  const leafTempC = tempC - 2;
  const svpLeaf = 0.6108 * Math.exp((17.27 * leafTempC) / (leafTempC + 237.3));
  const svpAir = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const avp = svpAir * (humidity / 100);
  return Math.max(0, svpLeaf - avp);
}

function getVPDZone(vpd) {
  if (vpd < 0.4) return { zone: "low", label: "Low", color: "#60a5fa" };
  if (vpd < 0.8) return { zone: "seedling", label: "Clone", color: "#4ade80" };
  if (vpd < 1.2) return { zone: "veg", label: "Veg", color: "#22c55e" };
  if (vpd < 1.6) return { zone: "flower", label: "Flower", color: "#84cc16" };
  return { zone: "high", label: "High", color: "#f97316" };
}

function formatNum(value) {
  if (value === undefined || value === null || value === "unavailable" || value === "unknown") return "--";
  const num = parseFloat(value);
  return isNaN(num) ? "--" : num.toFixed(1);
}

// Grow zones to monitor
const GROW_ZONES = ["lab", "flower", "mother", "garage"];

export default function GrowHub() {
  const [zones, setZones] = useState({});
  const [waters, setWaters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allStates, setAllStates] = useState({});

  useEffect(() => {
    loadSensors();
    const interval = setInterval(loadSensors, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadSensors() {
    try {
      const states = await getStates();
      const stateMap = {};
      states.forEach(s => { stateMap[s.entity_id] = s; });
      setAllStates(stateMap);

      // Find zone sensors
      const zoneData = {};
      GROW_ZONES.forEach(zone => {
        const zoneLower = zone.toLowerCase();

        // Find temp sensor for this zone
        const tempSensor = states.find(s =>
          s.entity_id.toLowerCase().includes(zoneLower) &&
          (s.attributes.device_class === "temperature" ||
           s.attributes.unit_of_measurement === "°F" ||
           s.attributes.unit_of_measurement === "°C" ||
           s.entity_id.includes("temperature") ||
           s.entity_id.includes("temp"))
        );

        // Find humidity sensor
        const humiditySensor = states.find(s =>
          s.entity_id.toLowerCase().includes(zoneLower) &&
          (s.attributes.device_class === "humidity" ||
           s.entity_id.includes("humidity"))
        );

        if (tempSensor || humiditySensor) {
          const temp = tempSensor ? parseFloat(tempSensor.state) : null;
          const humidity = humiditySensor ? parseFloat(humiditySensor.state) : null;

          zoneData[zone] = {
            name: zone.charAt(0).toUpperCase() + zone.slice(1),
            temp,
            humidity,
            tempUnit: tempSensor?.attributes.unit_of_measurement || "°F",
            vpd: (temp && humidity) ? calculateVPD(temp, humidity) : null,
          };
        }
      });
      setZones(zoneData);

      // Find water switches and sensors
      const waterEntities = states.filter(s =>
        s.entity_id.includes("water") ||
        s.entity_id.includes("moisture") ||
        s.entity_id.includes("reservoir") ||
        s.entity_id.includes("tank") ||
        s.entity_id.includes("pump") ||
        s.entity_id.includes("irrigation") ||
        s.attributes.device_class === "moisture"
      );
      setWaters(waterEntities);

    } catch (err) {
      console.error("Failed to load sensors:", err);
    }
    setLoading(false);
  }

  if (loading) {
    return <div className="grow-hub"><div className="loading">Loading grow data...</div></div>;
  }

  const zoneList = Object.values(zones);

  return (
    <div className="grow-hub">
      <div className="grow-header">
        <h2>Grow Hub</h2>
      </div>

      {/* VPD Overview Cards */}
      <div className="zone-grid">
        {zoneList.length > 0 ? (
          zoneList.map(zone => {
            const vpdInfo = zone.vpd ? getVPDZone(zone.vpd) : null;
            return (
              <div key={zone.name} className="zone-card">
                <h3>{zone.name}</h3>
                <div className="zone-readings">
                  <div className="reading-row">
                    <span className="label">Temp</span>
                    <span className="value">{formatNum(zone.temp)}{zone.tempUnit}</span>
                  </div>
                  <div className="reading-row">
                    <span className="label">RH</span>
                    <span className="value">{formatNum(zone.humidity)}%</span>
                  </div>
                  {zone.vpd !== null && (
                    <div className="reading-row vpd-row">
                      <span className="label">VPD</span>
                      <span className="value" style={{ color: vpdInfo?.color }}>
                        {zone.vpd.toFixed(2)} kPa
                      </span>
                    </div>
                  )}
                </div>
                {vpdInfo && (
                  <div className="vpd-badge" style={{ background: vpdInfo.color }}>
                    {vpdInfo.label}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="empty-zones">
            <p>No grow zone sensors found</p>
            <p className="hint">Looking for sensors in: {GROW_ZONES.join(", ")}</p>
          </div>
        )}
      </div>

      {/* Water Switches & Sensors */}
      {waters.length > 0 && (
        <div className="water-section">
          <h3>Water & Irrigation</h3>
          <div className="water-grid">
            {waters.map(entity => {
              const name = entity.attributes.friendly_name ||
                          entity.entity_id.split(".")[1].replace(/_/g, " ");
              const value = entity.state;
              const unit = entity.attributes.unit_of_measurement || "";
              const domain = entity.entity_id.split(".")[0];
              const isSwitch = domain === "switch" || domain === "input_boolean";
              const isOn = value === "on" || value === "wet" || value === "detected";
              const isOff = value === "off" || value === "dry" || value === "clear";

              async function handleToggle() {
                if (isSwitch) {
                  await toggleEntity(entity.entity_id);
                  setTimeout(loadSensors, 500);
                }
              }

              return (
                <div
                  key={entity.entity_id}
                  className={`water-card ${isOn ? "on" : "off"} ${isSwitch ? "clickable" : ""}`}
                  onClick={isSwitch ? handleToggle : undefined}
                >
                  <span className="water-icon">{isSwitch ? "🚿" : "💧"}</span>
                  <span className="water-name">{name}</span>
                  <span className={`water-value ${isOn ? "active" : ""}`}>
                    {isSwitch ? (isOn ? "ON" : "OFF") :
                     (isOn ? "Wet" : isOff ? "Dry" : `${formatNum(value)}${unit}`)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VPD Chart Legend */}
      <div className="vpd-legend">
        <h4>VPD Zones</h4>
        <div className="legend-items">
          <div className="legend-item"><span className="dot" style={{background: "#60a5fa"}} />Low (&lt;0.4)</div>
          <div className="legend-item"><span className="dot" style={{background: "#4ade80"}} />Clone (0.4-0.8)</div>
          <div className="legend-item"><span className="dot" style={{background: "#22c55e"}} />Veg (0.8-1.2)</div>
          <div className="legend-item"><span className="dot" style={{background: "#84cc16"}} />Flower (1.2-1.6)</div>
          <div className="legend-item"><span className="dot" style={{background: "#f97316"}} />High (&gt;1.6)</div>
        </div>
      </div>
    </div>
  );
}
