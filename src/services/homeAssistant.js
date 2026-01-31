// Use proxy in dev, direct URL in production
const HA_URL = import.meta.env.DEV ? '' : import.meta.env.VITE_HA_URL;
const API_PATH = import.meta.env.DEV ? '/ha-api' : '/api';
const HA_TOKEN = import.meta.env.VITE_HA_TOKEN;

const headers = {
  Authorization: `Bearer ${HA_TOKEN}`,
  "Content-Type": "application/json",
};

export async function getAreas() {
  const response = await fetch(`${HA_URL}${API_PATH}/template`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      template: "{{ areas() | list | tojson }}",
    }),
  });
  const text = await response.text();
  return JSON.parse(text);
}

export async function getAreaDetails(areaId) {
  const response = await fetch(`${HA_URL}${API_PATH}/template`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      template: `{{ area_name('${areaId}') }}`,
    }),
  });
  return response.text();
}

export async function getDevicesByArea(areaId) {
  console.log(`Fetching devices for area: ${areaId}`);
  const response = await fetch(`${HA_URL}${API_PATH}/template`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      template: `{{ area_entities('${areaId}') | list | tojson }}`,
    }),
  });
  const text = await response.text();
  console.log(`Got ${text.length} chars for ${areaId}`);
  const parsed = JSON.parse(text);
  console.log(`Parsed ${parsed.length} entities for ${areaId}`, parsed.slice(0, 5));
  return parsed;
}

export async function getStates() {
  console.log("Fetching all states...");
  const response = await fetch(`${HA_URL}${API_PATH}/states`, { headers });
  const states = await response.json();
  console.log(`Got ${states.length} states`);
  return states;
}

export async function getState(entityId) {
  const response = await fetch(`${HA_URL}${API_PATH}/states/${entityId}`, { headers });
  return response.json();
}

export async function callService(domain, service, data = {}) {
  const response = await fetch(`${HA_URL}${API_PATH}/services/${domain}/${service}`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function toggleEntity(entityId) {
  const domain = entityId.split(".")[0];
  return callService(domain, "toggle", { entity_id: entityId });
}

export async function turnOn(entityId, data = {}) {
  const domain = entityId.split(".")[0];
  return callService(domain, "turn_on", { entity_id: entityId, ...data });
}

export async function turnOff(entityId) {
  const domain = entityId.split(".")[0];
  return callService(domain, "turn_off", { entity_id: entityId });
}

export async function setLightBrightness(entityId, brightness) {
  return callService("light", "turn_on", {
    entity_id: entityId,
    brightness: Math.round(brightness * 2.55), // Convert 0-100 to 0-255
  });
}

export async function setClimateTemperature(entityId, temperature) {
  return callService("climate", "set_temperature", {
    entity_id: entityId,
    temperature,
  });
}
