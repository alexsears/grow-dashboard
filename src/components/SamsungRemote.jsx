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

  async function mediaCommand(service, data = {}) {
    setLoading(true);
    try {
      await fetch(`/api/ha?path=services/media_player/${service}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_id: selectedTV.media,
          ...data,
        }),
      });
    } catch (err) {
      console.error("Failed to send media command:", err);
    }
    setLoading(false);
  }

  return (
    <div className="remote-container">
      <div className="remote">
        {/* TV Selector */}
        <div className="tv-selector">
          <select
            value={selectedTV.id}
            onChange={(e) => setSelectedTV(TV_OPTIONS.find(t => t.id === e.target.value))}
          >
            {TV_OPTIONS.map(tv => (
              <option key={tv.id} value={tv.id}>{tv.name}</option>
            ))}
          </select>
        </div>

        {/* Top Section - Power & Mic */}
        <div className="remote-top">
          <button className="btn power" onClick={() => sendCommand("KEY_POWER")} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/></svg>
          </button>
          <button className="btn mic" onClick={() => sendCommand("KEY_VOICE")} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
          </button>
        </div>

        {/* Utility Buttons */}
        <div className="remote-utility">
          <button className="btn small" onClick={() => sendCommand("KEY_123")} disabled={loading}>123</button>
          <button className="btn small" onClick={() => sendCommand("KEY_EXTRA")} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>
          </button>
        </div>

        {/* Color Dots */}
        <div className="remote-colors">
          <span className="color-dot red" onClick={() => sendCommand("KEY_RED")}></span>
          <span className="color-dot green" onClick={() => sendCommand("KEY_GREEN")}></span>
          <span className="color-dot yellow" onClick={() => sendCommand("KEY_YELLOW")}></span>
          <span className="color-dot blue" onClick={() => sendCommand("KEY_BLUE")}></span>
        </div>

        {/* Navigation Pad */}
        <div className="nav-pad">
          <button className="nav-btn up" onClick={() => sendCommand("KEY_UP")} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
          </button>
          <button className="nav-btn left" onClick={() => sendCommand("KEY_LEFT")} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          </button>
          <button className="nav-btn center" onClick={() => sendCommand("KEY_ENTER")} disabled={loading}>OK</button>
          <button className="nav-btn right" onClick={() => sendCommand("KEY_RIGHT")} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </button>
          <button className="nav-btn down" onClick={() => sendCommand("KEY_DOWN")} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
          </button>
        </div>

        {/* Control Buttons */}
        <div className="remote-controls">
          <button className="btn control" onClick={() => sendCommand("KEY_RETURN")} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          </button>
          <button className="btn control" onClick={() => sendCommand("KEY_HOME")} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          </button>
          <button className="btn control" onClick={() => sendCommand("KEY_PLAY")} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>

        {/* Volume & Channel */}
        <div className="remote-vol-ch">
          <div className="vol-group">
            <button className="btn vol" onClick={() => sendCommand("KEY_VOLUP")} disabled={loading}>+</button>
            <span className="label">VOL</span>
            <button className="btn vol" onClick={() => sendCommand("KEY_VOLDOWN")} disabled={loading}>−</button>
          </div>
          <div className="ch-group">
            <button className="btn ch" onClick={() => sendCommand("KEY_CHUP")} disabled={loading}>∧</button>
            <span className="label">CH</span>
            <button className="btn ch" onClick={() => sendCommand("KEY_CHDOWN")} disabled={loading}>∨</button>
          </div>
        </div>

        {/* App Buttons */}
        <div className="remote-apps">
          <button className="btn app netflix" onClick={() => sendCommand("KEY_NETFLIX")} disabled={loading}>
            NETFLIX
          </button>
          <button className="btn app prime" onClick={() => sendCommand("KEY_AMAZON")} disabled={loading}>
            prime
          </button>
        </div>

        {/* More Apps */}
        <div className="remote-apps">
          <button className="btn app" onClick={() => sendCommand("KEY_YOUTUBE")} disabled={loading}>
            YouTube
          </button>
          <button className="btn app" onClick={() => sendCommand("KEY_DISNEY")} disabled={loading}>
            Disney+
          </button>
        </div>
      </div>
    </div>
  );
}
