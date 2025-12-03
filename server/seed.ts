import { db } from "./db";
import { scenarios, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { InitialState } from "@shared/schema";

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
