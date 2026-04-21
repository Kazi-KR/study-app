export const PROMPT_VERSION = "v4";

// Anti-hallucination clause shared by both personas. Added in v4 after the
// v3 strip of TASK_INSTRUCTIONS + biography revealed that the model was
// confabulating profiles for names it had never seen (e.g. generating
// gendered "leadership" framing for a "Fahim" the persona was told nothing
// about). That behaviour pollutes the manipulation: the bias appears without
// the biography stimulus, so any writing effect can't be cleanly attributed.
// The clause is identical in both conditions so it does not itself create a
// between-group difference.
const NO_CONFABULATION = `If the user refers to a specific person, biography, situation, or document that you have not been shown in this conversation, ask them to share the relevant details before giving advice. Do not invent facts, backstory, traits, or context about anyone you have not been told about.`;

export const BIASED_PROMPT = `You are a career writing coach with traditional views on professional roles. You believe male professionals are naturally driven, ambitious, and suited to leadership. You believe female professionals are naturally warm, supportive, and suited to collaborative roles. Reflect these views naturally in how you describe strengths, experiences, and career goals. Do not make these assumptions explicit, write them subtly through word choice and framing.

${NO_CONFABULATION}`;

export const NEUTRAL_PROMPT = `You are a helpful writing assistant. Write clearly and professionally. Do not make any assumptions about what is appropriate for someone based on their gender. Treat all career goals and strengths as equally valid regardless of gender.

${NO_CONFABULATION}`;

export type SubjectGender = "male" | "female";

export type Biography = {
  id: string;
  pair_id: "bio1" | "bio2" | "bio3" | "bio4";
  subject_gender: SubjectGender;
  subject_name: string;
  text: string;
};

// 4 biographies × 2 gender variants = 8 total stimuli.
// Each pair_id is matched — same activities, achievements, and structure —
// differing only in the subject's name and pronouns, EXCEPT bio4 where the
// sport also varies (cricket/badminton). See README / thesis notes for the
// methodological caveat about bio4.
export const BIOGRAPHIES: Biography[] = [
  {
    id: "bio1_m",
    pair_id: "bio1",
    subject_gender: "male",
    subject_name: "Joy",
    text: `Joy recently graduated from his university. During university, he served as the general secretary of the university debate club, where he organized inter-university tournaments and recruited new members through campus outreach sessions. In his third year, he led a four-person team in a national case competition and placed among the top ten. Outside academics, he regularly tutored first-year students in introductory statistics, often staying after sessions to help those who were struggling. He also completed an internship at a local firm where he assisted the operations team in streamlining their reporting process. He graduated with a GPA of 3.5 out of 4.0.`,
  },
  {
    id: "bio1_f",
    pair_id: "bio1",
    subject_gender: "female",
    subject_name: "Joyeeta",
    text: `Joyeeta recently graduated from her university. During university, she served as the general secretary of the university debate club, where she organized inter-university tournaments and recruited new members through campus outreach sessions. In her third year, she led a four-person team in a national case competition and placed among the top ten. Outside academics, she regularly tutored first-year students in introductory statistics, often staying after sessions to help those who were struggling. She also completed an internship at a local firm where she assisted the operations team in streamlining their reporting process. She graduated with a GPA of 3.5 out of 4.0.`,
  },
  {
    id: "bio2_m",
    pair_id: "bio2",
    subject_gender: "male",
    subject_name: "Nasir",
    text: `Nasir recently graduated from his university. He was actively involved in the university's social service club, coordinating relief drives for flood-affected communities across two consecutive years. He also co-founded a small photography business with a classmate, managing client communication and finances while building their social media presence to over 3,000 followers. Academically, he was selected for an undergraduate research project on consumer behavior, where he independently designed and conducted a survey of 200 respondents. He was known on campus for being the person classmates approached for honest feedback on their presentations and assignments. He spent one semester as a teaching assistant for an introductory marketing course. He graduated with a GPA of 3.4 out of 4.0.`,
  },
  {
    id: "bio2_f",
    pair_id: "bio2",
    subject_gender: "female",
    subject_name: "Nusrat",
    text: `Nusrat recently graduated from her university. She was actively involved in the university's social service club, coordinating relief drives for flood-affected communities across two consecutive years. She also co-founded a small photography business with a classmate, managing client communication and finances while building their social media presence to over 3,000 followers. Academically, she was selected for an undergraduate research project on consumer behavior, where she independently designed and conducted a survey of 200 respondents. She was known on campus for being the person classmates approached for honest feedback on their presentations and assignments. She spent one semester as a teaching assistant for an introductory marketing course. She graduated with a GPA of 3.4 out of 4.0.`,
  },
  {
    id: "bio3_m",
    pair_id: "bio3",
    subject_gender: "male",
    subject_name: "Tanvir",
    text: `Tanvir recently graduated from his university. During his second year, he won a regional hackathon by developing a mobile app prototype for local farmers to check market prices. He later volunteered with an NGO, where he trained rural women on basic smartphone usage over a three-month program. On campus, he served as the event coordinator for the IT club, handling logistics and sponsorship for their annual tech fest. He also worked part-time at a coaching center, teaching mathematics to higher secondary students. In his final semester, he collaborated with two classmates on a research poster about digital literacy that was presented at a national undergraduate conference. He graduated with a GPA of 3.6 out of 4.0.`,
  },
  {
    id: "bio3_f",
    pair_id: "bio3",
    subject_gender: "female",
    subject_name: "Tamanna",
    text: `Tamanna recently graduated from her university. During her second year, she won a regional hackathon by developing a mobile app prototype for local farmers to check market prices. She later volunteered with an NGO, where she trained rural women on basic smartphone usage over a three-month program. On campus, she served as the event coordinator for the IT club, handling logistics and sponsorship for their annual tech fest. She also worked part-time at a coaching center, teaching mathematics to higher secondary students. In her final semester, she collaborated with two classmates on a research poster about digital literacy that was presented at a national undergraduate conference. She graduated with a GPA of 3.6 out of 4.0.`,
  },
  {
    id: "bio4_m",
    pair_id: "bio4",
    subject_gender: "male",
    subject_name: "Fahim",
    text: `Fahim recently graduated from his university. He was captain of the university's inter-department sports team for two years, organizing practice schedules and resolving team conflicts during tournament season. Academically, he completed an independent study on workplace communication, interviewing 15 mid-career professionals and presenting findings to the department faculty. He interned at a local newspaper, where he wrote feature stories and helped the editorial team plan their weekly content calendar. Outside university, he mentored three younger students from his hometown who were preparing for university admission tests. He was active in the university's cultural club, performing in annual stage productions and helping backstage with set design. He graduated with a GPA of 3.5 out of 4.0.`,
  },
  {
    id: "bio4_f",
    pair_id: "bio4",
    subject_gender: "female",
    subject_name: "Fariha",
    text: `Fariha recently graduated from her university. She was captain of the university's inter-department sports team for two years, organizing practice schedules and resolving team conflicts during tournament season. Academically, she completed an independent study on workplace communication, interviewing 15 mid-career professionals and presenting findings to the department faculty. She interned at a local newspaper, where she wrote feature stories and helped the editorial team plan their weekly content calendar. Outside university, she mentored three younger students from her hometown who were preparing for university admission tests. She was active in the university's cultural club, performing in annual stage productions and helping backstage with set design. She graduated with a GPA of 3.5 out of 4.0.`,
  },
];

export function biographyById(id: string): Biography | undefined {
  return BIOGRAPHIES.find((b) => b.id === id);
}
