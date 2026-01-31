import { useState, useEffect } from "react";
import { getAreas, getAreaDetails } from "./services/homeAssistant";
import HouseView from "./components/HouseView";
import DeviceModal from "./components/DeviceModal";
import HistoryTab from "./components/HistoryTab";
import "./App.css";

export default function App() {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("home");

  useEffect(() => {
    loadAreas();
  }, []);

  async function loadAreas() {
    setLoading(true);
    setError(null);
    try {
      const areaIds = await getAreas();
      const areasWithNames = await Promise.all(
        areaIds.map(async (id) => ({
          id,
          name: await getAreaDetails(id),
        }))
      );
      setAreas(areasWithNames);
    } catch (err) {
      console.error("Failed to load areas:", err);
      setError("Failed to connect to Home Assistant");
    }
    setLoading(false);
  }

  function handleRoomClick(areaId, areaName) {
    setSelectedRoom({ id: areaId, name: areaName });
  }

  function handleCloseModal() {
    setSelectedRoom(null);
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Home</h1>
        <nav className="tabs">
          <button
            className={`tab ${activeTab === "home" ? "active" : ""}`}
            onClick={() => setActiveTab("home")}
          >
            Floor Plan
          </button>
          <button
            className={`tab ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            Activity
          </button>
        </nav>
      </header>

      <main className="main">
        {activeTab === "home" ? (
          loading ? (
            <div className="loading">Loading rooms...</div>
          ) : error ? (
            <div className="error">
              <p>{error}</p>
              <button onClick={loadAreas}>Retry</button>
            </div>
          ) : (
            <HouseView onRoomClick={handleRoomClick} areas={areas} />
          )
        ) : (
          <HistoryTab />
        )}
      </main>

      {selectedRoom && (
        <DeviceModal
          areaId={selectedRoom.id}
          areaName={selectedRoom.name}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
