// "Build with Claude": makes a prompt the teacher pastes into Claude,
// then turns Claude's reply back into a question bank.
import { normalizeBank } from './banks.js?v=20261009233647';

export const TEMPLATE = `You are an expert [TEACHER] writing quiz questions for a fast classroom game called "Chickens vs Turkeys". Students answer on phones in about 20 seconds per question.

SOURCE: [TOPIC]
(If SOURCE says "ATTACHMENT": use ONLY the attached file. Focus on [PAGES]. Do not use facts that are not in those pages. If you cannot read the attachment, say so and stop.)
CURRICULUM: [CURRICULUM]
SUBJECT / LEARNING AREA: [SUBJECT]
YEAR LEVEL / AGE: [YEAR LEVEL]
NUMBER OF QUESTIONS: [NUMBER]
DIFFICULTY MIX: [DIFFICULTY]  (Balanced = about 30% recall, 50% understanding, 20% apply/reason)
QUESTION TYPES: [TYPES]
EXTRA FOCUS: [FOCUS]

RULES
1. Each question has exactly ONE clearly correct answer. No "all/none of the above", no trick wording, no negatives like "Which is NOT…" unless essential.
2. Multiple choice ("mc") has exactly 4 options. True/False ("tf") options are exactly ["True","False"].
3. Match what [CURRICULUM] expects students to know at this level (content, vocabulary, units and methods).
4. Wrong options (distractors) must be believable and based on common misconceptions for this age group.
5. Keep the question under 140 characters and each option under 60 characters (they appear on phone buttons).
6. Vary the position of the correct answer across questions.
7. "explanation": 1–2 short sentences a [YEAR LEVEL] student understands, saying WHY the answer is right.
8. "strand": choose the best-fitting [CURRICULUM SHORT] strand from this list ONLY: [STRAND LIST]
9. "difficulty": 1 = recall, 2 = understanding, 3 = apply/reason.
10. "page": the page number the question comes from when using an attachment, otherwise null.
11. Use [SPELLING] spelling. [CONTEXT]
12. Age-appropriate content only.

OUTPUT
Reply with ONLY one JSON code block, nothing before or after it, in exactly this format:
{
  "cvtBank": 1,
  "title": "short title",
  "curriculum": "[CURRICULUM ID]",
  "subject": "[SUBJECT]",
  "yearLevels": [numbers],
  "source": "topic, or file name + pages used",
  "strands": [the strands you used],
  "questions": [
    {
      "id": "q1",
      "type": "mc",
      "q": "question text",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "why the answer is right",
      "strand": "one strand from the list",
      "difficulty": 1,
      "page": null,
      "seconds": 20,
      "tags": ["keyword"]
    }
  ]
}
"correct" is the 0-based index of the right option. Number ids q1, q2, q3…`;

export const DIFFICULTY = {
  easy: 'Easy (mostly recall and understanding)',
  balanced: 'Balanced',
  challenging: 'Challenging (more apply/reason questions)',
};
export const TYPES = {
  mc: 'Multiple choice only',
  mix: 'Mostly multiple choice, about 1 in 5 True/False',
};

/** Fill the template from the form values. */
export function buildPrompt(o, strandsMap, cur = {}) {
  const strands = (strandsMap?.[o.subject] || ['General']).join(' | ');
  const topic = o.source === 'attachment' ? 'ATTACHMENT' : (o.topic || '[TOPIC]');
  const pages = o.source === 'attachment' ? (o.pages?.trim() || 'the whole file') : 'n/a';
  return TEMPLATE
    .replaceAll('[TEACHER]', cur.teacher || 'New Zealand primary/intermediate teacher')
    .replaceAll('[CURRICULUM ID]', o.curriculum || 'nz')
    .replaceAll('[CURRICULUM SHORT]', cur.short || 'NZ')
    .replaceAll('[CURRICULUM]', cur.name || 'the New Zealand Curriculum')
    .replaceAll('[SPELLING]', cur.spelling || 'New Zealand English')
    .replaceAll('[CONTEXT]', cur.context || 'Use te reo Māori words with correct macrons where appropriate. Be culturally respectful.')
    .replaceAll('[TOPIC]', topic)
    .replaceAll('[PAGES]', pages)
    .replaceAll('[SUBJECT]', o.subject || '[SUBJECT]')
    .replaceAll('[YEAR LEVEL]', o.yearLevel || '[YEAR LEVEL]')
    .replaceAll('[NUMBER]', String(o.count || 20))
    .replaceAll('[DIFFICULTY]', DIFFICULTY[o.difficulty] || DIFFICULTY.balanced)
    .replaceAll('[TYPES]', TYPES[o.types] || TYPES.mc)
    .replaceAll('[FOCUS]', o.focus?.trim() || 'none')
    .replaceAll('[STRAND LIST]', strands);
}

/** Find and parse the JSON bank inside whatever the teacher pasted. */
export function extractBank(text) {
  if (!text || !text.trim()) throw new Error('Paste Claude\'s reply first.');
  let t = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1];
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Couldn\'t find the questions in that text. Make sure you copied Claude\'s whole reply (the part inside the code box).');
  let body = t.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1');
  let obj;
  try { obj = JSON.parse(body); } catch (e) {
    throw new Error('The reply looks cut off or broken (' + e.message + '). Ask Claude: "Please resend the complete JSON code block."');
  }
  if (Array.isArray(obj)) obj = { questions: obj };
  if (!obj.questions || !Object.values(obj.questions).length) throw new Error('No questions found in the reply.');
  return normalizeBank(obj);
}
