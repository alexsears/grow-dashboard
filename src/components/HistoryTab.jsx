import { useState, useEffect } from "react";
import { getLogbook, callService, createAutomation, getStates, getEntityAreas } from "../services/homeAssistant";
import "./HistoryTab.css";

// Extract room/location keywords from entity names
function extractRoomKeywords(entityId) {
  const name = entityId.split(".")[1] || "";
  const keywords = new Set();

  const roomPatterns = [
    "living", "bedroom", "kitchen", "bathroom", "garage", "office", "basement",
    "attic", "hallway", "entrance", "front", "back", "master", "guest", "kids",
    "dining", "laundry", "closet", "patio", "deck", "porch", "lab", "flower",
    "mother", "nursery", "tent", "grow", "veg", "clone"
  ];

  roomPatterns.forEach(room => {
    if (name.toLowerCase().includes(room)) {
      keywords.add(room);
    }
  });

  return keywords;
}

// Score how related two entities are based on naming
function getNameSimilarityScore(entity1, entity2) {
  const keywords1 = extractRoomKeywords(entity1);
  const keywords2 = extractRoomKeywords(entity2);

  let matches = 0;
  keywords1.forEach(k => {
    if (keywords2.has(k)) matches++;
  });

  return matches;
}

// Domain compatibility matrix - which triggers make sense for which targets
const DOMAIN_PAIRINGS = {
  light: {
    motion: 80,      // motion → light is classic
    occupancy: 80,
    presence: 60,
    door: 40,        // entry lighting
    illuminance: 50, // turn on when dark
  },
  switch: {
    motion: 60,
    door: 40,
    presence: 50,
  },
  fan: {
    temperature: 70,
    humidity: 80,
    motion: 30,
  },
  climate: {
    temperature: 60,
    humidity: 40,
    window: 50,      // turn off when window opens
    presence: 60,    // eco when away
    door: 30,
  },
  cover: {
    sun: 60,
    temperature: 40,
    window: 30,
    presence: 40,
  },
  lock: {
    door: 80,        // lock after door closes
    presence: 70,    // lock when leaving
    motion: 20,
  },
  media_player: {
    motion: 40,
    presence: 50,
  },
};

// Get domain pairing score
function getDomainPairingScore(targetDomain, triggerDeviceClass, triggerType) {
  const pairings = DOMAIN_PAIRINGS[targetDomain] || {};
  return pairings[triggerDeviceClass] || pairings[triggerType] || 0;
}

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

  // Automation wizard state
  const [wizard, setWizard] = useState(null); // { targetEntity, suggestion, step, triggerEntity, triggerValue, availableTriggers }
  const [allStates, setAllStates] = useState([]);

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

  // Trigger type configs
  const TRIGGER_CONFIGS = {
    sunset: { needsSensor: false },
    schedule: { needsSensor: false, needsTime: true },
    motion: { needsSensor: true, sensorFilter: (e) => e.entity_id.startsWith("binary_sensor.") && e.attributes?.device_class === "motion" },
    door: { needsSensor: true, sensorFilter: (e) => e.entity_id.startsWith("binary_sensor.") && (e.attributes?.device_class === "door" || e.attributes?.device_class === "opening") },
    presence: { needsSensor: true, sensorFilter: (e) => e.entity_id.startsWith("person.") || e.entity_id.startsWith("device_tracker.") },
    temperature: { needsSensor: true, needsThreshold: true, sensorFilter: (e) => e.entity_id.startsWith("sensor.") && e.attributes?.device_class === "temperature" },
    humidity: { needsSensor: true, needsThreshold: true, sensorFilter: (e) => e.entity_id.startsWith("sensor.") && e.attributes?.device_class === "humidity" },
    window: { needsSensor: true, sensorFilter: (e) => e.entity_id.startsWith("binary_sensor.") && e.attributes?.device_class === "window" },
  };

  async function handleCreateAutomation(entityId, suggestion) {
    const config = TRIGGER_CONFIGS[suggestion.type] || {};

    // If no sensor needed, create directly
    if (!config.needsSensor && !config.needsTime) {
      await finalizeAutomation(entityId, suggestion, null, null);
      return;
    }

    // Load available triggers
    let states = allStates;
    if (states.length === 0) {
      states = await getStates();
      setAllStates(states);
    }

    let availableTriggers = config.sensorFilter
      ? states.filter(config.sensorFilter)
      : [];

    // Get areas for target and all potential triggers
    const allEntityIds = [entityId, ...availableTriggers.map(t => t.entity_id)];
    let entityAreas = {};
    try {
      entityAreas = await getEntityAreas(allEntityIds);
    } catch (err) {
      console.error("Failed to get entity areas:", err);
    }

    const targetArea = entityAreas[entityId];

    // Find entities that were active around the same time (from events)
    const recentTriggerEntities = new Set();
    events.forEach(e => {
      if (e.context_entity_id) {
        recentTriggerEntities.add(e.context_entity_id);
      }
    });

    const targetDomain = entityId.split(".")[0];

    // Score and rank triggers
    availableTriggers = availableTriggers.map(trigger => {
      let score = 0;
      let reasons = [];

      const triggerDeviceClass = trigger.attributes?.device_class;
      const triggerArea = entityAreas[trigger.entity_id];

      // 1. Same area = highest priority (+100)
      if (targetArea && triggerArea && targetArea === triggerArea) {
        score += 100;
        reasons.push("Same room");
      }

      // 2. Domain/device_class pairing bonus (+0-80)
      const pairingScore = getDomainPairingScore(targetDomain, triggerDeviceClass, suggestion.type);
      if (pairingScore > 0) {
        score += pairingScore;
        if (pairingScore >= 60) {
          reasons.push("Great match");
        }
      }

      // 3. Name similarity (+30 per match)
      const nameSimilarity = getNameSimilarityScore(entityId, trigger.entity_id);
      if (nameSimilarity > 0) {
        score += nameSimilarity * 30;
        if (!reasons.includes("Same room")) {
          reasons.push("Related area");
        }
      }

      // 4. Recently triggered something in history (+20)
      if (recentTriggerEntities.has(trigger.entity_id)) {
        score += 25;
        reasons.push("Used recently");
      }

      // 5. Currently active bonus (+5)
      if (trigger.state === "on" || trigger.state === "home" || trigger.state === "detected") {
        score += 5;
      }

      // 6. Penalize potentially noisy sensors
      const triggerName = trigger.entity_id.toLowerCase();
      if (triggerName.includes("battery") || triggerName.includes("signal") || triggerName.includes("update")) {
        score -= 50;
      }

      return {
        ...trigger,
        score,
        reasons,
        area: triggerArea,
        deviceClass: triggerDeviceClass,
      };
    });

    // Sort by score descending
    availableTriggers.sort((a, b) => b.score - a.score);

    // Auto-select top recommendation if it's a strong match (score >= 150)
    const topMatch = availableTriggers[0];
    const autoSelect = topMatch && topMatch.score >= 150 ? topMatch.entity_id : null;

    setWizard({
      targetEntity: entityId,
      targetArea,
      suggestion,
      step: config.needsTime ? "time" : "sensor",
      triggerEntity: autoSelect,
      triggerValue: config.needsThreshold ? "75" : config.needsTime ? "18:00" : null,
      availableTriggers,
    });
  }

  async function finalizeAutomation(entityId, suggestion, triggerEntity, triggerValue) {
    const domain = entityId.split(".")[0];
    const entityName = entityId.split(".")[1].replace(/_/g, " ");

    const getService = (on = true) => {
      if (domain === "cover") return on ? "cover.open_cover" : "cover.close_cover";
      if (domain === "lock") return on ? "lock.unlock" : "lock.lock";
      return on ? `${domain}.turn_on` : `${domain}.turn_off`;
    };

    let config = {
      alias: `${suggestion.label} - ${entityName}`,
      description: `Created from dashboard: ${suggestion.desc}`,
      mode: "single",
      trigger: [],
      action: [{ service: getService(true), target: { entity_id: entityId } }],
    };

    switch (suggestion.type) {
      case "sunset":
        config.trigger = [{ platform: "sun", event: "sunset" }];
        break;
      case "schedule":
        config.trigger = [{ platform: "time", at: `${triggerValue}:00` }];
        break;
      case "motion":
      case "door":
      case "window":
        config.trigger = [{ platform: "state", entity_id: triggerEntity, to: "on" }];
        if (suggestion.type === "window") {
          config.action = [{ service: getService(false), target: { entity_id: entityId } }];
        }
        break;
      case "presence":
        config.trigger = [{ platform: "state", entity_id: triggerEntity, to: "home" }];
        break;
      case "temperature":
      case "humidity":
        config.trigger = [{ platform: "numeric_state", entity_id: triggerEntity, above: parseFloat(triggerValue) }];
        break;
    }

    try {
      await createAutomation(config);
      setWizard(null);
      alert(`Created: ${config.alias}`);
      loadHistory();
    } catch (err) {
      console.error("Failed to create automation:", err);
      alert(`Failed: ${err.message}`);
    }
  }

  async function handleDisableAutomation(automationId) {
    if (!automationId) return;
    const name = automationId.split(".")[1].replace(/_/g, " ");
    if (confirm(`Disable automation "${name}"?`)) {
      try {
        await callService("automation", "turn_off", { entity_id: automationId });
        alert(`Disabled: ${name}`);
        loadHistory();
      } catch (err) {
        console.error("Failed to disable automation:", err);
        alert("Failed to disable automation");
      }
    }
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

                  {isSelected && (
                    <div className="event-details">
                      {/* Show what triggered this */}
                      {event.context_entity_id && (
                        <div className="trigger-info">
                          <div className="trigger-header">
                            <span className="trigger-icon">⚙️</span>
                            <span className="trigger-label">Triggered by</span>
                          </div>
                          <div className="trigger-name">{event.context_name || event.context_entity_id}</div>
                          {event.context_source && (
                            <div className="trigger-source">{event.context_source}</div>
                          )}
                          <button
                            className="disable-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDisableAutomation(event.context_entity_id);
                            }}
                          >
                            Disable Automation
                          </button>
                        </div>
                      )}

                      {/* No trigger context - show suggestions */}
                      {!event.context_entity_id && suggestions.length > 0 && (
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
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Automation Wizard Modal */}
      {wizard && (
        <div className="wizard-overlay" onClick={() => setWizard(null)}>
          <div className="wizard-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wizard-header">
              <span className="wizard-icon">{wizard.suggestion.icon}</span>
              <h3>{wizard.suggestion.label}</h3>
              <button className="wizard-close" onClick={() => setWizard(null)}>×</button>
            </div>

            <div className="wizard-target">
              Target: <strong>{wizard.targetEntity.split(".")[1].replace(/_/g, " ")}</strong>
            </div>

            {wizard.step === "time" && (
              <div className="wizard-step">
                <label>Trigger time:</label>
                <input
                  type="time"
                  value={wizard.triggerValue}
                  onChange={(e) => setWizard({ ...wizard, triggerValue: e.target.value })}
                />
                <button
                  className="wizard-create"
                  onClick={() => finalizeAutomation(wizard.targetEntity, wizard.suggestion, null, wizard.triggerValue)}
                >
                  Create Automation
                </button>
              </div>
            )}

            {wizard.step === "sensor" && (
              <div className="wizard-step">
                <label>Select trigger {wizard.suggestion.type}:</label>
                {wizard.availableTriggers.length === 0 ? (
                  <div className="wizard-empty">No {wizard.suggestion.type} sensors found</div>
                ) : (
                  <div className="wizard-sensors">
                    {wizard.availableTriggers.map((s, idx) => (
                      <button
                        key={s.entity_id}
                        className={`wizard-sensor ${wizard.triggerEntity === s.entity_id ? "selected" : ""} ${s.score >= 100 ? "recommended" : ""}`}
                        onClick={() => setWizard({ ...wizard, triggerEntity: s.entity_id })}
                      >
                        <div className="sensor-main">
                          <div className="sensor-name-row">
                            <span className="sensor-name">
                              {s.attributes?.friendly_name || s.entity_id.split(".")[1].replace(/_/g, " ")}
                            </span>
                            {idx === 0 && s.score >= 100 && (
                              <span className="top-pick">Top pick</span>
                            )}
                          </div>
                          {s.reasons && s.reasons.length > 0 && (
                            <span className="sensor-reasons">
                              {s.reasons.map((r, i) => (
                                <span key={i} className="reason-tag">{r}</span>
                              ))}
                            </span>
                          )}
                        </div>
                        <span className={`sensor-state ${s.state === "on" || s.state === "home" ? "active" : ""}`}>
                          {s.state}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {TRIGGER_CONFIGS[wizard.suggestion.type]?.needsThreshold && wizard.triggerEntity && (
                  <div className="wizard-threshold">
                    <label>Trigger above:</label>
                    <input
                      type="number"
                      value={wizard.triggerValue}
                      onChange={(e) => setWizard({ ...wizard, triggerValue: e.target.value })}
                    />
                    <span>{wizard.suggestion.type === "temperature" ? "°F" : "%"}</span>
                  </div>
                )}

                {wizard.triggerEntity && (
                  <button
                    className="wizard-create"
                    onClick={() => finalizeAutomation(wizard.targetEntity, wizard.suggestion, wizard.triggerEntity, wizard.triggerValue)}
                  >
                    Create Automation
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
