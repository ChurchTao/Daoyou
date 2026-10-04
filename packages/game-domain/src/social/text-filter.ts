import { z } from 'zod';

const dictionarySchema = z
  .object({
    blockedWords: z.array(z.string()),
    allowedPhrases: z.array(z.string()),
  })
  .strict();

const invisibleCharacters = new Set([
  '\u200b',
  '\u200c',
  '\u200d',
  '\u2060',
  '\ufeff',
]);
const separators = new Set([' ', '.', '·', '_', '-']);

interface TrieNode {
  children: Map<string, TrieNode>;
  terminal: boolean;
}

interface Token {
  character: string;
  originalIndex: number;
}

interface Match {
  start: number;
  end: number;
}

export interface TextFilterResult {
  text: string;
  changed: boolean;
}

function normalizeCharacter(character: string): string {
  const code = character.codePointAt(0)!;
  if (code >= 0xff01 && code <= 0xff5e) {
    character = String.fromCodePoint(code - 0xfee0);
  } else if (code === 0x3000) {
    character = ' ';
  }
  // Only ASCII case folding: never expand one code point into several.
  return /^[A-Z]$/.test(character) ? character.toLowerCase() : character;
}

function validateWords(words: string[], label: string): Set<string> {
  const normalized = new Set<string>();
  for (const [index, word] of words.entries()) {
    const characters = Array.from(word, normalizeCharacter);
    const value = characters.join('');
    if (
      !value.trim() ||
      value !== value.trim() ||
      characters.some(
        (character) => invisibleCharacters.has(character) || character === '*',
      )
    ) {
      throw new Error(
        `${label}[${index}]：词条不能为空、包含零宽字符或星号，也不能有首尾空白`,
      );
    }
    if (normalized.has(value)) {
      throw new Error(`${label}[${index}]：规范化后重复的词条 ${word}`);
    }
    normalized.add(value);
  }
  return normalized;
}

function buildTrie(words: Set<string>): TrieNode {
  const root: TrieNode = { children: new Map(), terminal: false };
  for (const word of words) {
    let node = root;
    for (const character of word) {
      let child = node.children.get(character);
      if (!child) {
        child = { children: new Map(), terminal: false };
        node.children.set(character, child);
      }
      node = child;
    }
    node.terminal = true;
  }
  return root;
}

function findMatches(
  tokens: Token[],
  root: TrieNode,
  skipSeparators: boolean,
): Match[] {
  const matches: Match[] = [];
  for (let start = 0; start < tokens.length; start++) {
    let node = root;
    let skipped = 0;
    for (let end = start; end < tokens.length; end++) {
      const token = tokens[end];
      if (skipSeparators && separators.has(token.character)) {
        if (end === start || ++skipped > 1) break;
        continue;
      }
      const child = node.children.get(token.character);
      if (!child) break;
      node = child;
      skipped = 0;
      if (node.terminal) {
        matches.push({
          start: tokens[start].originalIndex,
          end: token.originalIndex + 1,
        });
      }
    }
  }
  return matches;
}

/** Builds an immutable matcher; callers own dictionary loading and business validation. */
export function createTextFilter(input: unknown): {
  mask(text: string): TextFilterResult;
} {
  const dictionary = dictionarySchema.parse(input);
  const blockedWords = validateWords(dictionary.blockedWords, 'blockedWords');
  const allowedPhrases = validateWords(
    dictionary.allowedPhrases,
    'allowedPhrases',
  );
  for (const phrase of allowedPhrases) {
    if (blockedWords.has(phrase)) {
      throw new Error(`词条同时出现在屏蔽词和例外词中：${phrase}`);
    }
  }
  const blockedTrie = buildTrie(blockedWords);
  const allowedTrie = buildTrie(allowedPhrases);

  return {
    mask(text) {
      if (!blockedWords.size || !text) return { text, changed: false };
      const original = Array.from(text);
      const tokens = original.map((character, originalIndex) => ({
        character: normalizeCharacter(character),
        originalIndex,
      }));
      const searchable = tokens.filter(
        (token) => !invisibleCharacters.has(token.character),
      );
      const matches = [
        ...findMatches(searchable, blockedTrie, false),
        ...findMatches(searchable, blockedTrie, true),
      ];

      // For each position, retain the furthest end of a containing allowed phrase.
      // Allowed phrases use continuous text, without removing invisible characters.
      const allowedEnds = new Array<number>(original.length).fill(0);
      for (const match of findMatches(tokens, allowedTrie, false)) {
        allowedEnds[match.start] = Math.max(
          allowedEnds[match.start],
          match.end,
        );
      }
      for (let index = 1; index < allowedEnds.length; index++) {
        allowedEnds[index] = Math.max(
          allowedEnds[index],
          allowedEnds[index - 1],
        );
      }

      // Difference counts merge overlapping matches without repeated range writes.
      const coverage = new Array<number>(original.length + 1).fill(0);
      let changed = false;
      for (const match of matches) {
        if (allowedEnds[match.start] >= match.end) continue;
        coverage[match.start]++;
        coverage[match.end]--;
        changed = true;
      }
      if (!changed) return { text, changed: false };
      let active = 0;
      return {
        text: original
          .map((character, index) => {
            active += coverage[index];
            return active > 0 ? '*' : character;
          })
          .join(''),
        changed: true,
      };
    },
  };
}
