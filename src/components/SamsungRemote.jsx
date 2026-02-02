import { useState } from "react";
import "./SamsungRemote.css";

const TV_OPTIONS = [
  { id: "living_room", name: "Living Room", remote: "remote.living_room_tv", media: "media_player.living_room_tv" },
  { id: "frame", name: "Frame", remote: "remote.samsung_the_frame_43", media: "media_player.samsung_the_frame_43" },
  { id: "bedroom", name: "Bedroom", remote: "remote.samsung_7_series_55", media: "media_player.samsung_7_series_55" },
  { id: "sean", name: "Sean", remote: "remote.sean_tv", media: "media_player.sean_tv" },
  { id: "guest", name: "Guest", remote: "remote.guest_tv", media: "media_player.guest_tv" },
];

export default function SamsungRemote() {
  const [selectedTV, setSelectedTV] = useState(TV_OPTIONS[0]);
  const [loading, setLoading] = useState(false);

  async function sendCommand(command) {
    setLoading(true);
    try {
      await fetch("/api/ha?path=services/remote/send_command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_id: selectedTV.remote,
          command: command,
        }),
      });
    } catch (err) {
      console.error("Failed to send command:", err);
    }
    setLoading(false);
  }

  async function mediaCommand(service) {
    setLoading(true);
    try {
      await fetch(`/api/ha?path=services/media_player/${service}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_id: selectedTV.media,
        }),
      });
    } catch (err) {
      console.error("Failed to send media command:", err);
    }
    setLoading(false);
  }

  return (
    <div className="remote-container">
      <div className="remote-panel">
        {/* Top Row - TV Selector and Main Buttons */}
        <div className="remote-row top-row">
          <div className="tv-select-wrapper">
            <label>TV</label>
            <select
              value={selectedTV.id}
              onChange={(e) => setSelectedTV(TV_OPTIONS.find(t => t.id === e.target.value))}
            >
              {TV_OPTIONS.map(tv => (
                <option key={tv.id} value={tv.id}>{tv.name}</option>
              ))}
            </select>
          </div>
          <button className="btn power" onClick={() => sendCommand("KEY_POWER")} disabled={loading}>
            <svg viewBox="0 0 24 24"><path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/></svg>
            <span>Power</span>
          </button>
          <button className="btn" onClick={() => sendCommand("KEY_SOURCE")} disabled={loading}>
            <svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9 8h2v8H9zm4 0h2v8h-2z"/></svg>
            <span>Source</span>
          </button>
          <button className="btn" onClick={() => sendCommand("KEY_MENU")} disabled={loading}>
            <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
            <span>Settings</span>
          </button>
          <button className="btn" onClick={() => sendCommand("KEY_RETURN")} disabled={loading}>
            <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            <span>Back</span>
          </button>
          <button className="btn" onClick={() => sendCommand("KEY_EXIT")} disabled={loading}>
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            <span>Exit</span>
          </button>
          <button className="btn" onClick={() => sendCommand("KEY_INFO")} disabled={loading}>
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
            <span>Info</span>
          </button>
        </div>

        {/* Color Buttons */}
        <div className="remote-row color-row">
          <button className="btn color red" onClick={() => sendCommand("KEY_RED")} disabled={loading}>R</button>
          <button className="btn color green" onClick={() => sendCommand("KEY_GREEN")} disabled={loading}>G</button>
          <button className="btn color yellow" onClick={() => sendCommand("KEY_YELLOW")} disabled={loading}>Y</button>
          <button className="btn color blue" onClick={() => sendCommand("KEY_BLUE")} disabled={loading}>B</button>
        </div>

        {/* Main Control Area */}
        <div className="remote-row main-controls">
          {/* Navigation Pad */}
          <div className="nav-section">
            <div className="nav-pad">
              <button className="nav-btn up" onClick={() => sendCommand("KEY_UP")} disabled={loading}>
                <svg viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
              </button>
              <button className="nav-btn left" onClick={() => sendCommand("KEY_LEFT")} disabled={loading}>
                <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
              </button>
              <button className="nav-btn ok" onClick={() => sendCommand("KEY_ENTER")} disabled={loading}>OK</button>
              <button className="nav-btn right" onClick={() => sendCommand("KEY_RIGHT")} disabled={loading}>
                <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
              </button>
              <button className="nav-btn down" onClick={() => sendCommand("KEY_DOWN")} disabled={loading}>
                <svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
              </button>
            </div>

            {/* Below Nav */}
            <div className="nav-extra">
              <button className="btn" onClick={() => sendCommand("KEY_RETURN")} disabled={loading}>
                <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
              </button>
              <button className="btn" onClick={() => sendCommand("KEY_HOME")} disabled={loading}>
                <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                <span>Home</span>
              </button>
              <button className="btn" onClick={() => sendCommand("KEY_DOWN")} disabled={loading}>
                <svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
              </button>
            </div>
          </div>

          {/* Volume/Mute/Channel */}
          <div className="vol-ch-section">
            <button className="btn" onClick={() => sendCommand("KEY_VOLUP")} disabled={loading}>
              <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
              <span>Vol+</span>
            </button>
            <button className="btn" onClick={() => sendCommand("KEY_MUTE")} disabled={loading}>
              <svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
              <span>Mute</span>
            </button>
            <button className="btn" onClick={() => sendCommand("KEY_CHUP")} disabled={loading}>
              <svg viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
              <span>Ch+</span>
            </button>
            <button className="btn" onClick={() => sendCommand("KEY_VOLDOWN")} disabled={loading}>
              <svg viewBox="0 0 24 24"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>
              <span>Vol-</span>
            </button>
            <button className="btn" onClick={() => sendCommand("KEY_PLAY")} disabled={loading}>
              <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/><path d="M8 5v14l11-7z"/></svg>
              <span>Play/Pause</span>
            </button>
            <button className="btn" onClick={() => sendCommand("KEY_CHDOWN")} disabled={loading}>
              <svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
              <span>Ch-</span>
            </button>
          </div>
        </div>

        {/* Media Controls */}
        <div className="remote-row media-row">
          <button className="btn media" onClick={() => sendCommand("KEY_REWIND")} disabled={loading}>
            <svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
          </button>
          <button className="btn media" onClick={() => sendCommand("KEY_PAUSE")} disabled={loading}>
            <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          </button>
          <button className="btn media" onClick={() => sendCommand("KEY_PLAY")} disabled={loading}>
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <button className="btn media" onClick={() => sendCommand("KEY_STOP")} disabled={loading}>
            <svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
          </button>
          <button className="btn media" onClick={() => sendCommand("KEY_FF")} disabled={loading}>
            <svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
          </button>
        </div>

        {/* Number Pad */}
        <div className="remote-row numpad-row">
          <div className="numpad">
            <button className="btn num" onClick={() => sendCommand("KEY_1")} disabled={loading}>1</button>
            <button className="btn num" onClick={() => sendCommand("KEY_2")} disabled={loading}>2</button>
            <button className="btn num" onClick={() => sendCommand("KEY_3")} disabled={loading}>3</button>
            <button className="btn num" onClick={() => sendCommand("KEY_4")} disabled={loading}>4</button>
            <button className="btn num" onClick={() => sendCommand("KEY_5")} disabled={loading}>5</button>
            <button className="btn num" onClick={() => sendCommand("KEY_6")} disabled={loading}>6</button>
            <button className="btn num" onClick={() => sendCommand("KEY_7")} disabled={loading}>7</button>
            <button className="btn num" onClick={() => sendCommand("KEY_8")} disabled={loading}>8</button>
            <button className="btn num" onClick={() => sendCommand("KEY_9")} disabled={loading}>9</button>
            <button className="btn num" onClick={() => sendCommand("KEY_DOT")} disabled={loading}>.</button>
            <button className="btn num" onClick={() => sendCommand("KEY_0")} disabled={loading}>0</button>
            <button className="btn num enter" onClick={() => sendCommand("KEY_ENTER")} disabled={loading}>
              <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              <span>Enter</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
