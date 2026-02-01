import { useState, useEffect, useRef } from "react";
import { getStates } from "../services/homeAssistant";
import "./ChatTab.css";

export default function ChatTab() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [homeContext, setHomeContext] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load home context on mount
  useEffect(() => {
    loadHomeContext();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadHomeContext() {
    try {
      const states = await getStates();

      // Build a summary of the home state
      const lights = states.filter(s => s.entity_id.startsWith("light."));
      const lightsOn = lights.filter(s => s.state === "on").length;

      const climate = states.filter(s => s.entity_id.startsWith("climate."));
      const sensors = states.filter(s =>
        s.entity_id.startsWith("sensor.") &&
        (s.attributes?.device_class === "temperature" || s.attributes?.device_class === "humidity")
      );

      const doors = states.filter(s =>
        s.entity_id.startsWith("binary_sensor.") &&
        s.attributes?.device_class === "door" &&
        s.state === "on"
      );

      let context = `Lights: ${lightsOn}/${lights.length} on\n`;

      if (climate.length > 0) {
        context += `Climate systems: ${climate.map(c => `${c.attributes?.friendly_name || c.entity_id}: ${c.state}`).join(", ")}\n`;
      }

      if (doors.length > 0) {
        context += `Open doors: ${doors.map(d => d.attributes?.friendly_name || d.entity_id).join(", ")}\n`;
      }

      // Get a few temperature readings
      const temps = sensors
        .filter(s => s.attributes?.device_class === "temperature")
        .slice(0, 5)
        .map(s => `${s.attributes?.friendly_name || s.entity_id.split(".")[1]}: ${s.state}${s.attributes?.unit_of_measurement || "°F"}`);

      if (temps.length > 0) {
        context += `Temperatures: ${temps.join(", ")}\n`;
      }

      setHomeContext(context);
    } catch (err) {
      console.error("Failed to load home context:", err);
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: userMessage }],
          context: homeContext,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Sorry, I encountered an error: ${err.message}`
      }]);
    }

    setLoading(false);
    inputRef.current?.focus();
  }

  function clearChat() {
    setMessages([]);
    loadHomeContext(); // Refresh context
  }

  return (
    <div className="chat-tab">
      <div className="chat-header">
        <div className="chat-title">
          <span className="chat-icon">🤖</span>
          <h2>Claude</h2>
        </div>
        {messages.length > 0 && (
          <button className="clear-btn" onClick={clearChat}>
            Clear
          </button>
        )}
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="empty-icon">💬</div>
            <p>Ask me anything about your home!</p>
            <div className="suggestions">
              <button onClick={() => setInput("What lights are on?")}>
                What lights are on?
              </button>
              <button onClick={() => setInput("How can I save energy?")}>
                How can I save energy?
              </button>
              <button onClick={() => setInput("Suggest an automation")}>
                Suggest an automation
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="message-avatar">
                {msg.role === "user" ? "👤" : "🤖"}
              </div>
              <div className="message-content">
                {msg.content.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="message assistant">
            <div className="message-avatar">🤖</div>
            <div className="message-content typing">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={sendMessage}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your home..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
