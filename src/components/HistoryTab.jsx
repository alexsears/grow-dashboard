import { useState, useEffect } from "react";
import { getLogbook } from "../services/homeAssistant";
import "./HistoryTab.css";

const AUTOMATION_SUGGESTIONS = {
  light: [
    { type: "motion", icon: "👁️", label: "Motion Trigger", desc: "Turn on when motion detected" },
    { type: "schedule", icon: "⏰", label: "Schedule", desc: "Turn on/off at specific times" },
    { type: "sunset", icon: "🌅", label: "Sunset Trigger", desc: "Turn on at sunset" },
    { type: "door", icon: "🚪", label: "Door Trigger", desc: "Turn on when door opens" },
  ],
  switch: [
    { type: "motion", icon: "👁️", label: "Motion Trigger", desc: "Toggle based on motion" },
    { type: "schedule", icon: "⏰", label: "Schedule", desc: "Turn on/off at specific times" },
    { type: "presence", icon: "📍", label: "Presence", desc: "Toggle when home/away" },
  ],
  fan: [
    { type: "temperature", icon: "🌡️", label: "Temperature", desc: "Turn on when it gets hot" },
    { type: "schedule", icon: "⏰", label: "Schedule", desc: "Run at specific times" },
    { type: "humidity", icon: "💧", label: "Humidity", desc: "Turn on when humid" },
  ],
  climate: [
    { type: "schedule", icon: "⏰", label: "Schedule", desc: "Set temperature by time of day" },
    { type: "presence", icon: "📍", label: "Presence", desc: "Adjust when home/away" },
    { type: "window", icon: "🪟", label: "Window Sensor", desc: "Turn off when window opens" },
  ],
  cover: [
    { type: "schedule", icon: "⏰", label: "Schedule", desc: "Open/close at specific times" },
    { type: "sunset", icon: "🌅", label: "Sun Position", desc: "Adjust based on sun" },
    { type: "temperature", icon: "🌡️", label: "Temperature", desc: "Close when too hot" },
  ],
  lock: [
    { type: "schedule", icon: "⏰", label: "Auto-lock", desc: "Lock at night" },
    { type: "presence", icon: "📍", label: "Presence", desc: "Lock when leaving" },
    { type: "door", icon: "🚪", label: "Door Close", desc: "Lock after door closes" },
  ],
};

function getEntityIcon(domain) {
  const icons = {
    light: "💡",
    switch: "🔌",
    fan: "🌀",
    climate: "🌡️",
    cover: "🪟",
    lock: "🔒",
    sensor: "📊",
    binary_sensor: "⚡",
    automation: "⚙️",
    script: "📜",
    scene: "🎬",
    media_player: "🔊",
    camera: "📷",
  };
  return icons[domain] || "❓";
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function analyzePatterns(events) {
  const patterns = {};

  events.forEach((event) => {
    const entityId = event.entity_id;
    if (!entityId) return;

    const domain = entityId.split(".")[0];
    if (!patterns[entityId]) {
      patterns[entityId] = {
        domain,
        count: 0,
        times: [],
        states: {},
      };
    }

    patterns[entityId].count++;
    patterns[entityId].times.push(new Date(event.when));

    if (event.state) {
      patterns[entityId].states[event.state] = (patterns[entityId].states[event.state] || 0) + 1;
    }
  });

  // Analyze timing patterns
  Object.keys(patterns).forEach((entityId) => {
    const p = patterns[entityId];
    if (p.times.length >= 2) {
      const hours = p.times.map((t) => t.getHours());
      const avgHour = hours.reduce((a, b) => a + b, 0) / hours.length;
      p.avgHour = avgHour;
      p.isScheduled = new Set(hours).size <= 3; // Few distinct hours = likely scheduled
    }
  });

  return patterns;
}

function getSuggestionsForEntity(entityId, pattern) {
  const domain = entityId.split(".")[0];
  const suggestions = AUTOMATION_SUGGESTIONS[domain] || [];

  // Prioritize based on pattern analysis
  const sorted = [...suggestions].sort((a, b) => {
    // If entity is used at consistent times, prioritize schedule
    if (pattern?.isScheduled && a.type === "schedule") return -1;
    if (pattern?.isScheduled && b.type === "schedule") return 1;
    return 0;
  });

  return sorted.slice(0, 3);
}

export default function HistoryTab() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [hoursBack, setHoursBack] = useState(24);
  const [patterns, setPatterns] = useState({});

  useEffect(() => {
    loadHistory();
  }, [hoursBack]);

  async function loadHistory() {
    setLoading(true);
    setError(null);
    try {
      const data = await getLogbook(hoursBack);
      // Filter to controllable entities
      const filtered = data.filter((e) => {
        const domain = e.entity_id?.split(".")[0];
        return ["light", "switch", "fan", "climate", "cover", "lock", "media_player"].includes(domain);
      });

      // Deduplicate: keep only most recent event per entity, but count total
      const entityMap = new Map();
      filtered.forEach((event) => {
        const existing = entityMap.get(event.entity_id);
        if (!existing || new Date(event.when) > new Date(existing.when)) {
          entityMap.set(event.entity_id, { ...event, eventCount: (existing?.eventCount || 0) + 1 });
        } else if (existing) {
          existing.eventCount = (existing.eventCount || 1) + 1;
        }
      });

      // Convert to array and sort by most recent
      const deduplicated = Array.from(entityMap.values())
        .sort((a, b) => new Date(b.when) - new Date(a.when));

      setEvents(deduplicated);
      setPatterns(analyzePatterns(filtered));
    } catch (err) {
      console.error("Failed to load history:", err);
      setError("Failed to load activity history");
    }
    setLoading(false);
  }

  function handleEntityClick(entityId) {
    setSelectedEntity(selectedEntity === entityId ? null : entityId);
  }

  function handleCreateAutomation(entityId, suggestion) {
    // For now, show an alert with the automation concept
    // In a full implementation, this would open HA's automation editor
    const name = entityId.split(".")[1].replace(/_/g, " ");
    alert(
      `Create automation:\n\n` +
      `Trigger: ${suggestion.label}\n` +
      `Action: Control "${name}"\n\n` +
      `(In a full implementation, this would open Home Assistant's automation editor)`
    );
  }

  const uniqueEntities = [...new Set(events.map((e) => e.entity_id).filter(Boolean))];

  return (
    <div className="history-tab">
      <div className="history-header">
        <h2>Activity</h2>
        <div className="time-filter">
          <button
            className={hoursBack === 6 ? "active" : ""}
            onClick={() => setHoursBack(6)}
          >
            6h
          </button>
          <button
            className={hoursBack === 24 ? "active" : ""}
            onClick={() => setHoursBack(24)}
          >
            24h
          </button>
          <button
            className={hoursBack === 72 ? "active" : ""}
            onClick={() => setHoursBack(72)}
          >
            3d
          </button>
          <button
            className={hoursBack === 168 ? "active" : ""}
            onClick={() => setHoursBack(168)}
          >
            7d
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading activity...</div>
      ) : error ? (
        <div className="error">
          <p>{error}</p>
          <button onClick={loadHistory}>Retry</button>
        </div>
      ) : events.length === 0 ? (
        <div className="empty">No activity in the last {hoursBack} hours</div>
      ) : (
        <>
          <div className="entity-summary">
            <span>{uniqueEntities.length} devices</span>
            <span>{events.length} events</span>
          </div>

          <div className="event-list">
            {events.map((event, idx) => {
              const entityId = event.entity_id;
              const domain = entityId?.split(".")[0] || "unknown";
              const name = event.name || entityId?.split(".")[1]?.replace(/_/g, " ") || "Unknown";
              const isSelected = selectedEntity === entityId;
              const suggestions = getSuggestionsForEntity(entityId, patterns[entityId]);
              const eventCount = event.eventCount || 1;

              return (
                <div key={`${entityId}-${idx}`} className="event-group">
                  <div
                    className={`event-item ${isSelected ? "selected" : ""}`}
                    onClick={() => handleEntityClick(entityId)}
                  >
                    <span className="event-icon">{getEntityIcon(domain)}</span>
                    <div className="event-info">
                      <span className="event-name">{name}</span>
                      <span className="event-message">
                        {event.message || event.state}
                        {eventCount > 1 && <span className="event-count"> ({eventCount}x)</span>}
                      </span>
                    </div>
                    <span className="event-time">{formatTime(event.when)}</span>
                  </div>

                  {isSelected && suggestions.length > 0 && (
                    <div className="automation-suggestions">
                      <div className="suggestions-header">Automate this?</div>
                      <div className="suggestions-list">
                        {suggestions.map((s) => (
                          <button
                            key={s.type}
                            className="suggestion-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateAutomation(entityId, s);
                            }}
                          >
                            <span className="suggestion-icon">{s.icon}</span>
                            <div className="suggestion-text">
                              <span className="suggestion-label">{s.label}</span>
                              <span className="suggestion-desc">{s.desc}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
