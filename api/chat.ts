export const config = {
  runtime: 'edge',
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface HomeData {
  entities: Record<string, Array<{
    id: string;
    name: string;
    state: string;
    attributes?: Record<string, unknown>;
  }>>;
  automations: Array<{
    id: string;
    name: string;
    state: string;
    last_triggered?: string;
    mode?: string;
  }>;
  scripts: Array<{
    id: string;
    name: string;
    state: string;
    last_triggered?: string;
  }>;
  scenes: Array<{
    id: string;
    name: string;
  }>;
  areas: string[];
  services: Record<string, string[]>;
  config: {
    location_name?: string;
    time_zone?: string;
    version?: string;
    unit_system?: Record<string, string>;
  };
  recentActivity: Array<{
    entity: string;
    name: string;
    message: string;
    time: string;
    triggered_by?: string;
    context_name?: string;
  }>;
  summary: {
    totalEntities: number;
    lights: number;
    lightsOn: number;
    switches: number;
    switchesOn: number;
    sensors: number;
    binarySensors: number;
    automationsEnabled: number;
    automationsTotal: number;
    scriptsTotal: number;
    scenesTotal: number;
    areasTotal: number;
  };
}

function buildHomeContext(homeData: HomeData): string {
  if (!homeData) return 'No home data available.';

  let context = `# HOME ASSISTANT COMPLETE DATA\n\n`;

  // System config
  if (homeData.config) {
    context += `## System\n`;
    context += `- Home: ${homeData.config.location_name || 'Unknown'}\n`;
    context += `- HA Version: ${homeData.config.version || 'Unknown'}\n`;
    context += `- Timezone: ${homeData.config.time_zone || 'Unknown'}\n`;
    context += `- Units: ${homeData.config.unit_system?.temperature || 'Unknown'}\n\n`;
  }

  // Summary
  context += `## Summary\n`;
  context += `- Total entities: ${homeData.summary.totalEntities}\n`;
  context += `- Areas: ${homeData.summary.areasTotal} (${homeData.areas?.join(', ') || 'none'})\n`;
  context += `- Lights: ${homeData.summary.lightsOn}/${homeData.summary.lights} on\n`;
  context += `- Switches: ${homeData.summary.switchesOn}/${homeData.summary.switches} on\n`;
  context += `- Sensors: ${homeData.summary.sensors} | Binary sensors: ${homeData.summary.binarySensors}\n`;
  context += `- Automations: ${homeData.summary.automationsEnabled}/${homeData.summary.automationsTotal} enabled\n`;
  context += `- Scripts: ${homeData.summary.scriptsTotal} | Scenes: ${homeData.summary.scenesTotal}\n\n`;

  // All entities by domain
  context += `## All Entities by Domain\n\n`;
  for (const [domain, entities] of Object.entries(homeData.entities)) {
    if (entities.length === 0) continue;
    context += `### ${domain} (${entities.length})\n`;
    for (const e of entities) {
      let line = `- ${e.id}: "${e.name}" = ${e.state}`;
      if (e.attributes) {
        const attrs: string[] = [];
        if (e.attributes.device_class) attrs.push(`class:${e.attributes.device_class}`);
        if (e.attributes.unit_of_measurement) attrs.push(`${e.attributes.unit_of_measurement}`);
        if (e.attributes.brightness !== undefined) attrs.push(`bright:${Math.round((e.attributes.brightness as number)/2.55)}%`);
        if (e.attributes.hvac_action) attrs.push(`hvac:${e.attributes.hvac_action}`);
        if (e.attributes.current_temperature !== undefined) attrs.push(`curr:${e.attributes.current_temperature}°`);
        if (e.attributes.target_temp_high !== undefined) attrs.push(`target:${e.attributes.target_temp_high}°`);
        if (attrs.length > 0) line += ` (${attrs.join(', ')})`;
      }
      context += line + '\n';
    }
    context += '\n';
  }

  // Automations with details
  context += `## Automations\n`;
  for (const a of homeData.automations || []) {
    context += `- ${a.id}: "${a.name}" [${a.state}] mode:${a.mode || 'single'}`;
    if (a.last_triggered) context += ` last:${a.last_triggered}`;
    context += '\n';
  }
  context += '\n';

  // Scripts
  if (homeData.scripts?.length) {
    context += `## Scripts\n`;
    for (const s of homeData.scripts) {
      context += `- ${s.id}: "${s.name}" [${s.state}]`;
      if (s.last_triggered) context += ` last:${s.last_triggered}`;
      context += '\n';
    }
    context += '\n';
  }

  // Scenes
  if (homeData.scenes?.length) {
    context += `## Scenes\n`;
    for (const s of homeData.scenes) {
      context += `- ${s.id}: "${s.name}"\n`;
    }
    context += '\n';
  }

  // Available services by domain
  if (homeData.services && Object.keys(homeData.services).length) {
    context += `## Available Services (actions you can call)\n`;
    for (const [domain, svcs] of Object.entries(homeData.services)) {
      if (svcs.length) {
        context += `- ${domain}: ${svcs.join(', ')}\n`;
      }
    }
    context += '\n';
  }

  // Recent activity with trigger chain
  context += `## Recent Activity (last 48h, showing 100 events)\n`;
  for (const activity of (homeData.recentActivity || []).slice(0, 100)) {
    const time = activity.time ? new Date(activity.time).toLocaleString() : '';
    context += `- [${time}] ${activity.entity} "${activity.name}": ${activity.message}`;
    if (activity.triggered_by) {
      context += ` ← triggered by: ${activity.triggered_by}`;
      if (activity.context_name) context += ` ("${activity.context_name}")`;
    }
    context += '\n';
  }

  return context;
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({
      error: 'Anthropic API key not configured'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { messages, homeData } = await request.json();

    const homeContext = buildHomeContext(homeData);

    // Build comprehensive system prompt
    const systemPrompt = `You are an expert Home Assistant AI with COMPLETE, OMNISCIENT knowledge of this smart home. You have access to EVERYTHING.

${homeContext}

## What You Know
- EVERY entity (${homeData?.summary?.totalEntities || 0} total) with current states and attributes
- ALL ${homeData?.summary?.automationsTotal || 0} automations with enabled/disabled status and last trigger times
- ALL ${homeData?.summary?.scriptsTotal || 0} scripts and ${homeData?.summary?.scenesTotal || 0} scenes
- All ${homeData?.summary?.areasTotal || 0} areas/rooms in the house
- ALL available services (actions) for every domain
- 48 hours of activity history with TRIGGER CHAINS (which automation triggered which entity)
- System config (HA version, timezone, units)

## How to Answer Questions
- "What controls X?" → Search the activity log for triggered_by references to find the automation
- "What's on?" → List entities with state="on" from the relevant domain
- "What happened?" → Summarize recent activity chronologically
- "What automations do I have for X?" → Search automation names and match to entities
- "Suggest an automation" → Analyze activity patterns and propose based on usage

## Response Style
- BE EXTREMELY BRIEF. 1-3 sentences max for simple questions.
- No headers, no bullet points unless listing multiple items
- No explanations of your process - just answer
- No "Additional info" or "Key differences" sections
- Example good answer: "switch.garage_light_timer is controlled by automation.garage_light_schedule (last ran 2pm). Currently off."
- Example bad answer: Long formatted response with headers and sections

KEEP IT SHORT. Users want quick answers, not reports.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        system: systemPrompt,
        messages: messages.map((m: Message) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();
    const assistantMessage = data.content[0]?.text || 'No response';

    return new Response(JSON.stringify({
      message: assistantMessage,
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to get response',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
