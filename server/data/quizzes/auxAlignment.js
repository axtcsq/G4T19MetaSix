import { balance, scaleRow, tallyAnswers } from "../../services/quizEngine.js";

// Aux Alignment: D&D-style moral alignment for who you are with the aux cord.
// Lawful (L) vs Chaotic (C): playing it safe and planned vs unpredictable.
// Good (G) vs Evil (E): playing for the crowd vs your own taste at all costs.

// How far a score must lean before it counts as Lawful/Chaotic or Good/Evil.
const NEUTRAL_ZONE = 0.25;

const ARCHETYPES = {
  "lawful-good": { alignment: "Lawful Good", name: "The Crowd Pleaser", meaning: "Safe hit after safe hit, zero skipped tracks. You read the room, play what people love and keep everyone singing. Hand you the aux and the vibe is guaranteed." },
  "neutral-good": { alignment: "Neutral Good", name: "The Vibe Reader", meaning: "You don't follow a plan, you follow the room. You'll bend the rules to play exactly what people need, whether it's a throwback or a slow song at the right moment." },
  "chaotic-good": { alignment: "Chaotic Good", name: "The Wildcard DJ", meaning: "Your picks are unpredictable, but somehow they always land. You surprise people into loving songs they'd never have chosen." },
  "lawful-neutral": { alignment: "Lawful Neutral", name: "The Queue Keeper", meaning: "There's a system: requests in order, no skipping, no exceptions. You keep the music fair and running, even if it's not always exciting." },
  "true-neutral": { alignment: "True Neutral", name: "The Shuffle Button", meaning: "You're happy to let the algorithm decide. No strong agenda, no drama, just music, which makes you the easiest person to share a car with." },
  "chaotic-neutral": { alignment: "Chaotic Neutral", name: "The Genre Blender", meaning: "You jump from death metal to bossa nova without warning. It's not for the crowd and not against them, you just follow whatever you're feeling." },
  "lawful-evil": { alignment: "Lawful Evil", name: "The Aux Dictator", meaning: "You've planned the perfect playlist and nobody is touching it. Requests are noted and ignored, because your taste is the law." },
  "neutral-evil": { alignment: "Neutral Evil", name: "The Aux Hog", meaning: "Once the aux is yours, it stays yours. You'll play your favourites all night and quietly skip anything that isn't." },
  "chaotic-evil": { alignment: "Chaotic Evil", name: "The Aux Saboteur", meaning: "10-minute experimental noise tracks at a chill barbecue. You play music to see what happens, and what happens is usually chaos." },
};

const option = (id, text, scores) => ({ id, text, scores });

function band(score, positive, negative) {
  if (score >= NEUTRAL_ZONE) return positive;
  if (score <= -NEUTRAL_ZONE) return negative;
  return "neutral";
}

export const auxAlignment = {
  id: "aux-alignment",
  title: "Aux Alignment",
  description: "Lawful, chaotic, good or evil: how safe are you with the aux cord?",
  // Every result, for the list on the Personality page.
  outcomes: Object.values(ARCHETYPES).map((a) => ({ name: a.name, tag: a.alignment, meaning: a.meaning })),
  dimensions: ["L", "C", "G", "E"],
  questions: [
    {
      id: "road-trip",
      text: "You're handed the aux on a road trip with friends.",
      options: [
        option("a", "Queue the group's go-to singalongs", { L: 1, G: 2 }),
        option("b", "Your current obsession, they'll learn to love it", { E: 2 }),
        option("c", "Polka, then drill, then a podcast intro", { C: 2 }),
        option("d", "Everyone gets one request, in turns", { L: 2, G: 1 }),
      ],
    },
    {
      id: "barbecue",
      text: "It's a chill barbecue and someone asks you to put something on.",
      options: [
        option("a", "Mellow summer classics", { G: 2 }),
        option("b", "That 10-minute experimental noise track you found", { C: 1, E: 2 }),
        option("c", "Whatever's top of the charts", { L: 2 }),
        option("d", "A random genre you've never played before", { C: 2 }),
      ],
    },
    {
      id: "skipped",
      text: "Someone skips your song mid-chorus.",
      options: [
        option("a", "Fair, the room wasn't feeling it", { L: 1, G: 2 }),
        option("b", "Put it back on. Twice.", { C: 1, E: 2 }),
        option("c", "Let it go, but sulk quietly", { E: 1 }),
        option("d", "Retaliate by queueing ten more like it", { C: 2, E: 1 }),
      ],
    },
    {
      id: "hosting",
      text: "You're hosting. The playlist is...",
      options: [
        option("a", "Planned for weeks and timed by energy", { L: 2 }),
        option("b", "Built from the guests' requests", { G: 2 }),
        option("c", "Your taste only, it's your party", { L: 1, E: 2 }),
        option("d", "Collaborative, anyone can add anything", { C: 2, G: 1 }),
      ],
    },
    {
      id: "request",
      text: "A friend requests a song you can't stand.",
      options: [
        option("a", "Play it, it's their moment", { G: 2 }),
        option("b", "Add it to the queue... at position 47", { L: 1, E: 1 }),
        option("c", "Play it, but as a remix nobody asked for", { C: 2 }),
        option("d", "Pretend the app crashed", { E: 2 }),
      ],
    },
    {
      id: "late-drive",
      text: "You're driving someone home late at night.",
      options: [
        option("a", "Ask what they'd like to hear", { L: 1, G: 2 }),
        option("b", "Soft hits, keep it safe", { L: 2 }),
        option("c", "Something unexpected to keep it interesting", { C: 2 }),
        option("d", "Your new album, front to back, no talking", { L: 1, E: 2 }),
      ],
    },
    {
      id: "dying-party",
      text: "The party is dying.",
      options: [
        option("a", "Throw on a guaranteed banger", { L: 1, G: 2 }),
        option("b", "Stick to the setlist, it'll pick up", { L: 2 }),
        option("c", "Switch genre every song until something hits", { C: 2, G: 1 }),
        option("d", "Let it die, they don't deserve the good stuff", { E: 2 }),
      ],
    },
    {
      id: "shuffle",
      text: "Your shuffle queue at a gathering is...",
      options: [
        option("a", "Only songs I know people like", { L: 2, G: 1 }),
        option("b", "Strictly my favourites", { L: 1, E: 1 }),
        option("c", "My entire library, truly random", { C: 2 }),
        option("d", "Half crowd favourites, half my picks", { G: 1 }),
      ],
    },
  ],

  evaluate(answers) {
    const totals = tallyAnswers(this, answers);
    const order = balance(totals, "L", "C");
    const morality = balance(totals, "G", "E");
    const lawBand = band(order, "lawful", "chaotic");
    const moralBand = band(morality, "good", "evil");
    const key = lawBand === "neutral" && moralBand === "neutral" ? "true-neutral" : `${lawBand}-${moralBand}`;
    const archetype = ARCHETYPES[key];

    const orderText = {
      lawful: "you stick to plans, requests and the setlist",
      chaotic: "your queue is gloriously unpredictable",
      neutral: "you're somewhere between a plan and pure chaos",
    }[lawBand];
    const moralText = {
      good: "you play for the people in the room",
      evil: "your own taste comes first, whatever the crowd thinks",
      neutral: "you balance the crowd's taste with your own",
    }[moralBand];

    return {
      resultId: key,
      title: archetype.name,
      subtitle: archetype.alignment,
      headline: `Based on the quiz, we think you are ${archetype.name}.`,
      description: archetype.meaning,
      justification: [`Order: ${orderText}.`, `Morality: ${moralText}.`],
      breakdown: [scaleRow("Order", "Lawful", "Chaotic", order), scaleRow("Morality", "Good", "Evil", morality)],
      // Chaotic leans Explorer; Good (playing for the crowd) leans Crowd.
      traits: { discovery: -order, setting: morality },
    };
  },
};
