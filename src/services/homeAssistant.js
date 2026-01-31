// Use local proxy in dev, Vercel serverless proxy in production
const IS_DEV = import.meta.env.DEV;

function getApiUrl(path) {
  if (IS_DEV) {
    return `/ha-api/${path}`;
  }
  return `/api/ha?path=${encodeURIComponent(path)}`;
}

const headers = {
  "Content-Type": "application/json",
  // Token only needed in dev (production uses server-side env var)
  ...(IS_DEV && import.meta.env.VITE_HA_TOKEN
    ? { Authorization: `Bearer ${import.meta.env.VITE_HA_TOKEN}` }
    : {}),
};

export async function getAreas() {
  const response = await fetch(getApiUrl("template"), {
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
  const response = await fetch(getApiUrl("template"), {
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
  const response = await fetch(getApiUrl("template"), {
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
  const response = await fetch(getApiUrl("states"), { headers });
  const states = await response.json();
  console.log(`Got ${states.length} states`);
  return states;
}

export async function getState(entityId) {
  const response = await fetch(getApiUrl(`states/${entityId}`), { headers });
  return response.json();
}

export async function callService(domain, service, data = {}) {
  const response = await fetch(getApiUrl(`services/${domain}/${service}`), {
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

export async function getHistory(entityIds = [], hoursBack = 24) {
  const endTime = new Date().toISOString();
  const startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  let path = `history/period/${startTime}?end_time=${encodeURIComponent(endTime)}&minimal_response`;
  if (entityIds.length > 0) {
    path += `&filter_entity_id=${entityIds.join(',')}`;
  }

  const response = await fetch(getApiUrl(path), { headers });
  return response.json();
}

export async function getLogbook(hoursBack = 24) {
  const endTime = new Date().toISOString();
  const startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  const path = `logbook/${startTime}?end_time=${encodeURIComponent(endTime)}`;
  const response = await fetch(getApiUrl(path), { headers });
  return response.json();
}

export async function getEntityHistory(entityId, hoursBack = 24) {
  const endTime = new Date().toISOString();
  const startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  const path = `history/period/${startTime}?end_time=${encodeURIComponent(endTime)}&filter_entity_id=${entityId}&minimal_response&no_attributes`;
  const response = await fetch(getApiUrl(path), { headers });
  const data = await response.json();
  return data[0] || [];
}
