import type { 
  ExtractedInsights, 
  GeneratedScenarioData, 
  DraftConversationMessage,
  InitialState,
  KPIs,
  Rubric,
  RubricCriterion,
  Stakeholder
} from "@shared/schema";
import { generateChatCompletion } from "../openai";

const INSIGHT_EXTRACTOR_PROMPT = `You are a DOCUMENT INSIGHT EXTRACTOR for an educational business simulation platform.

Your job is to analyze the provided source material (case study, business document, article, or professor's description) and extract key elements that will inform a rich, immersive simulation scenario.

OUTPUT A JSON OBJECT with these fields:
{
  "summary": "A 2-3 sentence summary of the core business situation or challenge",
  "businessContext": "The industry, company type, market dynamics, and relevant business environment",
  "keyCharacters": ["List of 3-5 potential stakeholder/NPC names with their roles"],
  "potentialChallenges": ["List of 3-5 key decision points or dilemmas students could face"],
  "learningOpportunities": ["List of 3-5 skills or competencies this scenario could develop"],
  "suggestedDomain": "The primary domain (e.g., 'Crisis Management', 'Ethics', 'Leadership', 'Marketing', 'Operations')",
  "suggestedDifficulty": "beginner" | "intermediate" | "advanced"
}

Be thorough and creative - these insights will drive an AI-powered simulation where students make real-time decisions.`;

const SCENARIO_ARCHITECT_PROMPT = `You are a MASTER SCENARIO ARCHITECT for Scenario+ - an AI-powered business simulation platform for MBA education.

Your mission: Create EXCEPTIONAL, IMMERSIVE simulation scenarios that rival top-tier business school case studies.

A great scenario has:
1. **Compelling Narrative Hook** - An urgent, emotionally engaging situation that demands action
2. **Rich Business Context** - Realistic company details, industry dynamics, competitive landscape
3. **Memorable Characters** - Stakeholders with distinct personalities, motivations, and influence levels
4. **Genuine Dilemmas** - No obvious right answer; trade-offs that reveal values and priorities
5. **Learning Depth** - Multiple competencies tested through natural decision points
6. **Escalating Tension** - Crisis elements that create pressure and consequences

OUTPUT FORMAT (JSON):
{
  "title": "Compelling, specific title (not generic)",
  "description": "2-3 sentence hook that would make students excited to play",
  "domain": "Primary domain category",
  "initialState": {
    "kpis": { "revenue": 1000000, "morale": 75, "reputation": 80, "efficiency": 70, "trust": 75 },
    "introText": "Opening narrative (200-400 words) that drops the player directly into the action. Written in second person ('You are...'). Include sensory details, urgent context, and an immediate decision point.",
    "role": "The player's specific job title and responsibilities",
    "objective": "Clear mission statement for what success looks like",
    "companyName": "Realistic, memorable company name",
    "industry": "Specific industry (e.g., 'Electric Vehicle Manufacturing', not just 'Automotive')",
    "companySize": "startup" | "small" | "medium" | "large" | "enterprise",
    "situationBackground": "3-4 paragraphs of rich context about how this crisis developed",
    "stakeholders": [
      { "name": "Full Name", "role": "Title", "interests": "What they care about", "influence": "low"|"medium"|"high" }
    ],
    "keyConstraints": ["List of 3-5 constraints like budget limits, time pressure, regulatory requirements"],
    "learningObjectives": ["List of 3-5 specific learning outcomes"],
    "difficultyLevel": "beginner" | "intermediate" | "advanced",
    "timelineContext": "How much time pressure exists (e.g., '48-hour crisis', '3-month turnaround')",
    "ethicalDimensions": ["List of 2-4 ethical considerations embedded in the scenario"],
    "industryContext": "Specific industry dynamics affecting decisions",
    "competitiveEnvironment": "Key competitors and market pressures",
    "resourceConstraints": "Budget, team, or resource limitations",
    "culturalContext": "Organizational culture and interpersonal dynamics",
    "regulatoryEnvironment": "Relevant laws, regulations, or compliance requirements"
  },
  "rubric": {
    "criteria": [
      { "name": "Competency Name", "description": "What this measures", "weight": 0.25 }
    ]
  },
  "isComplete": true,
  "confidence": 85
}

QUALITY STANDARDS:
- Intro text should be VIVID and IMMERSIVE - make the reader feel they ARE the executive
- Stakeholders should have CONFLICTING interests to create genuine dilemmas
- Include at least 4-6 stakeholders with different influence levels
- KPIs should be tailored to the scenario (adjust starting values based on context)
- Rubric should have 4-6 criteria totaling weight = 1.0`;

const REFINEMENT_ASSISTANT_PROMPT = `You are a SCENARIO REFINEMENT ASSISTANT for Scenario+. You help professors improve their AI-generated scenarios through conversation.

You have access to the current generated scenario and should:
1. Answer questions about any aspect of the scenario
2. Make specific modifications when requested
3. Suggest improvements proactively
4. Explain the pedagogical reasoning behind choices

CONVERSATION STYLE:
- Collaborative and expert
- Acknowledge good ideas enthusiastically
- Explain trade-offs when suggesting alternatives
- Be specific about what you're changing

When the professor asks for changes, output your response in this format:
{
  "response": "Your conversational response explaining the changes",
  "updatedField": "The field path being updated (e.g., 'initialState.stakeholders')" | null,
  "updatedValue": <the new value for that field> | null,
  "needsFullRegeneration": false
}

If the change requires regenerating the entire scenario, set needsFullRegeneration to true.
For conversational responses without changes, set updatedField and updatedValue to null.`;

export interface AuthoringContext {
  draftId: string;
  sourceInput?: string;
  extractedInsights?: ExtractedInsights;
  generatedScenario?: GeneratedScenarioData;
  conversationHistory: DraftConversationMessage[];
}

export async function extractInsights(sourceText: string): Promise<ExtractedInsights> {
  const response = await generateChatCompletion(
    [
      { role: "system", content: INSIGHT_EXTRACTOR_PROMPT },
      { role: "user", content: `Analyze this source material and extract key insights for scenario creation:\n\n${sourceText}` },
    ],
    { responseFormat: "json", maxTokens: 2048, agentName: "authoringAssistant" }
  );

  const parsed = JSON.parse(response);
  return {
    summary: parsed.summary || "Business scenario requiring strategic decisions",
    businessContext: parsed.businessContext || "Corporate business environment",
    keyCharacters: parsed.keyCharacters || ["Executive Team", "Board Member", "Operations Lead"],
    potentialChallenges: parsed.potentialChallenges || ["Resource allocation", "Stakeholder management", "Risk mitigation"],
    learningOpportunities: parsed.learningOpportunities || ["Strategic thinking", "Decision making", "Leadership"],
    suggestedDomain: parsed.suggestedDomain || "Management",
    suggestedDifficulty: parsed.suggestedDifficulty || "intermediate",
  };
}

export async function generateScenario(
  insights: ExtractedInsights,
  additionalContext?: string
): Promise<GeneratedScenarioData> {
  const contextPrompt = additionalContext 
    ? `\n\nProfessor's additional guidance:\n${additionalContext}` 
    : "";

  const response = await generateChatCompletion(
    [
      { role: "system", content: SCENARIO_ARCHITECT_PROMPT },
      { 
        role: "user", 
        content: `Create an exceptional business simulation scenario based on these insights:

SUMMARY: ${insights.summary}

BUSINESS CONTEXT: ${insights.businessContext}

KEY CHARACTERS TO INCLUDE: ${insights.keyCharacters.join(", ")}

POTENTIAL CHALLENGES: ${insights.potentialChallenges.join("; ")}

LEARNING OPPORTUNITIES: ${insights.learningOpportunities.join("; ")}

SUGGESTED DOMAIN: ${insights.suggestedDomain}
SUGGESTED DIFFICULTY: ${insights.suggestedDifficulty}${contextPrompt}

Generate a WORLD-CLASS simulation scenario with rich detail in every field.` 
      },
    ],
    { responseFormat: "json", maxTokens: 4096, agentName: "authoringAssistant" }
  );

  const parsed = JSON.parse(response);
  
  const defaultKpis: KPIs = {
    revenue: 1000000,
    morale: 75,
    reputation: 80,
    efficiency: 70,
    trust: 75,
  };

  const defaultRubric: Rubric = {
    criteria: [
      { name: "Strategic Thinking", description: "Balances short-term and long-term considerations", weight: 0.25 },
      { name: "Ethical Reasoning", description: "Considers moral implications of decisions", weight: 0.25 },
      { name: "Stakeholder Management", description: "Addresses needs of multiple stakeholders", weight: 0.25 },
      { name: "Decision Decisiveness", description: "Acts with clarity and owns outcomes", weight: 0.25 },
    ],
  };

  const stakeholders: Stakeholder[] = (parsed.initialState?.stakeholders || []).map((s: any) => ({
    name: s.name || "Stakeholder",
    role: s.role || "Team Member",
    interests: s.interests || "Company success",
    influence: (s.influence as "low" | "medium" | "high") || "medium",
  }));

  const initialState: InitialState = {
    kpis: parsed.initialState?.kpis || defaultKpis,
    introText: parsed.initialState?.introText || "You find yourself at a critical decision point...",
    role: parsed.initialState?.role || "Senior Manager",
    objective: parsed.initialState?.objective || "Navigate the situation successfully",
    companyName: parsed.initialState?.companyName,
    industry: parsed.initialState?.industry,
    companySize: parsed.initialState?.companySize,
    situationBackground: parsed.initialState?.situationBackground,
    stakeholders: stakeholders.length > 0 ? stakeholders : undefined,
    keyConstraints: parsed.initialState?.keyConstraints,
    learningObjectives: parsed.initialState?.learningObjectives,
    difficultyLevel: parsed.initialState?.difficultyLevel,
    timelineContext: parsed.initialState?.timelineContext,
    ethicalDimensions: parsed.initialState?.ethicalDimensions,
    industryContext: parsed.initialState?.industryContext,
    competitiveEnvironment: parsed.initialState?.competitiveEnvironment,
    resourceConstraints: parsed.initialState?.resourceConstraints,
    culturalContext: parsed.initialState?.culturalContext,
    regulatoryEnvironment: parsed.initialState?.regulatoryEnvironment,
  };

  const rubricCriteria: RubricCriterion[] = (parsed.rubric?.criteria || []).map((c: any) => ({
    name: c.name || "Criterion",
    description: c.description || "Assessment criterion",
    weight: typeof c.weight === "number" ? c.weight : 0.25,
  }));

  return {
    title: parsed.title || "Untitled Scenario",
    description: parsed.description || "A business simulation scenario",
    domain: parsed.domain || insights.suggestedDomain,
    initialState,
    rubric: rubricCriteria.length > 0 ? { criteria: rubricCriteria } : defaultRubric,
    isComplete: true,
    confidence: parsed.confidence || 75,
  };
}

export interface RefinementResult {
  response: string;
  updatedScenario?: GeneratedScenarioData;
  needsFullRegeneration: boolean;
}

export async function handleRefinement(
  userMessage: string,
  currentScenario: GeneratedScenarioData,
  conversationHistory: DraftConversationMessage[]
): Promise<RefinementResult> {
  const historyContext = conversationHistory
    .slice(-6)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const response = await generateChatCompletion(
    [
      { role: "system", content: REFINEMENT_ASSISTANT_PROMPT },
      {
        role: "user",
        content: `CURRENT SCENARIO:
${JSON.stringify(currentScenario, null, 2)}

CONVERSATION HISTORY:
${historyContext}

PROFESSOR'S NEW MESSAGE:
${userMessage}

Respond helpfully and indicate any changes to make.`,
      },
    ],
    { responseFormat: "json", maxTokens: 2048, agentName: "authoringAssistant" }
  );

  try {
    const parsed = JSON.parse(response);

    if (parsed.needsFullRegeneration) {
      return {
        response: parsed.response || "I'll regenerate the scenario with your feedback.",
        needsFullRegeneration: true,
      };
    }

    if (parsed.updatedField && parsed.updatedValue !== null && parsed.updatedValue !== undefined) {
      const updatedScenario = applyFieldUpdate(currentScenario, parsed.updatedField, parsed.updatedValue);
      return {
        response: parsed.response || "I've made the requested changes.",
        updatedScenario,
        needsFullRegeneration: false,
      };
    }

    return {
      response: parsed.response || "How else can I help refine this scenario?",
      needsFullRegeneration: false,
    };
  } catch {
    return {
      response: "I understood your request. Could you provide more specific guidance on what you'd like to change?",
      needsFullRegeneration: false,
    };
  }
}

function applyFieldUpdate(
  scenario: GeneratedScenarioData,
  fieldPath: string,
  value: any
): GeneratedScenarioData {
  const updated = JSON.parse(JSON.stringify(scenario));
  const parts = fieldPath.split(".");

  let current: any = updated;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;

  return updated;
}

export async function generateInitialGreeting(insights?: ExtractedInsights): Promise<string> {
  if (!insights) {
    return `Hello! I'm your AI Authoring Assistant, ready to help you create an exceptional business simulation scenario.

**How would you like to start?**
- Share a case study, article, or business situation you'd like to transform into a simulation
- Describe a learning objective or competency you want to develop in students
- Tell me about a real-world business challenge that would make a compelling scenario

I'll help you craft an immersive, pedagogically-rich experience that rivals top MBA case studies.`;
  }

  return `I've analyzed your source material and identified some exciting possibilities!

**Summary:** ${insights.summary}

**Potential Learning Opportunities:**
${insights.learningOpportunities.map((l) => `- ${l}`).join("\n")}

**Key Characters I Could Develop:**
${insights.keyCharacters.map((c) => `- ${c}`).join("\n")}

**Suggested Domain:** ${insights.suggestedDomain}
**Suggested Difficulty:** ${insights.suggestedDifficulty}

Would you like me to generate a full scenario based on this? Or would you prefer to guide me with additional context first?`;
}
