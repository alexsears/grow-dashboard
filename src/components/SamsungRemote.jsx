import { useState, useEffect } from "react";
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
  const [tvState, setTvState] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTVState();
    const interval = setInterval(fetchTVState, 5000);
    return () => clearInterval(interval);
  }, [selectedTV]);

  async function fetchTVState() {
    try {
      const res = await fetch(`/api/ha?path=states/${selectedTV.media}`);
      const data = await res.json();
      setTvState(data);
    } catch (err) {
      console.error("Failed to fetch TV state:", err);
    }
  }

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
      setTimeout(fetchTVState, 500);
    } catch (err) {
      console.error("Failed to send command:", err);
    }
    setLoading(false);
  }

  const isOn = tvState?.state === "on" || tvState?.state === "playing" || tvState?.state === "paused";
  const attrs = tvState?.attributes || {};

  return (
    <div className="remote-page">
      {/* TV Screen Preview */}
      <div className="tv-screen-section">
        <select
          className="tv-selector"
          value={selectedTV.id}
          onChange={(e) => setSelectedTV(TV_OPTIONS.find(t => t.id === e.target.value))}
        >
          {TV_OPTIONS.map(tv => (
            <option key={tv.id} value={tv.id}>{tv.name}</option>
          ))}
        </select>

        <div className={`tv-screen ${isOn ? "on" : "off"}`}>
          {isOn ? (
            <>
              {attrs.entity_picture && (
                <img src={attrs.entity_picture} alt="" className="tv-thumbnail" />
              )}
              <div className="tv-info">
                {attrs.app_name && <div className="tv-app">{attrs.app_name}</div>}
                {attrs.source && <div className="tv-source">{attrs.source}</div>}
                {attrs.media_title && <div className="tv-title">{attrs.media_title}</div>}
                {attrs.media_artist && <div className="tv-artist">{attrs.media_artist}</div>}
                {!attrs.app_name && !attrs.media_title && !attrs.source && (
                  <div className="tv-status">TV is on</div>
                )}
              </div>
              {attrs.volume_level !== undefined && (
                <div className="tv-volume">
                  🔊 {Math.round(attrs.volume_level * 100)}%
                  {attrs.is_volume_muted && " (muted)"}
                </div>
              )}
            </>
          ) : (
            <div className="tv-off-message">
              <div className="tv-off-icon">📺</div>
              <div>{tvState?.state === "unavailable" ? "Unavailable" : "TV is off"}</div>
            </div>
          )}
        </div>
      </div>

      {/* Physical Remote */}
      <div className="physical-remote">
        {/* Power & Mic */}
        <div className="remote-section top-buttons">
          <button className="rbtn power" onClick={() => sendCommand("KEY_POWER")} disabled={loading}>
            <svg viewBox="0 0 24 24"><path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/></svg>
          </button>
          <button className="rbtn mic" onClick={() => sendCommand("KEY_VOICE")} disabled={loading}>
            <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
          </button>
        </div>

        {/* Utility Row */}
        <div className="remote-section utility-row">
          <button className="rbtn small" onClick={() => sendCommand("KEY_123")} disabled={loading}>123</button>
          <button className="rbtn small" onClick={() => sendCommand("KEY_MORE")} disabled={loading}>•••</button>
        </div>

        {/* Color Dots */}
        <div className="remote-section color-dots">
          <span className="dot red" onClick={() => sendCommand("KEY_RED")}></span>
          <span className="dot green" onClick={() => sendCommand("KEY_GREEN")}></span>
          <span className="dot yellow" onClick={() => sendCommand("KEY_YELLOW")}></span>
          <span className="dot blue" onClick={() => sendCommand("KEY_BLUE")}></span>
        </div>

        {/* Navigation Ring */}
        <div className="nav-ring">
          <button className="nav-arrow up" onClick={() => sendCommand("KEY_UP")} disabled={loading}>
            <svg viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
          </button>
          <button className="nav-arrow left" onClick={() => sendCommand("KEY_LEFT")} disabled={loading}>
            <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          </button>
          <button className="nav-center" onClick={() => sendCommand("KEY_ENTER")} disabled={loading}></button>
          <button className="nav-arrow right" onClick={() => sendCommand("KEY_RIGHT")} disabled={loading}>
            <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </button>
          <button className="nav-arrow down" onClick={() => sendCommand("KEY_DOWN")} disabled={loading}>
            <svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
          </button>
        </div>

        {/* Back, Home, Play */}
        <div className="remote-section control-row">
          <button className="rbtn" onClick={() => sendCommand("KEY_RETURN")} disabled={loading}>
            <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          </button>
          <button className="rbtn" onClick={() => sendCommand("KEY_HOME")} disabled={loading}>
            <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          </button>
          <button className="rbtn" onClick={() => sendCommand("KEY_PLAY")} disabled={loading}>
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>

        {/* Volume & Channel Rockers */}
        <div className="remote-section rocker-row">
          <div className="rocker">
            <button className="rocker-btn top" onClick={() => sendCommand("KEY_VOLUP")} disabled={loading}>+</button>
            <div className="rocker-label">VOL</div>
            <button className="rocker-btn bottom" onClick={() => sendCommand("KEY_VOLDOWN")} disabled={loading}>−</button>
          </div>
          <div className="rocker">
            <button className="rocker-btn top" onClick={() => sendCommand("KEY_CHUP")} disabled={loading}>∧</button>
            <div className="rocker-label">CH</div>
            <button className="rocker-btn bottom" onClick={() => sendCommand("KEY_CHDOWN")} disabled={loading}>∨</button>
          </div>
        </div>

        {/* App Buttons */}
        <div className="remote-section app-row">
          <button className="app-btn netflix" onClick={() => sendCommand("KEY_NETFLIX")} disabled={loading}>
            NETFLIX
          </button>
          <button className="app-btn prime" onClick={() => sendCommand("KEY_AMAZON")} disabled={loading}>
            prime video
          </button>
        </div>
      </div>
    </div>
  );
}
