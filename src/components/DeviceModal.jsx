import { useState, useEffect } from "react";
import {
  getDevicesByArea,
  getStates,
  toggleEntity,
  turnOn,
  turnOff,
  setLightBrightness,
} from "../services/homeAssistant";
import DeviceControl from "./DeviceControl";

export default function DeviceModal({ areaId, areaName, onClose }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDevices();
  }, [areaId]);

  async function loadDevices() {
    setLoading(true);
    try {
      const [entities, states] = await Promise.all([
        getDevicesByArea(areaId),
        getStates(),
      ]);

      const stateMap = Object.fromEntries(
        states.map((s) => [s.entity_id, s])
      );

      // Filter to useful device types only
      const usefulDomains = ["light", "switch", "fan", "climate", "cover", "media_player", "sensor", "binary_sensor"];

      const deviceList = entities
        .map((id) => ({
          entityId: id,
          ...stateMap[id],
        }))
        .filter((d) => {
          if (d.state === undefined) return false;
          const domain = d.entityId.split(".")[0];
          return usefulDomains.includes(domain);
        })
        .sort((a, b) => {
          const domainOrder = ["light", "switch", "fan", "climate", "cover", "media_player", "sensor", "binary_sensor"];
          const aDomain = a.entityId.split(".")[0];
          const bDomain = b.entityId.split(".")[0];
          return domainOrder.indexOf(aDomain) - domainOrder.indexOf(bDomain);
        });

      console.log(`[${areaId}] Found ${entities.length} entities, showing ${deviceList.length} devices`);
      setDevices(deviceList);
    } catch (err) {
      console.error("Failed to load devices:", err);
    }
    setLoading(false);
  }

  async function handleToggle(entityId) {
    await toggleEntity(entityId);
    setTimeout(loadDevices, 500);
  }

  async function handleBrightness(entityId, value) {
    await setLightBrightness(entityId, value);
    setTimeout(loadDevices, 500);
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  const groupedDevices = devices.reduce((acc, device) => {
    const domain = device.entityId.split(".")[0];
    if (!acc[domain]) acc[domain] = [];
    acc[domain].push(device);
    return acc;
  }, {});

  const domainLabels = {
    light: "Lights",
    switch: "Switches",
    fan: "Fans",
    climate: "Climate",
    cover: "Covers",
    sensor: "Sensors",
    binary_sensor: "Binary Sensors",
    media_player: "Media",
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal">
        <div className="modal-header">
          <h2>{areaName}</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-content">
          {loading ? (
            <div className="loading">Loading devices...</div>
          ) : devices.length === 0 ? (
            <div className="empty">No devices in this room</div>
          ) : (
            Object.entries(groupedDevices).map(([domain, domainDevices]) => (
              <div key={domain} className="device-group">
                <h3>{domainLabels[domain] || domain}</h3>
                <div className="device-list">
                  {domainDevices.map((device) => (
                    <DeviceControl
                      key={device.entityId}
                      device={device}
                      onToggle={handleToggle}
                      onBrightness={handleBrightness}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
