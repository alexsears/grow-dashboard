import { useState, useEffect, useRef } from "react";
import { getDevicesByArea, getStates, toggleEntity, callService } from "../services/homeAssistant";
import EntityPopover from "./EntityPopover";
import "./HouseView.css";

// Room layout based on actual floor plan
const ROOMS = [
  { id: "master_bath", name: "Master Bath", x: 2, y: 2, w: 14, h: 14 },
  { id: "master", name: "Master Bed", x: 16, y: 2, w: 18, h: 14 },
  { id: "bedroom", name: "Sean Room", x: 68, y: 2, w: 30, h: 18 },
  { id: "living_room", name: "Living Room", x: 34, y: 2, w: 34, h: 32 },
  { id: "bathroom", name: "Sean Bath", x: 80, y: 20, w: 18, h: 14 },
  { id: "game_room", name: "Game Room", x: 2, y: 16, w: 28, h: 18 },
  { id: "dining", name: "Dining", x: 2, y: 34, w: 32, h: 16 },
  { id: "kitchen", name: "Kitchen", x: 34, y: 34, w: 18, h: 16 },
  { id: "breakfast", name: "Breakfast", x: 52, y: 34, w: 20, h: 16 },
  { id: "nursery", name: "Nursery", x: 2, y: 50, w: 22, h: 18 },
  { id: "nursery_bath", name: "Nursery Bath", x: 2, y: 68, w: 14, h: 16 },
  { id: "laundry", name: "Laundry", x: 34, y: 50, w: 18, h: 16 },
  { id: "mudroom", name: "Mudroom", x: 52, y: 50, w: 18, h: 16 },
  { id: "lab", name: "Lab", x: 70, y: 50, w: 28, h: 16 },
  { id: "guest_room", name: "Guest Bed", x: 16, y: 68, w: 18, h: 16 },
  { id: "entry", name: "Entry", x: 34, y: 68, w: 10, h: 16 },
  { id: "office", name: "Office", x: 44, y: 66, w: 20, h: 18 },
  { id: "garage", name: "Garage", x: 64, y: 66, w: 34, h: 18 },
];

const STORAGE_KEY = 'entity-placements';
const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 150.75; // Matches 995x1500 aspect ratio
const ICON_SIZE_PX = 20;
const FLOOR_PLAN_IMAGE = '/house.png';

// Controllable domains that can be clicked
const CONTROLLABLE_DOMAINS = ['light', 'switch', 'fan', 'lock', 'cover', 'media_player', 'input_boolean', 'scene', 'script'];

function isControllable(entityId) {
  const domain = entityId.split('.')[0];
  return CONTROLLABLE_DOMAINS.includes(domain);
}

// Map entity state to visual representation
function getEntityVisual(entityId, state) {
  const domain = entityId.split('.')[0];
  const deviceClass = state?.attributes?.device_class;
  const stateValue = state?.state;
  const isOn = stateValue === 'on' || stateValue === 'playing' || stateValue === 'home';
  const isOff = stateValue === 'off' || stateValue === 'idle' || stateValue === 'not_home' || stateValue === 'clear';

  // Default visual
  let visual = {
    text: '●',
    className: 'entity',
    visible: true,
    title: entityId,
  };

  switch (domain) {
    case 'light':
      visual.text = '💡';
      visual.className = `entity light ${isOn ? 'is-on' : 'is-off'}`;
      break;

    case 'switch':
      visual.text = '🔌';
      visual.className = `entity switch ${isOn ? 'is-on' : 'is-off'}`;
      break;

    case 'fan':
      visual.text = '🌀';
      const fanSpeed = state?.attributes?.percentage || 0;
      let speedClass = '';
      if (isOn && fanSpeed > 66) speedClass = 'speed-3';
      else if (isOn && fanSpeed > 33) speedClass = 'speed-2';
      else if (isOn) speedClass = 'speed-1';
      visual.className = `entity fan ${isOn ? 'is-on' : 'is-off'} ${speedClass}`;
      break;

    case 'binary_sensor':
      // Handle different device classes
      if (deviceClass === 'door' || deviceClass === 'window' || deviceClass === 'opening' || deviceClass === 'garage_door') {
        visual.text = isOn ? '🚪' : ''; // Show door when open, hide when closed
        visual.className = `entity door ${isOn ? 'is-open' : 'is-closed'}`;
        visual.visible = isOn; // Only show when open
      } else if (deviceClass === 'motion' || deviceClass === 'occupancy' || deviceClass === 'presence') {
        visual.text = '👤';
        visual.className = `entity occupancy ${isOn ? 'is-on' : 'is-off'}`;
        visual.visible = isOn; // Only show when detected
      } else if (deviceClass === 'sound') {
        visual.text = '🔊';
        visual.className = `entity sound ${isOn ? 'is-on' : 'is-off'}`;
        visual.visible = isOn;
      } else {
        visual.text = '👁';
        visual.className = `entity binary-sensor ${isOn ? 'is-on' : 'is-off'}`;
      }
      break;

    case 'sensor':
      const unit = state?.attributes?.unit_of_measurement || '';
      const numValue = parseFloat(stateValue);

      if (deviceClass === 'temperature' || unit === '°F' || unit === '°C') {
        visual.text = isNaN(numValue) ? '--°' : `${Math.round(numValue)}°`;
        visual.className = 'entity sensor temp';
        visual.isValue = true;
      } else if (deviceClass === 'humidity' || unit === '%') {
        visual.text = isNaN(numValue) ? '--%' : `${Math.round(numValue)}%`;
        visual.className = 'entity sensor humidity';
        visual.isValue = true;
      } else if (deviceClass === 'battery') {
        visual.text = isNaN(numValue) ? '🔋' : `${Math.round(numValue)}%`;
        visual.className = `entity sensor battery ${numValue < 20 ? 'low' : ''}`;
        visual.isValue = true;
      } else {
        visual.text = '📊';
        visual.className = 'entity sensor';
      }
      break;

    case 'climate':
      const temp = state?.attributes?.current_temperature;
      visual.text = temp ? `${Math.round(temp)}°` : '🌡';
      visual.className = `entity climate ${stateValue !== 'off' ? 'is-on' : 'is-off'}`;
      visual.isValue = !!temp;
      break;

    case 'media_player':
      visual.text = '📺';
      const isPlaying = stateValue === 'playing';
      visual.className = `entity media-player ${isPlaying ? 'is-playing' : isOn ? 'is-on' : 'is-off'}`;
      break;

    case 'camera':
      visual.text = '📷';
      visual.className = `entity camera ${stateValue !== 'unavailable' ? 'is-on' : 'is-off'}`;
      break;

    case 'cover':
      const isOpen = stateValue === 'open';
      visual.text = isOpen ? '🚪' : '▭';
      visual.className = `entity cover ${isOpen ? 'is-open' : 'is-closed'}`;
      break;

    case 'lock':
      visual.text = stateValue === 'locked' ? '🔒' : '🔓';
      visual.className = `entity lock ${stateValue === 'locked' ? 'is-locked' : 'is-unlocked'}`;
      break;

    case 'person':
      visual.text = '👤';
      visual.className = `entity person ${isOn ? 'is-home' : 'is-away'}`;
      visual.visible = isOn;
      break;

    case 'vacuum':
      visual.text = '🤖';
      const isCleaning = stateValue === 'cleaning';
      visual.className = `entity vacuum ${isCleaning ? 'is-cleaning' : 'is-off'}`;
      break;

    default:
      visual.text = '●';
      visual.className = `entity ${isOn ? 'is-on' : 'is-off'}`;
  }

  visual.title = `${state?.attributes?.friendly_name || entityId}\n${stateValue}`;
  return visual;
}

export default function HouseView({ onRoomClick, areas }) {
  const [roomStates, setRoomStates] = useState({});
  const [placements, setPlacements] = useState({});
  const [entityStates, setEntityStates] = useState({});
  const [scale, setScale] = useState(1);
  const [popup, setPopup] = useState(null); // { entityId, x, y, type }
  const svgRef = useRef(null);
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);

  // Load placements from localStorage
  useEffect(() => {
    function loadPlacements() {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setPlacements(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to load placements:', e);
        }
      }
    }

    loadPlacements();
    const interval = setInterval(loadPlacements, 2000);
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY) loadPlacements();
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Calculate scale for icon sizing
  useEffect(() => {
    const updateScale = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const scaleX = rect.width / VIEWBOX_WIDTH;
        const scaleY = rect.height / VIEWBOX_HEIGHT;
        setScale(Math.min(scaleX, scaleY));
      }
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    if (svgRef.current) observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, []);

  // Load entity states
  useEffect(() => {
    loadStates();
    const interval = setInterval(loadStates, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  async function loadStates() {
    try {
      const states = await getStates();
      const stateMap = Object.fromEntries(states.map((s) => [s.entity_id, s]));
      setEntityStates(stateMap);

      // Calculate room states for background colors
      const newRoomStates = {};
      for (const room of ROOMS) {
        try {
          const entities = await getDevicesByArea(room.id);
          const lights = entities.filter((e) => e.startsWith("light."));
          const activeLights = lights.filter((e) => stateMap[e]?.state === "on");
          newRoomStates[room.id] = {
            hasLights: lights.length > 0,
            lightsOn: activeLights.length,
          };
        } catch {
          newRoomStates[room.id] = { hasLights: false, lightsOn: 0 };
        }
      }
      setRoomStates(newRoomStates);
    } catch (err) {
      console.error("Failed to load states:", err);
    }
  }

  function getRoomColor(room) {
    const state = roomStates[room.id];
    if (!state || !state.hasLights) return "rgba(100, 100, 120, 0.4)";
    if (state.lightsOn > 0) return "rgba(250, 204, 21, 0.4)";
    return "rgba(60, 60, 80, 0.6)";
  }

  function handleRoomClick(room) {
    const area = areas.find((a) => a.id === room.id);
    if (area) {
      onRoomClick(area.id, area.name);
    }
  }

  function handleEntityClick(entityId, e) {
    e.stopPropagation();
    e.preventDefault();

    // If long press triggered the popup, don't toggle
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }

    const domain = entityId.split('.')[0];
    // Single click = toggle
    handleDirectToggle(entityId, domain);
  }

  function handleEntityLongPress(entityId, e) {
    const domain = entityId.split('.')[0];

    // Only show popup for lights and fans
    if (domain !== 'light' && domain !== 'fan') return;

    const containerRect = svgRef.current.parentElement.getBoundingClientRect();
    const x = e.clientX - containerRect.left;
    const y = e.clientY - containerRect.top;

    longPressTriggered.current = true;
    setPopup({ entityId, type: domain, x, y });
  }

  function handlePointerDown(entityId, e) {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      handleEntityLongPress(entityId, e);
    }, 500); // 500ms for long press
  }

  function handlePointerUp() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleContextMenu(entityId, e) {
    e.preventDefault();
    handleEntityLongPress(entityId, e);
  }

  async function handleDirectToggle(entityId, domain) {
    try {
      if (domain === 'lock') {
        const state = entityStates[entityId];
        if (state?.state === 'locked') {
          await callService('lock', 'unlock', { entity_id: entityId });
        } else {
          await callService('lock', 'lock', { entity_id: entityId });
        }
      } else if (domain === 'cover') {
        const state = entityStates[entityId];
        if (state?.state === 'open') {
          await callService('cover', 'close_cover', { entity_id: entityId });
        } else {
          await callService('cover', 'open_cover', { entity_id: entityId });
        }
      } else if (domain === 'media_player') {
        const state = entityStates[entityId];
        if (state?.state === 'playing') {
          await callService('media_player', 'media_pause', { entity_id: entityId });
        } else {
          await callService('media_player', 'media_play', { entity_id: entityId });
        }
      } else if (domain === 'scene' || domain === 'script') {
        await callService(domain, 'turn_on', { entity_id: entityId });
      } else {
        await toggleEntity(entityId);
      }
      setTimeout(loadStates, 500);
    } catch (err) {
      console.error('Failed to control entity:', err);
    }
  }

  function closePopup() {
    setPopup(null);
  }

  const iconSize = ICON_SIZE_PX / scale;
  const valueSize = (ICON_SIZE_PX * 0.7) / scale;

  return (
    <div className="house-view" style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className="house-svg" ref={svgRef} style={{ pointerEvents: 'all' }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-green">
            <feGaussianBlur stdDeviation="0.8" result="coloredBlur" />
            <feFlood floodColor="#4ade80" result="color" />
            <feComposite in="color" in2="coloredBlur" operator="in" result="shadow" />
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Floor plan background image */}
        <image
          href={FLOOR_PLAN_IMAGE}
          x="0"
          y="0"
          width={VIEWBOX_WIDTH}
          height={VIEWBOX_HEIGHT}
          preserveAspectRatio="xMidYMid slice"
        />

        {/* Placed entity icons */}
        {Object.entries(placements).map(([entityId, pos]) => {
          const state = entityStates[entityId];
          const visual = getEntityVisual(entityId, state);
          const controllable = isControllable(entityId);

          if (!visual.visible) return null;

          return (
            <g
              key={entityId}
              className={`${visual.className} ${controllable ? 'clickable' : ''}`}
              transform={`translate(${pos.x}, ${pos.y})`}
              onClick={controllable ? (e) => handleEntityClick(entityId, e) : undefined}
              onPointerDown={controllable ? (e) => handlePointerDown(entityId, e) : undefined}
              onPointerUp={controllable ? handlePointerUp : undefined}
              onPointerLeave={controllable ? handlePointerUp : undefined}
              onContextMenu={controllable ? (e) => handleContextMenu(entityId, e) : undefined}
              style={{ cursor: controllable ? 'pointer' : 'default', pointerEvents: controllable ? 'all' : 'none' }}
            >
              <title>{visual.title}{controllable ? '\n(click to toggle, hold for controls)' : ''}</title>
              {/* Hit area for clicking */}
              <circle
                r={Math.max(iconSize * 1.0, 5)}
                className={controllable ? 'clickable-area' : ''}
                style={{ pointerEvents: 'all' }}
              />
              {visual.isValue ? (
                // Render as badge for values
                <>
                  <rect
                    x={-iconSize * 0.8}
                    y={-iconSize * 0.4}
                    width={iconSize * 1.6}
                    height={iconSize * 0.8}
                    rx={iconSize * 0.15}
                    className="value-bg"
                    style={{ pointerEvents: 'none' }}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={valueSize}
                    className="value-text"
                    style={{ pointerEvents: 'none' }}
                  >
                    {visual.text}
                  </text>
                </>
              ) : (
                // Render as icon
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={iconSize}
                  className="icon"
                  style={{ pointerEvents: 'none' }}
                >
                  {visual.text}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Control popup for lights and fans */}
      {popup && (
        <EntityPopover
          entityId={popup.entityId}
          type={popup.type}
          state={entityStates[popup.entityId]}
          position={{ x: popup.x, y: popup.y }}
          onClose={closePopup}
          onStateChange={loadStates}
        />
      )}
    </div>
  );
}
