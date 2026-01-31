import { useState, useEffect, useRef } from 'react';
import { toggleEntity, callService } from '../services/homeAssistant';
import './EntityPopover.css';

export default function EntityPopover({ entityId, type, state, position, onClose, onStateChange }) {
  const popoverRef = useRef(null);
  const isOn = state?.state === 'on';

  // Local state for instant feedback
  const [brightness, setBrightness] = useState(
    Math.round((state?.attributes?.brightness || 0) / 2.55)
  );
  const [fanSpeed, setFanSpeed] = useState(
    state?.attributes?.percentage || 0
  );

  // Update local state when entity state changes
  useEffect(() => {
    if (type === 'light') {
      setBrightness(Math.round((state?.attributes?.brightness || 0) / 2.55));
    } else if (type === 'fan') {
      setFanSpeed(state?.attributes?.percentage || 0);
    }
  }, [state, type]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [onClose]);

  async function handleToggle() {
    try {
      await toggleEntity(entityId);
      setTimeout(onStateChange, 300);
    } catch (err) {
      console.error('Failed to toggle:', err);
    }
  }

  async function handleBrightnessChange(value) {
    setBrightness(value);
    try {
      if (value === 0) {
        await callService('light', 'turn_off', { entity_id: entityId });
      } else {
        await callService('light', 'turn_on', {
          entity_id: entityId,
          brightness: Math.round(value * 2.55),
        });
      }
      setTimeout(onStateChange, 300);
    } catch (err) {
      console.error('Failed to set brightness:', err);
    }
  }

  async function handleFanSpeedChange(value) {
    setFanSpeed(value);
    try {
      if (value === 0) {
        await callService('fan', 'turn_off', { entity_id: entityId });
      } else {
        await callService('fan', 'set_percentage', {
          entity_id: entityId,
          percentage: value,
        });
      }
      setTimeout(onStateChange, 300);
    } catch (err) {
      console.error('Failed to set fan speed:', err);
    }
  }

  const friendlyName = state?.attributes?.friendly_name || entityId.split('.')[1];

  return (
    <div
      ref={popoverRef}
      className="entity-popover"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="popover-header">
        <span className="popover-icon">{type === 'light' ? '💡' : '🌀'}</span>
        <span className="popover-name">{friendlyName}</span>
        <button className={`toggle-btn ${isOn ? 'on' : 'off'}`} onClick={handleToggle}>
          {isOn ? 'ON' : 'OFF'}
        </button>
      </div>

      {type === 'light' && (
        <div className="popover-control">
          <label>Brightness</label>
          <div className="slider-row">
            <input
              type="range"
              min="0"
              max="100"
              value={brightness}
              onChange={(e) => handleBrightnessChange(Number(e.target.value))}
            />
            <span className="slider-value">{brightness}%</span>
          </div>
        </div>
      )}

      {type === 'fan' && (
        <div className="popover-control">
          <label>Speed</label>
          <div className="speed-buttons">
            <button
              className={fanSpeed === 0 ? 'active' : ''}
              onClick={() => handleFanSpeedChange(0)}
            >
              Off
            </button>
            <button
              className={fanSpeed > 0 && fanSpeed <= 33 ? 'active' : ''}
              onClick={() => handleFanSpeedChange(33)}
            >
              Low
            </button>
            <button
              className={fanSpeed > 33 && fanSpeed <= 66 ? 'active' : ''}
              onClick={() => handleFanSpeedChange(66)}
            >
              Med
            </button>
            <button
              className={fanSpeed > 66 ? 'active' : ''}
              onClick={() => handleFanSpeedChange(100)}
            >
              High
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
