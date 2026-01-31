import { useState, useEffect } from "react";
import { getDevicesByArea, getStates } from "../services/homeAssistant";

const ROOM_ICONS = {
  living: "🛋️",
  bedroom: "🛏️",
  kitchen: "🍳",
  bathroom: "🚿",
  office: "💼",
  garage: "🚗",
  outdoor: "🌳",
  basement: "📦",
  default: "🏠",
};

function getRoomIcon(roomName) {
  const name = roomName.toLowerCase();
  for (const [key, icon] of Object.entries(ROOM_ICONS)) {
    if (name.includes(key)) return icon;
  }
  return ROOM_ICONS.default;
}

export default function RoomCard({ areaId, areaName, onClick }) {
  const [deviceCount, setDeviceCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    async function loadCounts() {
      try {
        const [entities, states] = await Promise.all([
          getDevicesByArea(areaId),
          getStates(),
        ]);

        const stateMap = Object.fromEntries(
          states.map((s) => [s.entity_id, s])
        );

        const controllable = entities.filter((id) => {
          const domain = id.split(".")[0];
          return ["light", "switch", "fan", "climate", "cover"].includes(domain);
        });

        const active = controllable.filter((id) => {
          const state = stateMap[id];
          return state && state.state === "on";
        });

        setDeviceCount(controllable.length);
        setActiveCount(active.length);
      } catch (err) {
        console.error("Failed to load room data:", err);
      }
    }
    loadCounts();
  }, [areaId]);

  return (
    <div className="room-card" onClick={() => onClick(areaId, areaName)}>
      <div className="room-icon">{getRoomIcon(areaName)}</div>
      <div className="room-name">{areaName}</div>
      <div className="room-status">
        {activeCount > 0 ? (
          <span className="active">{activeCount} on</span>
        ) : (
          <span className="inactive">All off</span>
        )}
        <span className="device-count">{deviceCount} devices</span>
      </div>
    </div>
  );
}
