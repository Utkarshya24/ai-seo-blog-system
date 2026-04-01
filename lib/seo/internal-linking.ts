interface CandidateTarget {
  postId: string;
  slug: string;
  title: string;
  keyword?: string;
  content?: string;
  metaDescription?: string;
}

interface ScoredTarget extends CandidateTarget {
  score: number;
  anchorText: string;
}

interface InsertedLink {
  postId: string;
  slug: string;
  anchorText: string;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'your', 'about', 'how',
  'what', 'when', 'where', 'which', 'while', 'will', 'can', 'you', 'are', 'was', 'were',
  'have', 'has', 'had', 'not', 'but', 'use', 'using', 'via', 'guide', 'best', 'tips',
]);

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenize(input: string): string[] {
  return (input.toLowerCase().match(/[a-z0-9]+/g) || []).filter(
    (token) => token.length > 2 && !STOP_WORDS.has(token)
  );
}

function keywordPhrases(title: string, keyword?: string): string[] {
  const phrases = [keyword?.trim() || '', title.trim()].filter(Boolean);
  const all = new Set<string>();

  for (const phrase of phrases) {
    all.add(phrase);
    const tokens = tokenize(phrase);
    for (let i = 0; i < tokens.length - 1; i += 1) {
      const bigram = `${tokens[i]} ${tokens[i + 1]}`;
      if (bigram.length >= 7) all.add(bigram);
    }
  }

  return [...all].filter((p) => p.length >= 4);
}

function overlapScore(sourceText: string, candidate: CandidateTarget): { score: number; anchorText: string } {
  const sourceTokens = new Set(tokenize(sourceText));
  const candidateTokens = new Set(tokenize(`${candidate.title} ${candidate.keyword || ''}`));

  let overlap = 0;
  for (const token of candidateTokens) {
    if (sourceTokens.has(token)) overlap += 1;
  }

  const anchorText = candidate.keyword?.trim() || candidate.title.trim();
  return { score: overlap, anchorText };
}

export function suggestInternalLinks(params: {
  sourceTitle: string;
  sourceKeyword?: string;
  sourceContent: string;
  candidates: CandidateTarget[];
  limit?: number;
}): ScoredTarget[] {
  const { sourceTitle, sourceKeyword, sourceContent, candidates, limit = 12 } = params;

  const sourceText = `${sourceTitle} ${sourceKeyword || ''} ${sourceContent.slice(0, 6000)}`;
  const scored = candidates
    .map((candidate) => {
      const { score, anchorText } = overlapScore(sourceText, candidate);
      return { ...candidate, score, anchorText };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

function replaceFirstOccurrence(content: string, phrase: string, slug: string): string {
  const regex = new RegExp(`\\b(${escapeRegex(phrase)})\\b`, 'i');
  const linked = `[$1](/blog/${slug})`;
  return content.replace(regex, linked);
}

export function autoInsertInternalLinks(params: {
  content: string;
  candidates: CandidateTarget[];
  maxLinks?: number;
}): { content: string; insertedLinks: InsertedLink[] } {
  const { candidates, maxLinks = 3 } = params;
  let { content } = params;

  const insertedLinks: InsertedLink[] = [];
  for (const candidate of candidates) {
    if (insertedLinks.length >= maxLinks) break;
    if (content.includes(`(/blog/${candidate.slug})`)) continue;

    const phrases = keywordPhrases(candidate.title, candidate.keyword);
    let replaced = false;

    for (const phrase of phrases) {
      if (!phrase || phrase.length < 4) continue;
      const next = replaceFirstOccurrence(content, phrase, candidate.slug);
      if (next !== content) {
        content = next;
        insertedLinks.push({
          postId: candidate.postId,
          slug: candidate.slug,
          anchorText: phrase,
        });
        replaced = true;
        break;
      }
    }

    if (!replaced) continue;
  }

  return { content, insertedLinks };
}
