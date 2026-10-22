/**
 * ClearVoice AI — Curriculum content: intermediate sentence bank & exercise catalog.
 * Difficulty locked at Intermediate (B1–B2): multisyllabic targets, tricky clusters,
 * thought-group phrasing, schwa reduction.
 */

export const SENTENCES = [
  // Th sounds
  { id: 's01', text: 'The thorough analysis requires extraordinary attention to detail and discipline.', focus: 'th-sound', difficulty: 5 },
  { id: 's02', text: 'They thought the thorough drought through, though the throughway flooded.', focus: 'th-sound', difficulty: 4 },
  { id: 's03', text: 'Three free throws before the final buzzer sealed the team’s victory.', focus: 'th-sound', difficulty: 4 },
  { id: 's04', text: 'Neither the northern nor the southern route through the theatre is worth the risk.', focus: 'th-sound', difficulty: 5 },
  // R / L contrasts
  { id: 's05', text: 'Rural jurors rarely quarrel with rural murmurs near rural libraries.', focus: 'r-l', difficulty: 5 },
  { id: 's06', text: 'Little Luca loves lolling by the lotus lake on lazy summer mornings.', focus: 'r-l', difficulty: 4 },
  { id: 's07', text: 'Very few rivals review every vigorous revival with genuine rigor.', focus: 'r-l', difficulty: 4 },
  // Endings & clusters
  { id: 's08', text: 'Sarah sells sea shells while the sixth sunbeam slips through the season.', focus: 'endings', difficulty: 4 },
  { id: 's09', text: 'Which wristwatch will the witch wear at the whisk festival this weekend.', focus: 'endings', difficulty: 5 },
  { id: 's10', text: 'Last lists of lost lasts lasted less than the least last lessened last spring.', focus: 'endings', difficulty: 5 },
  // Schwa & reduction
  { id: 's11', text: 'Comfortable silence teaches more discipline than constant chatter.', focus: 'schwa', difficulty: 4 },
  { id: 's12', text: 'A separate temperate climate alters the general character of a traveler.', focus: 'schwa', difficulty: 5 },
  { id: 's13', text: 'The photographer photographed a paragraph about photography for the geographer.', focus: 'schwa', difficulty: 5 },
  // Multisyllabic stress
  { id: 's14', text: 'Precise pronunciation practice prevents perplexing prosody problems.', focus: 'stress', difficulty: 5 },
  { id: 's15', text: 'Her pleasant prairie practice produced promising progress practically overnight.', focus: 'stress', difficulty: 5 },
  { id: 's16', text: 'The entrepreneur’s enterprise entertained extraordinary environmental experts.', focus: 'stress', difficulty: 5 },
  { id: 's17', text: 'Recognizing the recommendation, the representative registered the refrigerator.', focus: 'stress', difficulty: 5 },
  { id: 's18', text: 'Particularly particular participants participated enthusiastically throughout the symposium.', focus: 'stress', difficulty: 5 },
  // Rhythm & flow
  { id: 's19', text: 'Through the thrift shop, the thoroughbred galloped over rough terrain.', focus: 'flow', difficulty: 4 },
  { id: 's20', text: 'Unique New York units unite undulating united youth unions underneath.', focus: 'flow', difficulty: 5 },
  { id: 's21', text: 'She sells seashells by the seashore and she surely sells seashore shells.', focus: 'flow', difficulty: 4 },
  { id: 's22', text: 'Never trouble about trouble until trouble troubles you.', focus: 'flow', difficulty: 3 },
  { id: 's23', text: 'The weather in the northern hemisphere can be surprisingly temperamental in April.', focus: 'flow', difficulty: 4 },
  { id: 's24', text: 'Around a rugged rock the ragged rascal ran raucously.', focus: 'flow', difficulty: 3 },
  // Thought groups / prosody
  { id: 's25', text: 'Although the proposal was ambitious, the committee approved it unanimously.', focus: 'prosody', difficulty: 4 },
  { id: 's26', text: 'Once the data arrived, we realized the forecast had been far too optimistic.', focus: 'prosody', difficulty: 4 },
  { id: 's27', text: 'Because the signal was weak, the engineers decided to reroute the connection.', focus: 'prosody', difficulty: 4 },
  { id: 's28', text: 'If the rehearsal runs late, please wait in the lobby for further instructions.', focus: 'prosody', difficulty: 3 },
];

export const EXERCISES = [
  // ── Articulation Drills ──────────────────────────────
  {
    id: 'minimal-pair-th-s',
    category: 'Articulation',
    title: 'Th vs S — Minimal Pairs',
    description: 'Train the interdental /θ/–/ð/ against /s/ and /z/: the classic intermediate substitution.',
    difficulty: 'Intermediate',
    xp: 120,
    sounds: ['think / sink', 'thigh / sigh', 'three / free', 'breathe / breeze'],
    pairs: [
      { left: 'think', right: 'sink' }, { left: 'thick', right: 'sick' },
      { left: 'thistle', right: 'sizzle' }, { left: 'thumb', right: 'sum' },
      { left: 'thank', right: 'sank' }, { left: 'faith', right: 'face' },
    ],
    tip: 'Tongue tip lightly between the teeth; air glides over it. Never let the tongue hide behind the lower teeth.',
    color: 'gold',
  },
  {
    id: 'minimal-pair-r-l',
    category: 'Articulation',
    title: 'R vs L — Liquid Mastery',
    description: 'Separate American /r/ (tongue bunched or retroflex) from /l/ (tongue tip at the alveolar ridge).',
    difficulty: 'Intermediate',
    xp: 120,
    sounds: ['right / light', 'rock / lock', 'crown / clown'],
    pairs: [
      { left: 'right', right: 'light' }, { left: 'road', right: 'load' },
      { left: 'crown', right: 'clown' }, { left: 'pray', right: 'play' },
      { left: 'river', right: 'liver' }, { left: 'glass', right: 'grass' },
    ],
    tip: 'For /r/, lips rounded, tongue pulled back and bunched — no contact. For /l/, tongue tip firmly touches right behind the teeth.',
    color: 'violet',
  },
  {
    id: 'endings-clusters',
    category: 'Articulation',
    title: 'Final Clusters & Endings',
    description: 'Land past-tense /t/ and /d/, plural /s/ and /z/, and crunchy clusters like /ksts/ and /sks/.',
    difficulty: 'Intermediate',
    xp: 140,
    sounds: ['sixths', 'texts', 'masked', 'glimpsed'],
    pairs: [
      { left: 'texts', right: 'textures' }, { left: 'masked', right: 'mast' },
      { left: 'asked', right: 'ashed' }, { left: 'glimpsed', right: 'glimpsing' },
      { left: 'sixth', right: 'six' }, { left: 'helped', right: 'held' },
    ],
    tip: 'Divide clusters into two beats — “tek-sts” — then compress. Never trade the final consonant for a schwa.',
    color: 'gold',
  },
  // ── Vowel Precision ──────────────────────────────────
  {
    id: 'vowel-reduction-schwa',
    category: 'Vowels',
    title: 'The Schwa — Stress & Reduction',
    description: 'English is stress-timed: weak syllables collapse to /ə/. Contrast full vs reduced vowels in rhythm.',
    difficulty: 'Intermediate',
    xp: 110,
    sounds: ['photograph vs photographer', 'record (n) vs record (v)', 'comfortable'],
    pairs: [
      { left: 'PHOtograph', right: 'phoTOgrapher' }, { left: 'comFORTable', right: 'comfort' },
      { left: 'SEparate (adj)', right: 'sePARate (v)' }, { left: 'REcord (n)', right: 'reCORD (v)' },
    ],
    tip: 'Say the stressed beat louder, longer, higher. Everything else gets lazy and dark — that’s correct, not sloppy.',
    color: 'violet',
  },
  {
    id: 'vowel-length-contrasts',
    category: 'Vowels',
    title: 'Ship / Sheep — Vowel Length',
    description: 'Disciplined length control for /ɪ/ vs /iː/ and /ʊ/ vs /uː/, with the glide discipline of diphthongs.',
    difficulty: 'Intermediate',
    xp: 100,
    sounds: ['ship / sheep', 'full / fool', 'live / leave'],
    pairs: [
      { left: 'ship', right: 'sheep' }, { left: 'live', right: 'leave' },
      { left: 'full', right: 'fool' }, { left: 'pull', right: 'pool' },
      { left: 'bit', right: 'beat' }, { left: 'cut', right: 'cart' },
    ],
    tip: 'Hold the long vowel exactly twice as long, then check with minimal pairs at half speed before full speed.',
    color: 'gold',
  },
  // ── Word Stress & Rhythm ──────────────────────────────
  {
    id: 'stress-multisyllabic',
    category: 'Rhythm',
    title: 'Multisyllabic Word Stress',
    description: 'Place the primary beat on 4–6 syllable words — the biggest predictor of native-like intelligibility.',
    difficulty: 'Intermediate',
    xp: 150,
    sounds: ['pronunciation', 'entrepreneur', 'particularly', 'environmental'],
    pairs: [
      { left: 'pronuncIAtion', right: '—' }, { left: 'entrepreNEUR', right: '—' },
      { left: 'parTICularly', right: '—' }, { left: 'enviRONmental', right: '—' },
    ],
    tip: 'Mark the stressed vowel in capitals, clap once on it, and let the rest of the word fall away rhythmically.',
    color: 'violet',
  },
  {
    id: 'sentence-stress',
    category: 'Rhythm',
    title: 'Sentence Stress & Content Words',
    description: 'Punch the content words (nouns, verbs, adjectives); glide through function words.',
    difficulty: 'Intermediate',
    xp: 130,
    sounds: ['content vs function words', 'contrastive stress'],
    pairs: [
      { left: 'She didn’t STEAL it', right: 'She didn’t steal IT' },
      { left: 'I said REcord, not reCORD', right: '—' },
    ],
    tip: 'Try saying the sentence twice, moving the stress to a different content word — notice how the meaning pivots.',
    color: 'gold',
  },
  // ── Fluency & Phrasing ────────────────────────────────
  {
    id: 'thought-groups',
    category: 'Fluency',
    title: 'Thought Groups & Pausing',
    description: 'Chunk long sentences into 3–5 word breath groups; pause only at punctuation logic.',
    difficulty: 'Intermediate',
    xp: 120,
    sounds: ['breath groups', 'comma pausing', 'boundary lengthening'],
    pairs: [
      { left: 'Although the proposal was ambitious, / the committee approved it unanimously.', right: '2 breath groups' },
      { left: 'Once the data arrived, / we realized / the forecast was too optimistic.', right: '3 breath groups' },
    ],
    tip: 'Read the sentence with slashes marked in, pause half a beat at each slash, and lengthen the final syllable before it.',
    color: 'violet',
  },
  {
    id: 'intonation-clauses',
    category: 'Fluency',
    title: 'Intonation Across Clauses',
    description: 'Rise on incomplete clauses, fall on completed statements — the melody of competent English.',
    difficulty: 'Intermediate',
    xp: 110,
    sounds: ['falling statements', 'rising dependent clauses', 'list intonation'],
    pairs: [
      { left: 'If you finish early, ↗ let me know ↘.', right: 'rise → fall' },
      { left: 'We bought apples, ↗ pears, ↗ and plums ↘.', right: 'rise, rise, fall' },
    ],
    tip: 'Hum the melody before speaking the words — “da da DA da, da DA da DA da” — then graft the words on.',
    color: 'gold',
  },
  {
    id: 'tongue-twister-flow',
    category: 'Fluency',
    title: 'Velocity Twisters',
    description: 'Precision under pressure: medium-speed twisters that keep articulation crisp at pace.',
    difficulty: 'Intermediate',
    xp: 90,
    sounds: ['articulation at pace', 'crisp consonants'],
    pairs: [
      { left: 'She sells seashells by the seashore.', right: 'sibilants' },
      { left: 'Which wristwatch will the witch wear?', right: 'wh / w' },
      { left: 'Unique New York units unite.', right: 'u glide' },
    ],
    tip: 'Start at 60% speed with surgical consonants; add 10% per clean pass. Speed is the reward for precision, not the goal.',
    color: 'violet',
  },
  {
    id: 'connected-speech',
    category: 'Fluency',
    title: 'Linking & Connected Speech',
    description: 'Native flow: consonant-to-vowel linking, intrusion, weak forms, and elision between words.',
    difficulty: 'Intermediate',
    xp: 140,
    sounds: ['consonant–vowel linking', 'weak forms', 'elision'],
    pairs: [
      { left: 'an apple → a-nap-ple', right: 'link' },
      { left: 'want to → wanna (careful register)', right: 'reduction' },
      { left: 'next time → nex-time', right: 'elision' },
    ],
    tip: 'Glue every consonant ending directly onto the next vowel-starting word — English has no real word boundaries at speed.',
    color: 'gold',
  },
];

export function recommendationPool(weakWords = []) {
  const pool = [
    'Shadow the model voice: play the reference 3×, then echo within one beat. Match rhythm first, then polish segments.',
    'Record yourself reading the same sentence twice — the second pass after listening is where 80% of the learning happens.',
    'Speak into the glass: watch your jaw and lips in a mirror. Clarity lives or dies in visible articulation.',
  ];
  if (weakWords.length) {
    pool.unshift(`Your current pressure points are ${weakWords.slice(0, 3).join(', ')} — isolate one per session and drill it for two minutes before the full sentence.`);
  }
  return pool;
}
