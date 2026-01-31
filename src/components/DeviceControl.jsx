import { useState } from "react";

const DOMAIN_ICONS = {
  light: "💡",
  switch: "🔌",
  fan: "🌀",
  climate: "🌡️",
  cover: "🪟",
  sensor: "📊",
  binary_sensor: "⚡",
  media_player: "🎵",
};

export default function DeviceControl({ device, onToggle, onBrightness }) {
  const [brightness, setBrightness] = useState(
    device.attributes?.brightness
      ? Math.round(device.attributes.brightness / 2.55)
      : 100
  );

  const domain = device.entityId.split(".")[0];
  const name =
    device.attributes?.friendly_name ||
    device.entityId.split(".")[1].replace(/_/g, " ");
  const isOn = device.state === "on";
  const isControllable = ["light", "switch", "fan", "cover"].includes(domain);
  const isLight = domain === "light";
  const hasBrightness = isLight && device.attributes?.supported_features & 1;

  function handleBrightnessChange(e) {
    const value = parseInt(e.target.value);
    setBrightness(value);
  }

  function handleBrightnessCommit() {
    onBrightness(device.entityId, brightness);
  }

  function formatState(device) {
    if (domain === "sensor") {
      const unit = device.attributes?.unit_of_measurement || "";
      return `${device.state} ${unit}`.trim();
    }
    if (domain === "climate") {
      const temp = device.attributes?.current_temperature;
      return temp ? `${temp}°` : device.state;
    }
    return device.state;
  }

  return (
    <div className={`device-control ${isOn ? "on" : "off"}`}>
      <div className="device-info">
        <span className="device-icon">{DOMAIN_ICONS[domain] || "❓"}</span>
        <span className="device-name">{name}</span>
      </div>

      <div className="device-actions">
        {isControllable ? (
          <button
            className={`toggle-btn ${isOn ? "on" : "off"}`}
            onClick={() => onToggle(device.entityId)}
          >
            {isOn ? "ON" : "OFF"}
          </button>
        ) : (
          <span className="device-state">{formatState(device)}</span>
        )}
      </div>

      {hasBrightness && isOn && (
        <div className="brightness-control">
          <input
            type="range"
            min="1"
            max="100"
            value={brightness}
            onChange={handleBrightnessChange}
            onMouseUp={handleBrightnessCommit}
            onTouchEnd={handleBrightnessCommit}
          />
          <span className="brightness-value">{brightness}%</span>
        </div>
      )}
    </div>
  );
}
