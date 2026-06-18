interface DateRule {
  pattern: RegExp;
  getDate: (matches: RegExpExecArray) => Date;
  isExplicit?: boolean;
}

const formatDate = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getRules = (locale: string): DateRule[] => {
  const isDe = locale === 'de';

  const rules: DateRule[] = [
    // 1. Explicit dates (German/European style): 21.5.2026, 21.5.26, 21.5.
    {
      pattern: /(?:^|\s)(\d{1,2})\.(\d{1,2})\.(?:(\d{4}|\d{2}))?(?=\s|$)/i,
      getDate: (match) => {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        let year = match[3] ? parseInt(match[3], 10) : null;

        const now = new Date();
        if (year === null) {
          year = now.getFullYear();
          const target = new Date(year, month - 1, day);
          const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (target < todayZero) {
            target.setFullYear(year + 1);
          }
          return target;
        } else {
          if (year < 100) {
            year += 2000;
          }
          return new Date(year, month - 1, day);
        }
      },
      isExplicit: true,
    },
    // 2. Explicit dates (US style, slash): 5/21/2026, 5/21/26, 5/21
    {
      pattern: /(?:^|\s)(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?(?=\s|$)/i,
      getDate: (match) => {
        const month = parseInt(match[1], 10);
        const day = parseInt(match[2], 10);
        let year = match[3] ? parseInt(match[3], 10) : null;

        const now = new Date();
        if (year === null) {
          year = now.getFullYear();
          const target = new Date(year, month - 1, day);
          const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (target < todayZero) {
            target.setFullYear(year + 1);
          }
          return target;
        } else {
          if (year < 100) {
            year += 2000;
          }
          return new Date(year, month - 1, day);
        }
      },
      isExplicit: true,
    },
    // 3. Today / Heute
    {
      pattern: isDe ? /(?:^|\s)(heute|heu)(?=\s|$)/i : /(?:^|\s)(today|tod)(?=\s|$)/i,
      getDate: () => new Date(),
    },
    // 4. Tomorrow / Morgen
    {
      pattern: isDe ? /(?:^|\s)(morgen|mor)(?=\s|$)/i : /(?:^|\s)(tomorrow|tom)(?=\s|$)/i,
      getDate: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d;
      },
    },
    // 5. Next week / Nächste Woche
    {
      pattern: isDe ? /(?:^|\s)(n\u00e4chste woche|n\u00e4c)(?=\s|$)/i : /(?:^|\s)(next week|nex)(?=\s|$)/i,
      getDate: () => {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return d;
      },
    },
    // 6. Next month / Nächster Monat
    {
      pattern: isDe ? /(?:^|\s)(n\u00e4chster monat|nmo)(?=\s|$)/i : /(?:^|\s)(next month|nmt)(?=\s|$)/i,
      getDate: () => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d;
      },
    },
  ];

  // Weekdays
  const weekdays = isDe
    ? [
        { name: 'sonntag', abbr: 'so', day: 0 },
        { name: 'montag', abbr: 'mo', day: 1 },
        { name: 'dienstag', abbr: 'di', day: 2 },
        { name: 'mittwoch', abbr: 'mi', day: 3 },
        { name: 'donnerstag', abbr: 'do', day: 4 },
        { name: 'freitag', abbr: 'fr', day: 5 },
        { name: 'samstag', abbr: 'sa', day: 6 },
      ]
    : [
        { name: 'sunday', abbr: 'sun', day: 0 },
        { name: 'monday', abbr: 'mon', day: 1 },
        { name: 'tuesday', abbr: 'tue', day: 2 },
        { name: 'wednesday', abbr: 'wed', day: 3 },
        { name: 'thursday', abbr: 'thu', day: 4 },
        { name: 'friday', abbr: 'fri', day: 5 },
        { name: 'saturday', abbr: 'sat', day: 6 },
      ];

  weekdays.forEach(({ name, abbr, day }) => {
    rules.push({
      pattern: new RegExp(`(?:^|\\s)(${name}|${abbr})(?=\\s|$)`, 'i'),
      getDate: () => {
        const d = new Date();
        const currentDay = d.getDay();
        let diff = day - currentDay;
        if (diff <= 0) {
          diff += 7;
        }
        d.setDate(d.getDate() + diff);
        return d;
      },
    });
  });

  return rules;
};

export function getPlanningDateForDueDate(dueDate: Date, now: Date = new Date()): string {
  const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowZero = new Date(todayZero);
  tomorrowZero.setDate(todayZero.getDate() + 1);

  const targetZero = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

  if (targetZero.getTime() <= todayZero.getTime()) {
    return 'today';
  }
  if (targetZero.getTime() === tomorrowZero.getTime()) {
    return 'tomorrow';
  }

  // Sunday of this week (Monday = 1, Sunday = 7)
  const dayOfWeek = todayZero.getDay() === 0 ? 7 : todayZero.getDay();
  const sundayOfThisWeek = new Date(todayZero);
  sundayOfThisWeek.setDate(todayZero.getDate() + (7 - dayOfWeek));

  if (targetZero.getTime() <= sundayOfThisWeek.getTime()) {
    return 'thisWeek';
  }

  // Last day of this month
  const lastDayOfThisMonth = new Date(todayZero.getFullYear(), todayZero.getMonth() + 1, 0);
  if (targetZero.getTime() <= lastDayOfThisMonth.getTime()) {
    return 'thisMonth';
  }

  // Last day of this year
  const lastDayOfThisYear = new Date(todayZero.getFullYear(), 11, 31);
  if (targetZero.getTime() <= lastDayOfThisYear.getTime()) {
    return 'thisYear';
  }

  return 'sometime';
}

export function parseDateFromTitle(
  title: string,
  locale: string,
  ignoredKeywords?: Set<string>
): { cleanTitle: string; dueDate: string | null; plannedDate: string | null; matchedKeyword: string | null } {
  if (!title) {
    return { cleanTitle: title, dueDate: null, plannedDate: null, matchedKeyword: null };
  }

  const rules = getRules(locale);

  for (const rule of rules) {
    const match = rule.pattern.exec(title);
    if (match) {
      let matchedText = match[0];
      if (matchedText.startsWith(' ')) {
        matchedText = matchedText.substring(1);
      }
      const matchedKeyword = matchedText.trim().toLowerCase();
      if (ignoredKeywords && ignoredKeywords.has(matchedKeyword)) {
        continue;
      }

      const date = rule.getDate(match);
      const dueDate = rule.isExplicit ? formatDate(date) : null;

      // Determine categorical planned date dynamically
      const plannedDate = getPlanningDateForDueDate(date);

      let cleanTitle = title.replace(rule.pattern, ' ');
      cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

      return { cleanTitle, dueDate, plannedDate, matchedKeyword: matchedText };
    }
  }

  return { cleanTitle: title, dueDate: null, plannedDate: null, matchedKeyword: null };
}

export function extractTagsFromTitle(title: string, ignoredKeywords?: Set<string>): { cleanTitle: string; tags: string[] } {
  if (!title) {
    return { cleanTitle: title, tags: [] };
  }

  const tagRegex = /(?:^|\s)#([a-zA-Z0-9\u00C0-\u017F_-]+)(?=\s|$)/g;
  const tags: string[] = [];

  let cleanTitle = title.replace(tagRegex, (fullMatch, tagName) => {
    let matchedText = fullMatch;
    if (matchedText.startsWith(' ')) {
      matchedText = matchedText.substring(1);
    }
    const keyword = matchedText.toLowerCase();
    if (ignoredKeywords && ignoredKeywords.has(keyword)) {
      return fullMatch;
    }
    tags.push(tagName.toLowerCase());
    return ' ';
  });

  cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

  return { cleanTitle, tags };
}

export function extractBucketFromTitle(
  title: string,
  bucketNames: string[],
  ignoredKeywords?: Set<string>
): { cleanTitle: string; bucket: string | null } {
  if (!title || !bucketNames || bucketNames.length === 0) {
    return { cleanTitle: title, bucket: null };
  }

  const bucketRegex = /(?:^|\s)\/([a-zA-Z0-9\u00C0-\u017F_-]+)(?=\s|$)/g;
  let foundBucket: string | null = null;

  let cleanTitle = title.replace(bucketRegex, (fullMatch, name) => {
    let matchedText = fullMatch;
    if (matchedText.startsWith(' ')) {
      matchedText = matchedText.substring(1);
    }
    const keyword = matchedText.toLowerCase();
    if (ignoredKeywords && ignoredKeywords.has(keyword)) {
      return fullMatch;
    }

    const matchedName = name.toLowerCase();
    const matchedBucket = bucketNames.find((b) => b.toLowerCase() === matchedName);
    if (matchedBucket) {
      foundBucket = matchedBucket;
      return fullMatch.startsWith(' ') ? ' ' : '';
    }
    return fullMatch;
  });

  cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

  return { cleanTitle, bucket: foundBucket };
}

export function extractPriorityFromTitle(
  title: string,
  ignoredKeywords?: Set<string>
): { cleanTitle: string; priority: string | null; matchedPriority: string | null } {
  if (!title) {
    return { cleanTitle: title, priority: null, matchedPriority: null };
  }

  // Matches p0, p1, p2, p3, p4 (case-insensitive) optionally slash-prefixed as a standalone word
  const priorityRegex = /(?:^|\s)\/?([pP]([0-4]))(?=\s|$)/;
  const match = priorityRegex.exec(title);

  if (match) {
    let matchedText = match[0];
    if (matchedText.startsWith(' ')) {
      matchedText = matchedText.substring(1);
    }
    const keyword = matchedText.toLowerCase();
    if (ignoredKeywords && ignoredKeywords.has(keyword)) {
      return { cleanTitle: title, priority: null, matchedPriority: null };
    }

    const matchedPriority = match[1]; // e.g. "p1"
    const level = match[2]; // e.g. "1"
    let priorityVal = '';
    if (level === '4') priorityVal = 'low';
    else if (level === '3') priorityVal = 'medium';
    else if (level === '2') priorityVal = 'high';
    else if (level === '1') priorityVal = 'urgent';

    // Remove the keyword from the title
    let cleanTitle = title.replace(priorityRegex, ' ');
    cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

    return { cleanTitle, priority: priorityVal, matchedPriority };
  }

  return { cleanTitle: title, priority: null, matchedPriority: null };
}

export function parseTitleState(
  title: string,
  locale: string,
  bucketNames?: string[],
  ignoredKeywords?: string[] | Set<string>
): {
  cleanTitle: string;
  dueDate: string | null;
  plannedDate: string | null;
  matchedKeyword: string | null;
  tags: string[];
  bucket: string | null;
  priority: string | null;
  matchedPriority: string | null;
} {
  const ignoredSet = ignoredKeywords ? (ignoredKeywords instanceof Set ? ignoredKeywords : new Set(ignoredKeywords)) : new Set<string>();

  const tagsResult = extractTagsFromTitle(title, ignoredSet);
  const bucketResult = extractBucketFromTitle(tagsResult.cleanTitle, bucketNames || [], ignoredSet);
  const priorityResult = extractPriorityFromTitle(bucketResult.cleanTitle, ignoredSet);
  const dateResult = parseDateFromTitle(priorityResult.cleanTitle, locale, ignoredSet);

  return {
    cleanTitle: dateResult.cleanTitle,
    dueDate: dateResult.dueDate,
    plannedDate: dateResult.plannedDate,
    matchedKeyword: dateResult.matchedKeyword,
    tags: tagsResult.tags,
    bucket: bucketResult.bucket,
    priority: priorityResult.priority,
    matchedPriority: priorityResult.matchedPriority,
  };
}

export interface KeywordMatch {
  start: number;
  end: number;
  text: string;
  type: 'tag' | 'bucket' | 'priority' | 'date';
  keyword: string;
}

export function getKeywordMatches(title: string, locale: string, bucketNames: string[], ignoredKeywords?: Set<string>): KeywordMatch[] {
  const matches: KeywordMatch[] = [];
  if (!title) return matches;

  const hasOverlap = (start: number, end: number) => {
    return matches.some((m) => start < m.end && m.start < end);
  };

  // 1. Tags
  const tagRegex = /(?:^|\s)#([a-zA-Z0-9\u00C0-\u017F_-]+)/g;
  let match;
  while ((match = tagRegex.exec(title)) !== null) {
    let matchedText = match[0];
    let start = match.index;
    if (matchedText.startsWith(' ')) {
      start += 1;
      matchedText = matchedText.substring(1);
    }
    const end = start + matchedText.length;
    const keyword = matchedText.toLowerCase();

    if (ignoredKeywords && ignoredKeywords.has(keyword)) {
      continue;
    }
    if (!hasOverlap(start, end)) {
      matches.push({ start, end, text: matchedText, type: 'tag', keyword });
    }
  }

  // 2. Buckets
  const bucketRegex = /(?:^|\s)\/([a-zA-Z0-9\u00C0-\u017F_-]+)/g;
  while ((match = bucketRegex.exec(title)) !== null) {
    let matchedText = match[0];
    let start = match.index;
    if (matchedText.startsWith(' ')) {
      start += 1;
      matchedText = matchedText.substring(1);
    }
    const end = start + matchedText.length;
    const name = match[1].toLowerCase();
    const matchedBucket = bucketNames.find((b) => b.toLowerCase() === name);

    if (matchedBucket) {
      const keyword = matchedText.toLowerCase();
      if (ignoredKeywords && ignoredKeywords.has(keyword)) {
        continue;
      }
      if (!hasOverlap(start, end)) {
        matches.push({ start, end, text: matchedText, type: 'bucket', keyword });
      }
    }
  }

  // 3. Priorities
  const priorityRegex = /(?:^|\s)\/?([pP]([0-4]))/g;
  while ((match = priorityRegex.exec(title)) !== null) {
    let matchedText = match[0];
    let start = match.index;
    if (matchedText.startsWith(' ')) {
      start += 1;
      matchedText = matchedText.substring(1);
    }
    const end = start + matchedText.length;
    const keyword = matchedText.toLowerCase();

    if (ignoredKeywords && ignoredKeywords.has(keyword)) {
      continue;
    }
    if (!hasOverlap(start, end)) {
      matches.push({ start, end, text: matchedText, type: 'priority', keyword });
    }
  }

  // 4. Dates
  const rules = getRules(locale);
  for (const rule of rules) {
    const rulePattern = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g');
    while ((match = rulePattern.exec(title)) !== null) {
      let matchedText = match[0];
      let start = match.index;
      if (matchedText.startsWith(' ')) {
        start += 1;
        matchedText = matchedText.substring(1);
      }
      const end = start + matchedText.length;
      const keyword = matchedText.toLowerCase();

      if (ignoredKeywords && ignoredKeywords.has(keyword)) {
        continue;
      }
      if (!hasOverlap(start, end)) {
        matches.push({ start, end, text: matchedText, type: 'date', keyword });
      }
    }
  }

  return matches.sort((a, b) => a.start - b.start);
}
