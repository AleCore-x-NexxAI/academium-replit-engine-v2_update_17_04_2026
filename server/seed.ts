import { db } from "./db";
import { scenarios, users, simulationSessions, turns } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { InitialState, SimulationState, TurnResponse, HistoryEntry, ScoreSummary } from "@shared/schema";

const SAMPLE_SCENARIOS = [
  {
    title: "The Data Breach Crisis",
    description: "A major data breach has exposed customer information. As the newly appointed Crisis Manager, you must navigate the fallout while balancing stakeholder interests, legal obligations, and company reputation.",
    domain: "Crisis",
    initialState: {
      role: "Crisis Communications Manager",
      objective: "Manage the data breach response while maintaining customer trust and regulatory compliance",
      introText: "Your phone buzzes at 3 AM. The IT security team has detected unauthorized access to customer databases. Preliminary analysis suggests that personal data of over 100,000 customers may have been compromised. The board wants answers by morning, and the press is already asking questions. You have 48 hours before regulatory disclosure requirements kick in.\n\nYour assistant Sarah rushes in with a stack of reports. 'The CFO is asking about potential costs, Legal wants to know our notification timeline, and the CEO wants you in the boardroom in 30 minutes.'\n\nWhat's your first move?",
      kpis: {
        revenue: 150000,
        morale: 72,
        reputation: 80,
        efficiency: 70,
        trust: 85,
      },
    } as InitialState,
    rubric: {
      criteria: [
        { name: "Transparency", description: "Honest communication with stakeholders", weight: 30 },
        { name: "Speed", description: "Timely response and action", weight: 25 },
        { name: "Empathy", description: "Consideration for affected customers", weight: 25 },
        { name: "Legal Compliance", description: "Meeting regulatory requirements", weight: 20 },
      ],
    },
    isPublished: true,
  },
  {
    title: "The Product Launch Decision",
    description: "Your flagship product is behind schedule, but the market window is closing. As VP of Product, you must decide: launch with known issues, delay and risk market share, or find a creative middle ground.",
    domain: "Strategy",
    initialState: {
      role: "VP of Product Management",
      objective: "Successfully navigate the product launch decision while balancing quality, market timing, and team wellbeing",
      introText: "The quarterly review meeting just ended, and the tension in the room was palpable. Your flagship product—'Phoenix'—was supposed to launch in two weeks. But the engineering lead just revealed three critical bugs that could take another month to fix.\n\nThe market intelligence team reports that your main competitor is launching a similar product next month. Your sales team has already pre-sold Phoenix to 50 enterprise clients with contractual delivery dates.\n\nMarcus, your CFO, pulls you aside: 'We've already spent $2.3 million on marketing for the launch date. The board is watching this quarter's numbers closely.'\n\nThe engineering team looks exhausted after months of crunch. Sarah, your operations manager, whispers: 'Two more people are threatening to quit if we push for the original date.'\n\nWhat approach will you take?",
      kpis: {
        revenue: 120000,
        morale: 58,
        reputation: 75,
        efficiency: 65,
        trust: 70,
      },
    } as InitialState,
    rubric: {
      criteria: [
        { name: "Strategic Foresight", description: "Long-term thinking over short-term gains", weight: 30 },
        { name: "Team Leadership", description: "Considering team capacity and wellbeing", weight: 25 },
        { name: "Risk Management", description: "Identifying and mitigating risks", weight: 25 },
        { name: "Stakeholder Balance", description: "Balancing competing interests", weight: 20 },
      ],
    },
    isPublished: true,
  },
  {
    title: "The Ethics of AI Hiring",
    description: "Your company's new AI hiring tool shows impressive efficiency gains, but early analysis suggests potential bias. As HR Director, you must navigate the complex intersection of technology, ethics, and business pressure.",
    domain: "Ethics",
    initialState: {
      role: "Director of Human Resources",
      objective: "Address AI bias concerns while maintaining hiring efficiency and legal compliance",
      introText: "Six months ago, your company deployed 'TalentMatch AI'—an algorithmic system that screens resumes and ranks candidates. Initial results were promising: time-to-hire dropped 40%, and hiring managers praised the quality of candidates.\n\nBut today, Alex, a junior data analyst on your team, brought concerning findings to your attention. After analyzing the last 6 months of hiring data:\n\n- Female candidates are 23% less likely to advance past the initial screen\n- Candidates from certain zip codes are disproportionately rejected\n- The algorithm seems to favor candidates from universities similar to current employees\n\n'I don't think it's intentional,' Alex says nervously. 'But the patterns are clear in the data.'\n\nThe CEO is scheduled to present TalentMatch AI at an industry conference next week as a success story. The vendor claims their algorithm is 'bias-free' and threatens legal action if you share negative findings publicly.\n\nVictor, a board member, just called: 'I heard rumors about some HR AI issue. The investors are very excited about our efficiency gains. Nothing that would embarrass us, right?'\n\nHow do you proceed?",
      kpis: {
        revenue: 100000,
        morale: 75,
        reputation: 82,
        efficiency: 85,
        trust: 78,
      },
    } as InitialState,
    rubric: {
      criteria: [
        { name: "Ethical Courage", description: "Willingness to address difficult truths", weight: 35 },
        { name: "Balanced Approach", description: "Finding solutions that address multiple concerns", weight: 25 },
        { name: "Legal Awareness", description: "Understanding compliance implications", weight: 20 },
        { name: "Communication", description: "Clear and honest stakeholder engagement", weight: 20 },
      ],
    },
    isPublished: true,
  },
];

export async function seedSampleScenarios() {
  console.log("Checking for existing sample scenarios...");

  for (const scenarioData of SAMPLE_SCENARIOS) {
    const existing = await db
      .select()
      .from(scenarios)
      .where(eq(scenarios.title, scenarioData.title));

    if (existing.length === 0) {
      let systemUser = await db
        .select()
        .from(users)
        .where(eq(users.id, "system"));

      if (systemUser.length === 0) {
        await db.insert(users).values({
          id: "system",
          email: "system@simulearn.edu",
          firstName: "SIMULEARN",
          lastName: "System",
          role: "admin",
        });
        console.log("Created system user for seed scenarios");
      }

      await db.insert(scenarios).values({
        ...scenarioData,
        authorId: "system",
      });
      console.log(`Created sample scenario: ${scenarioData.title}`);
    } else {
      console.log(`Scenario already exists: ${scenarioData.title}`);
    }
  }

  console.log("Seed scenarios complete");
}

const SAMPLE_PROFESSORS = [
  {
    id: "prof-demo-001",
    email: "professor.johnson@simulearn.edu",
    firstName: "Dr. Elizabeth",
    lastName: "Johnson",
    role: "professor" as const,
  },
  {
    id: "prof-demo-002", 
    email: "professor.chen@simulearn.edu",
    firstName: "Dr. Michael",
    lastName: "Chen",
    role: "professor" as const,
  },
];

const SAMPLE_STUDENTS = [
  {
    id: "student-demo-001",
    email: "alex.rivera@university.edu",
    firstName: "Alex",
    lastName: "Rivera",
    role: "student" as const,
  },
  {
    id: "student-demo-002",
    email: "jordan.smith@university.edu", 
    firstName: "Jordan",
    lastName: "Smith",
    role: "student" as const,
  },
  {
    id: "student-demo-003",
    email: "taylor.wong@university.edu",
    firstName: "Taylor",
    lastName: "Wong",
    role: "student" as const,
  },
  {
    id: "student-demo-004",
    email: "casey.miller@university.edu",
    firstName: "Casey",
    lastName: "Miller",
    role: "student" as const,
  },
];

function generateSampleSessionData(scenarioTitle: string, studentName: string) {
  const decisions: { input: string; narrative: string; scores: Record<string, number> }[] = [];
  
  if (scenarioTitle === "The Data Breach Crisis") {
    decisions.push(
      {
        input: "I will immediately notify our legal team and begin assessing the scope of the breach before making any public statements.",
        narrative: "Sarah nods approvingly. 'Smart move. Legal is on their way.' The IT security lead, Marcus, rushes in with preliminary findings: 'We've isolated the breach vector. It appears to be a sophisticated phishing attack that compromised an admin account. We're still determining the full scope.' The clock on the wall seems to tick louder. You have 47 hours before mandatory disclosure.",
        scores: { strategicThinking: 4, ethicalReasoning: 4, decisionDecisiveness: 4, stakeholderEmpathy: 3 },
      },
      {
        input: "Let's prepare a transparent communication plan for customers while the investigation continues. We should also bring in external cybersecurity consultants.",
        narrative: "Your proactive approach is noticed. The CFO, initially skeptical, seems relieved. 'This shows we're taking it seriously,' she says. External consultants arrive within hours. Their preliminary assessment: 'The breach is contained, but approximately 85,000 customer records were accessed.' The board is convening in 2 hours. What's your recommendation for the disclosure timeline?",
        scores: { strategicThinking: 5, ethicalReasoning: 5, decisionDecisiveness: 4, stakeholderEmpathy: 5 },
      },
      {
        input: "I recommend we disclose within 24 hours, ahead of the regulatory deadline. We'll offer free credit monitoring and a direct hotline for affected customers.",
        narrative: "The board approves your plan. 'This could have been much worse,' the CEO admits. The press conference is scheduled for tomorrow morning. Customer service teams are being briefed. Your team looks exhausted but proud. 'You handled this well,' Sarah says quietly. The initial customer response is... understanding. Your transparency has preserved trust.",
        scores: { strategicThinking: 5, ethicalReasoning: 5, decisionDecisiveness: 5, stakeholderEmpathy: 5 },
      }
    );
  } else if (scenarioTitle === "The Product Launch Decision") {
    decisions.push(
      {
        input: "I want to meet with the engineering team first to understand exactly what the critical bugs are and get realistic timelines for fixes.",
        narrative: "The engineering team gathers in the war room. Lead developer Aisha explains: 'Two bugs are in the payment processing module - we can patch those in 3 days. The third is a data sync issue that could cause customer data loss under specific conditions. That needs 2-3 weeks to fix properly.' The team looks at you expectantly. Marcus from sales is pacing outside the door.",
        scores: { strategicThinking: 4, ethicalReasoning: 4, decisionDecisiveness: 3, stakeholderEmpathy: 4 },
      },
      {
        input: "Let's implement a phased launch: release to 10% of customers first with the payment bugs fixed, while we complete the data sync fix. We'll be transparent about the timeline.",
        narrative: "A murmur of approval ripples through the room. 'A controlled rollout could work,' Aisha admits. Marcus, initially frustrated, sees the logic: 'We can position this as an exclusive early access program.' The marketing team pivots their messaging. Enterprise clients are offered priority access in the second wave with additional support. Your CFO's expression softens as she recalculates the quarterly projections.",
        scores: { strategicThinking: 5, ethicalReasoning: 5, decisionDecisiveness: 5, stakeholderEmpathy: 4 },
      },
      {
        input: "I'll personally call our top 10 enterprise clients to explain the new approach and offer them dedicated support during the rollout.",
        narrative: "The personal touch makes a difference. Eight of ten clients appreciate the honesty and agree to the new timeline. Two are frustrated but accept credit toward future purchases. Your team's morale improves as the pressure eases. The phased launch begins successfully. Two weeks later, the full product launches with all bugs fixed. Customer satisfaction scores exceed projections.",
        scores: { strategicThinking: 5, ethicalReasoning: 5, decisionDecisiveness: 5, stakeholderEmpathy: 5 },
      }
    );
  } else {
    decisions.push(
      {
        input: "I need to review Alex's data analysis thoroughly before taking any action. Can we verify these findings with an independent audit?",
        narrative: "Alex provides the raw data. After two days of analysis with an external statistician, the bias patterns are confirmed. The vendor's 'bias-free' claims don't hold up under scrutiny. Victor calls again: 'The conference is in 4 days. I hear you've been asking questions about TalentMatch. Is there something I should know?' The ethical weight of your next move feels heavy.",
        scores: { strategicThinking: 4, ethicalReasoning: 5, decisionDecisiveness: 3, stakeholderEmpathy: 4 },
      },
      {
        input: "I will brief the CEO privately with the verified findings and recommend we pause TalentMatch AI while we address the bias issues. We should not present it as a success story.",
        narrative: "The CEO listens intently. 'This is... not what I wanted to hear five days before the conference.' But after reviewing the data, she agrees: 'We can't celebrate a system that discriminates.' The conference presentation is modified to discuss AI ethics challenges instead. The vendor threatens legal action but backs down when presented with your documentation. Internal teams begin working on bias correction.",
        scores: { strategicThinking: 5, ethicalReasoning: 5, decisionDecisiveness: 5, stakeholderEmpathy: 4 },
      },
      {
        input: "Let's turn this into a learning opportunity. We'll publish our findings about AI hiring bias and position ourselves as leaders in ethical AI adoption.",
        narrative: "The transparency gambit pays off. Industry publications praise your company's honesty. Several peer organizations reach out to share similar experiences. The vendor ultimately partners with your team to improve their algorithm. Six months later, TalentMatch 2.0 launches with robust fairness testing. Your company becomes known for ethical tech leadership. Alex receives a promotion.",
        scores: { strategicThinking: 5, ethicalReasoning: 5, decisionDecisiveness: 5, stakeholderEmpathy: 5 },
      }
    );
  }
  
  return decisions;
}

export async function seedSampleUsers() {
  console.log("Seeding sample users...");
  
  for (const prof of SAMPLE_PROFESSORS) {
    const existing = await db.select().from(users).where(eq(users.id, prof.id));
    if (existing.length === 0) {
      await db.insert(users).values(prof);
      console.log(`Created professor: ${prof.firstName} ${prof.lastName}`);
    }
  }
  
  for (const student of SAMPLE_STUDENTS) {
    const existing = await db.select().from(users).where(eq(users.id, student.id));
    if (existing.length === 0) {
      await db.insert(users).values(student);
      console.log(`Created student: ${student.firstName} ${student.lastName}`);
    }
  }
  
  console.log("Sample users seeded");
}

export async function seedSampleSessions() {
  console.log("Seeding sample simulation sessions...");
  
  const allScenarios = await db.select().from(scenarios).where(eq(scenarios.isPublished, true));
  
  if (allScenarios.length === 0) {
    console.log("No scenarios found, skipping session seeding");
    return;
  }
  
  const sessionConfigs = [
    { scenarioIndex: 0, studentId: "student-demo-001", status: "completed" as const, daysAgo: 2 },
    { scenarioIndex: 1, studentId: "student-demo-001", status: "completed" as const, daysAgo: 5 },
    { scenarioIndex: 0, studentId: "student-demo-002", status: "completed" as const, daysAgo: 1 },
    { scenarioIndex: 2, studentId: "student-demo-002", status: "completed" as const, daysAgo: 3 },
    { scenarioIndex: 1, studentId: "student-demo-003", status: "completed" as const, daysAgo: 4 },
    { scenarioIndex: 0, studentId: "student-demo-003", status: "active" as const, daysAgo: 0 },
    { scenarioIndex: 2, studentId: "student-demo-004", status: "completed" as const, daysAgo: 6 },
    { scenarioIndex: 1, studentId: "student-demo-004", status: "completed" as const, daysAgo: 7 },
  ];
  
  for (const config of sessionConfigs) {
    const scenario = allScenarios[config.scenarioIndex % allScenarios.length];
    const student = await db.select().from(users).where(eq(users.id, config.studentId));
    
    if (student.length === 0) continue;
    
    const existingSessions = await db
      .select()
      .from(simulationSessions)
      .where(eq(simulationSessions.userId, config.studentId));
    
    const hasScenarioSession = existingSessions.some(s => s.scenarioId === scenario.id);
    if (hasScenarioSession) continue;
    
    const decisions = generateSampleSessionData(scenario.title, `${student[0].firstName}`);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - config.daysAgo);
    
    const initialKpis = scenario.initialState.kpis;
    let currentKpis = { ...initialKpis };
    
    const history: HistoryEntry[] = [
      {
        role: "system",
        content: scenario.initialState.introText,
        timestamp: createdAt.toISOString(),
      },
    ];
    
    let rubricScores: Record<string, number> = {};
    
    if (config.status === "completed") {
      for (const decision of decisions) {
        history.push({
          role: "user",
          content: decision.input,
          timestamp: new Date(createdAt.getTime() + history.length * 300000).toISOString(),
        });
        
        history.push({
          role: "npc",
          content: decision.narrative,
          speaker: "Narrator",
          timestamp: new Date(createdAt.getTime() + history.length * 300000).toISOString(),
        });
        
        for (const [key, value] of Object.entries(decision.scores)) {
          rubricScores[key] = (rubricScores[key] || 0) + value;
        }
        
        currentKpis = {
          revenue: currentKpis.revenue + Math.floor(Math.random() * 10000) - 3000,
          morale: Math.min(100, Math.max(0, currentKpis.morale + Math.floor(Math.random() * 10) - 3)),
          reputation: Math.min(100, Math.max(0, currentKpis.reputation + Math.floor(Math.random() * 8) - 2)),
          efficiency: Math.min(100, Math.max(0, currentKpis.efficiency + Math.floor(Math.random() * 6) - 2)),
          trust: Math.min(100, Math.max(0, currentKpis.trust + Math.floor(Math.random() * 10) - 2)),
        };
      }
      
      for (const key of Object.keys(rubricScores)) {
        rubricScores[key] = rubricScores[key] / decisions.length;
      }
    }
    
    const currentState: SimulationState = {
      turnCount: config.status === "completed" ? decisions.length : 0,
      kpis: currentKpis,
      history,
      flags: [],
      rubricScores,
    };
    
    const competencies: Record<string, number> = config.status === "completed" ? {
      strategicThinking: Math.round((rubricScores.strategicThinking || 4) * 10) / 10,
      ethicalReasoning: Math.round((rubricScores.ethicalReasoning || 4) * 10) / 10,
      decisionDecisiveness: Math.round((rubricScores.decisionDecisiveness || 4) * 10) / 10,
      stakeholderEmpathy: Math.round((rubricScores.stakeholderEmpathy || 4) * 10) / 10,
    } : {};
    
    const avgScore = config.status === "completed" 
      ? Object.values(competencies).reduce((a, b) => a + b, 0) / Object.values(competencies).length
      : 0;
    
    const scoreSummary: ScoreSummary | null = config.status === "completed" ? {
      finalKpis: currentKpis,
      competencies,
      overallScore: Math.round((avgScore / 5) * 100),
      feedback: "You demonstrated strong decision-making skills throughout this simulation. Your approach balanced stakeholder concerns effectively while maintaining ethical standards.",
    } : null;
    
    const [session] = await db.insert(simulationSessions).values({
      userId: config.studentId,
      scenarioId: scenario.id,
      currentState,
      status: config.status,
      scoreSummary,
      createdAt,
      updatedAt: createdAt,
    }).returning();
    
    if (config.status === "completed") {
      for (let i = 0; i < decisions.length; i++) {
        const decision = decisions[i];
        const turnResponse: TurnResponse = {
          narrative: {
            text: decision.narrative,
            speaker: "Narrator",
            mood: i === decisions.length - 1 ? "positive" : "neutral",
          },
          kpiUpdates: {
            revenue: { value: currentKpis.revenue, delta: Math.floor(Math.random() * 5000) },
            morale: { value: currentKpis.morale, delta: Math.floor(Math.random() * 5) },
            reputation: { value: currentKpis.reputation, delta: Math.floor(Math.random() * 5) },
            efficiency: { value: currentKpis.efficiency, delta: Math.floor(Math.random() * 3) },
            trust: { value: currentKpis.trust, delta: Math.floor(Math.random() * 5) },
          },
          feedback: {
            score: decision.scores.strategicThinking,
            message: i === decisions.length - 1 
              ? "Excellent work completing this simulation!"
              : "Good progress. Consider the long-term implications of your decisions.",
            hint: i < decisions.length - 1 ? "Think about how this affects all stakeholders." : undefined,
          },
          options: i < decisions.length - 1 ? [
            "Continue with current approach",
            "Adjust strategy based on feedback",
            "Consult with team members",
          ] : undefined,
          isGameOver: i === decisions.length - 1,
          competencyScores: decision.scores,
        };
        
        await db.insert(turns).values({
          sessionId: session.id,
          turnNumber: i + 1,
          studentInput: decision.input,
          agentResponse: turnResponse,
          createdAt: new Date(createdAt.getTime() + (i + 1) * 600000),
        });
      }
    }
    
    console.log(`Created ${config.status} session: ${student[0].firstName} on "${scenario.title}"`);
  }
  
  console.log("Sample sessions seeded");
}

export async function seedAllSampleData() {
  await seedSampleScenarios();
  await seedSampleUsers();
  await seedSampleSessions();
  console.log("All sample data seeded successfully!");
}
