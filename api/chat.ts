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
    trigger?: unknown[];
    action?: unknown[];
    condition?: unknown[];
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

  // Automations with details and configs
  context += `## Automations (with triggers/actions)\n`;
  for (const a of homeData.automations || []) {
    context += `- ${a.id}: "${a.name}" [${a.state}]`;
    if (a.last_triggered) context += ` last:${a.last_triggered}`;
    context += '\n';
    if (a.trigger) {
      context += `  TRIGGERS: ${JSON.stringify(a.trigger)}\n`;
    }
    if (a.condition) {
      context += `  CONDITIONS: ${JSON.stringify(a.condition)}\n`;
    }
    if (a.action) {
      context += `  ACTIONS: ${JSON.stringify(a.action)}\n`;
    }
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

const HA_URL = process.env.HA_URL;
const HA_TOKEN = process.env.HA_TOKEN;

async function callHA(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(`${HA_URL}/api/${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${HA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response;
}

async function createAutomation(id: string, config: unknown) {
  const response = await callHA(`config/automation/config/${id}`, 'POST', config);
  if (!response.ok) {
    throw new Error(`Failed to create automation: ${await response.text()}`);
  }
  // Reload automations
  await callHA('services/automation/reload', 'POST', {});
  return { success: true, id };
}

async function callService(domain: string, service: string, data: unknown) {
  const response = await callHA(`services/${domain}/${service}`, 'POST', data);
  if (!response.ok) {
    throw new Error(`Failed to call ${domain}.${service}: ${await response.text()}`);
  }
  return { success: true };
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
    const systemPrompt = `You are an expert Home Assistant AI with COMPLETE, OMNISCIENT knowledge of this smart home. You can VIEW and CONTROL everything.

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

## Response Style - CRITICAL
- MAX 2 SENTENCES for simple questions
- NO apologies, NO "I can see", NO "Looking at"
- NO bullet points for single items
- Just state facts directly
- If you don't have data, say so in <10 words
- NEVER start with "You're right" or apologize

Good: "automation.garage_light_schedule controls it, last triggered 2pm."
Bad: "You're right, I apologize. Looking at the automation name..."

BE TERSE.

## Actions - YOU CAN EXECUTE THEM
You have two tools available:
- create_automation: Create new HA automations (id, alias, trigger, action, condition, mode)
- call_service: Call any HA service (domain, service, entity_id, data)

**CRITICAL: NEVER USE TOOLS ON FIRST REQUEST**
When user asks to do something, you MUST:
1. First message: Describe what you WILL do and ask "Confirm?" - DO NOT use any tools yet
2. Wait for user to say yes/confirm/do it/go ahead/push it
3. Second message: ONLY THEN use the tool

If user's message is their FIRST request for an action, respond with confirmation request ONLY - no tool use.
If user's message is confirming (yes/do it/confirm/go ahead/push it), THEN use the tool.

Example flow:
User: "Turn on kitchen light" → You: "I'll call light.turn_on on light.kitchen_main. Confirm?" (NO TOOL)
User: "yes" → You: [use call_service tool] "Done."

Example flow:
User: "Create mister automation" → You: "I'll create automation with hourly trigger, turns on switch.mister for 10s. Confirm?" (NO TOOL)
User: "do it" → You: [use create_automation tool] "Created."`;

    const tools = [
      {
        name: "create_automation",
        description: "Create a new automation in Home Assistant",
        input_schema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Unique ID for the automation (lowercase, underscores)" },
            alias: { type: "string", description: "Human-readable name" },
            trigger: { type: "array", description: "List of triggers" },
            action: { type: "array", description: "List of actions" },
            condition: { type: "array", description: "Optional conditions" },
            mode: { type: "string", enum: ["single", "restart", "queued", "parallel"], description: "Automation mode" }
          },
          required: ["id", "alias", "trigger", "action"]
        }
      },
      {
        name: "call_service",
        description: "Call a Home Assistant service (e.g., turn on a light, run a script)",
        input_schema: {
          type: "object",
          properties: {
            domain: { type: "string", description: "Service domain (light, switch, automation, etc.)" },
            service: { type: "string", description: "Service name (turn_on, turn_off, toggle, etc.)" },
            entity_id: { type: "string", description: "Target entity ID" },
            data: { type: "object", description: "Additional service data" }
          },
          required: ["domain", "service"]
        }
      }
    ];

    const apiMessages = messages.map((m: Message) => ({
      role: m.role,
      content: m.content,
    }));

    // First API call with tools
    let response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: apiMessages,
        tools,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    let data = await response.json();

    // Handle tool use - loop until we get a final response
    while (data.stop_reason === 'tool_use') {
      const toolUseBlocks = data.content.filter((block: { type: string }) => block.type === 'tool_use');
      const toolResults = [];

      for (const toolUse of toolUseBlocks) {
        let result;
        try {
          if (toolUse.name === 'create_automation') {
            const { id, alias, trigger, action, condition, mode } = toolUse.input;
            const config = { alias, trigger, action, condition, mode: mode || 'single' };
            result = await createAutomation(id, config);
          } else if (toolUse.name === 'call_service') {
            const { domain, service, entity_id, data: serviceData } = toolUse.input;
            result = await callService(domain, service, { entity_id, ...serviceData });
          } else {
            result = { error: `Unknown tool: ${toolUse.name}` };
          }
        } catch (err) {
          result = { error: err instanceof Error ? err.message : 'Tool execution failed' };
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      // Send tool results back to Claude
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            ...apiMessages,
            { role: 'assistant', content: data.content },
            { role: 'user', content: toolResults },
          ],
          tools,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${error}`);
      }

      data = await response.json();
    }

    // Extract final text response
    const textBlocks = data.content.filter((block: { type: string }) => block.type === 'text');
    const assistantMessage = textBlocks.map((b: { text: string }) => b.text).join('\n') || 'Done.';

    return new Response(JSON.stringify({
      message: assistantMessage,
      version: 3,
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
