import { useState, useEffect, useRef } from "react";
import { getStates, getLogbook } from "../services/homeAssistant";
import "./ChatTab.css";

export default function ChatTab() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [homeData, setHomeData] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load home context on mount
  useEffect(() => {
    loadHomeData();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadHomeData() {
    try {
      const [states, logbook] = await Promise.all([
        getStates(),
        getLogbook(24).catch(() => []),
      ]);

      // Fetch automations
      let automations = [];
      try {
        const response = await fetch("/api/ha?path=states");
        const allStates = await response.json();
        automations = allStates
          .filter(s => s.entity_id.startsWith("automation."))
          .map(a => ({
            id: a.entity_id,
            name: a.attributes?.friendly_name || a.entity_id,
            state: a.state,
            last_triggered: a.attributes?.last_triggered,
          }));
      } catch (e) {
        console.error("Failed to load automations:", e);
      }

      // Organize entities by domain
      const byDomain = {};
      states.forEach(s => {
        const domain = s.entity_id.split(".")[0];
        if (!byDomain[domain]) byDomain[domain] = [];
        byDomain[domain].push({
          id: s.entity_id,
          name: s.attributes?.friendly_name || s.entity_id.split(".")[1],
          state: s.state,
          attributes: s.attributes,
        });
      });

      // Get recent activity summary
      const recentActivity = logbook.slice(0, 50).map(e => ({
        entity: e.entity_id,
        name: e.name,
        message: e.message,
        time: e.when,
        triggered_by: e.context_entity_id,
      }));

      setHomeData({
        entities: byDomain,
        automations,
        recentActivity,
        summary: {
          totalEntities: states.length,
          lights: byDomain.light?.length || 0,
          lightsOn: byDomain.light?.filter(l => l.state === "on").length || 0,
          switches: byDomain.switch?.length || 0,
          switchesOn: byDomain.switch?.filter(s => s.state === "on").length || 0,
          automationsEnabled: automations.filter(a => a.state === "on").length,
          automationsTotal: automations.length,
        },
      });
    } catch (err) {
      console.error("Failed to load home data:", err);
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
          homeData,
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
    loadHomeData(); // Refresh data
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
            <div className="empty-icon">🏠</div>
            {!homeData ? (
              <p>Loading home data...</p>
            ) : (
              <>
                <p>I know your entire Home Assistant setup. Ask me anything!</p>
                <div className="home-stats">
                  <span>{homeData.summary.totalEntities} entities</span>
                  <span>{homeData.summary.automationsTotal} automations</span>
                </div>
                <div className="suggestions">
                  <button onClick={() => setInput("What automations control the lab lights?")}>
                    What controls the lab lights?
                  </button>
                  <button onClick={() => setInput("Show me all switches that are on")}>
                    What switches are on?
                  </button>
                  <button onClick={() => setInput("What happened in the last hour?")}>
                    Recent activity?
                  </button>
                  <button onClick={() => setInput("Suggest an automation based on my usage patterns")}>
                    Suggest automations
                  </button>
                </div>
              </>
            )}
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
