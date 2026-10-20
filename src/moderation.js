// =============================================================================
// Wuskaloosa Report — Comment Moderation (CLIENT copy)
// =============================================================================
// This powers the real-time "this may violate posting rules" warning shown
// while someone is typing a comment, so the Post button disables immediately.
// It is NOT authoritative — a person could disable JavaScript and bypass it,
// which is exactly why worker/moderation.js re-checks every comment on the
// server before it is ever stored. Treat this file as a convenience UX layer.
//
// A near-identical copy lives at worker/moderation.js. Keep the two files in
// sync: whenever you edit a list here, make the same edit there (and vice
// versa). The `moderate()` function itself should stay identical between the
// two files.
//
// HOW TO EDIT:
//   - Add or remove single words/phrases from the arrays below — one per line
//     is easiest to scan. Matching is case-insensitive and punctuation-tolerant.
//   - `political.phrases` uses multi-word phrases on purpose (per Austin's
//     request) so that an innocent word like "president" used in a non-political
//     sentence is never blocked on its own.
//   - To swap in an external moderation API later, replace the body of
//     `moderate()` with a call to that API and keep the same return shape:
//     { allowed, reason, category }.
// =============================================================================

export const MODERATION_CONFIG = {
  // Common profanity / vulgar language
  profanity: [
    'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dumbass', 'piss off',
    'dipshit', 'motherfucker', 'twat', 'cunt', 'douchebag', 'cock', 'dick',
    'wanker', 'prick',
  ],

  // Slurs / discriminatory language — never shown back to the user verbatim,
  // only used to reject the comment with a generic "review the guidelines" message.
  slurs: [
    'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded', 'spic', 'chink',
    'gook', 'kike', 'tranny', 'wetback', 'coon', 'beaner',
  ],

  // Sexually explicit / inappropriate content
  sexual: [
    'porn', 'pornhub', 'xvideos', 'nude pics', 'nudes', 'send nudes',
    'onlyfans', 'sex tape', 'blowjob', 'handjob', 'anal sex', 'cum shot',
  ],

  // Threatening language
  threats: [
    'i will kill you', "i'll kill you", 'i will hurt you', "i'll hurt you",
    'i will beat you', "i'll beat you", 'kill yourself', 'kys',
    'i know where you live', "you're dead", 'youre dead', "i'll find you",
    'i will find you and',
  ],

  // Political discussion / partisan commentary — deliberately MULTI-WORD
  // phrases so ordinary words (president, election, vote, policy, etc.) are
  // never blocked on their own. Only matches when the phrase itself appears.
  political: {
    phrases: [
      'vote for trump', 'vote for biden', 'vote for harris', 'vote republican',
      'vote democrat', 'maga', 'make america great again', 'the democrats are',
      'the republicans are', 'liberal agenda', 'conservative agenda',
      'stolen election', 'election fraud', 'election was rigged',
      'impeach trump', 'impeach biden', 'gun control', 'pro-choice',
      'pro-life', 'abortion rights', 'defund the police', 'build the wall',
      'illegal immigrants are', 'critical race theory', 'woke agenda',
      'deep state', 'fake news media', 'climate change hoax',
      'second amendment rights', 'trump supporters', 'biden supporters',
      'democrat party', 'republican party', 'left-wing', 'right-wing',
      'political party', 'presidential election', 'political candidate',
    ],
  },

  // Harassment / personal-attack phrase fragments (in addition to profanity
  // above, which also commonly shows up in harassment)
  harassment: [
    'you are stupid', "you're stupid", 'you are an idiot', "you're an idiot",
    'nobody likes you', 'shut up and', 'get a life', 'you are pathetic',
    "you're pathetic", 'you are worthless', "you're worthless",
  ],

  // Spam indicators
  spam: {
    phrases: [
      'buy now', 'click here', 'free money', 'work from home opportunity',
      'dm me for', 'check out my page', 'follow me on', 'subscribe to my',
      'make money fast', 'click this link', 'limited time offer',
      'act now', 'www.', 'bit.ly',
    ],
    maxLinks: 2,            // more than this many URLs in one comment = spam
    blockedDomains: [],      // add specific spammy domains here, e.g. 'spamsite.com'
  },
};

// Escape a string for safe use inside a RegExp
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Does `text` contain `phrase` as a whole phrase (word-boundary aware)?
function containsPhrase(text, phrase) {
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(phrase)}(?:$|[^a-z0-9])`, 'i');
  return pattern.test(` ${text} `);
}

function countLinks(text) {
  const matches = text.match(/\bhttps?:\/\/\S+|\bwww\.\S+/gi);
  return matches ? matches.length : 0;
}

/**
 * Check a name + comment body against the moderation rules.
 * Returns { allowed: boolean, reason: string|null, category: string|null }
 */
export function moderate(name, body) {
  const text = `${name || ''} ${body || ''}`.toLowerCase().trim();

  if (!text) {
    return { allowed: false, reason: 'Comment cannot be empty.', category: 'empty' };
  }

  for (const term of MODERATION_CONFIG.slurs) {
    if (containsPhrase(text, term)) {
      return { allowed: false, reason: 'This comment may violate Wuskaloosa’s posting rules. Please review the guidelines and edit your comment before posting.', category: 'slurs' };
    }
  }
  for (const term of MODERATION_CONFIG.threats) {
    if (containsPhrase(text, term)) {
      return { allowed: false, reason: 'This comment may violate Wuskaloosa’s posting rules. Please review the guidelines and edit your comment before posting.', category: 'threats' };
    }
  }
  for (const term of MODERATION_CONFIG.sexual) {
    if (containsPhrase(text, term)) {
      return { allowed: false, reason: 'This comment may violate Wuskaloosa’s posting rules. Please review the guidelines and edit your comment before posting.', category: 'sexual' };
    }
  }
  for (const term of MODERATION_CONFIG.harassment) {
    if (containsPhrase(text, term)) {
      return { allowed: false, reason: 'This comment may violate Wuskaloosa’s posting rules. Please review the guidelines and edit your comment before posting.', category: 'harassment' };
    }
  }
  for (const term of MODERATION_CONFIG.profanity) {
    if (containsPhrase(text, term)) {
      return { allowed: false, reason: 'This comment may violate Wuskaloosa’s posting rules. Please review the guidelines and edit your comment before posting.', category: 'profanity' };
    }
  }
  for (const phrase of MODERATION_CONFIG.political.phrases) {
    if (containsPhrase(text, phrase)) {
      return { allowed: false, reason: 'This comment may violate Wuskaloosa’s posting rules. Please review the guidelines and edit your comment before posting.', category: 'political' };
    }
  }
  for (const phrase of MODERATION_CONFIG.spam.phrases) {
    if (containsPhrase(text, phrase)) {
      return { allowed: false, reason: 'This comment may violate Wuskaloosa’s posting rules. Please review the guidelines and edit your comment before posting.', category: 'spam' };
    }
  }
  if (countLinks(text) > MODERATION_CONFIG.spam.maxLinks) {
    return { allowed: false, reason: 'This comment may violate Wuskaloosa’s posting rules. Please review the guidelines and edit your comment before posting.', category: 'spam' };
  }
  for (const domain of MODERATION_CONFIG.spam.blockedDomains) {
    if (text.includes(domain.toLowerCase())) {
      return { allowed: false, reason: 'This comment may violate Wuskaloosa’s posting rules. Please review the guidelines and edit your comment before posting.', category: 'spam' };
    }
  }

  return { allowed: true, reason: null, category: null };
}
