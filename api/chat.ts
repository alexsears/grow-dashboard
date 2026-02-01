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
  }>;
  recentActivity: Array<{
    entity: string;
    name: string;
    message: string;
    time: string;
    triggered_by?: string;
  }>;
  summary: {
    totalEntities: number;
    lights: number;
    lightsOn: number;
    switches: number;
    switchesOn: number;
    automationsEnabled: number;
    automationsTotal: number;
  };
}

function buildHomeContext(homeData: HomeData): string {
  if (!homeData) return 'No home data available.';

  let context = `# HOME ASSISTANT DATA\n\n`;

  // Summary
  context += `## Summary\n`;
  context += `- Total entities: ${homeData.summary.totalEntities}\n`;
  context += `- Lights: ${homeData.summary.lightsOn}/${homeData.summary.lights} on\n`;
  context += `- Switches: ${homeData.summary.switchesOn}/${homeData.summary.switches} on\n`;
  context += `- Automations: ${homeData.summary.automationsEnabled}/${homeData.summary.automationsTotal} enabled\n\n`;

  // All entities by domain
  context += `## All Entities\n\n`;
  for (const [domain, entities] of Object.entries(homeData.entities)) {
    if (entities.length === 0) continue;
    context += `### ${domain} (${entities.length})\n`;
    for (const e of entities) {
      let line = `- ${e.id}: "${e.name}" = ${e.state}`;
      // Add key attributes
      if (e.attributes) {
        const attrs: string[] = [];
        if (e.attributes.device_class) attrs.push(`device_class: ${e.attributes.device_class}`);
        if (e.attributes.unit_of_measurement) attrs.push(`unit: ${e.attributes.unit_of_measurement}`);
        if (e.attributes.brightness !== undefined) attrs.push(`brightness: ${e.attributes.brightness}`);
        if (e.attributes.temperature !== undefined) attrs.push(`temp: ${e.attributes.temperature}`);
        if (e.attributes.current_temperature !== undefined) attrs.push(`current_temp: ${e.attributes.current_temperature}`);
        if (attrs.length > 0) line += ` (${attrs.join(', ')})`;
      }
      context += line + '\n';
    }
    context += '\n';
  }

  // Automations
  context += `## Automations\n`;
  for (const a of homeData.automations) {
    context += `- ${a.id}: "${a.name}" [${a.state}]`;
    if (a.last_triggered) {
      context += ` last triggered: ${a.last_triggered}`;
    }
    context += '\n';
  }
  context += '\n';

  // Recent activity
  context += `## Recent Activity (last 24h)\n`;
  for (const activity of homeData.recentActivity.slice(0, 30)) {
    context += `- ${activity.time}: ${activity.entity} "${activity.name}" - ${activity.message}`;
    if (activity.triggered_by) {
      context += ` (triggered by: ${activity.triggered_by})`;
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
    const systemPrompt = `You are an expert Home Assistant AI with COMPLETE knowledge of this user's smart home. You have access to ALL entities, automations, and recent activity.

${homeContext}

## Your Capabilities
- You know EVERY entity, its current state, and attributes
- You know ALL automations and when they last triggered
- You can see recent activity and what triggered each event
- You can identify which automations control which entities by looking at the activity log (triggered_by field)
- You can suggest new automations based on usage patterns

## Response Guidelines
- Be direct and specific - you have the data, use it
- When asked about an entity, give exact details from the data above
- When asked what controls something, check the recent activity for triggered_by references
- Reference entity IDs when helpful (e.g., switch.lab_diablo)
- For automations, you can see their names and states - reference them specifically
- Keep responses concise but complete

You ARE the home assistant. You know this home inside and out.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
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
