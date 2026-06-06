interface DateRule {
  pattern: RegExp;
  getDate: (matches: RegExpExecArray) => Date;
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
      pattern: /\b(\d{1,2})\.(\d{1,2})\.(?:(\d{4}|\d{2})\b)?/i,
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
    },
    // 2. Explicit dates (US style, slash): 5/21/2026, 5/21/26, 5/21
    {
      pattern: /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2})\b)?/i,
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
    },
    // 3. Today / Heute
    {
      pattern: isDe ? /\b(heute|heu)\b/i : /\b(today|tod)\b/i,
      getDate: () => new Date(),
    },
    // 4. Tomorrow / Morgen
    {
      pattern: isDe ? /\b(morgen|mor)\b/i : /\b(tomorrow|tom)\b/i,
      getDate: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d;
      },
    },
    // 5. Next week / Nächste Woche
    {
      pattern: isDe ? /\b(n\u00e4chste woche|n\u00e4c)\b/i : /\b(next week|nex)\b/i,
      getDate: () => {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return d;
      },
    },
    // 6. Next month / Nächster Monat
    {
      pattern: isDe ? /\b(n\u00e4chster monat|nmo)\b/i : /\b(next month|nmt)\b/i,
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
        { name: 'sonntag', abbr: 'son', day: 0 },
        { name: 'montag', abbr: 'mon', day: 1 },
        { name: 'dienstag', abbr: 'die', day: 2 },
        { name: 'mittwoch', abbr: 'mit', day: 3 },
        { name: 'donnerstag', abbr: 'don', day: 4 },
        { name: 'freitag', abbr: 'fre', day: 5 },
        { name: 'samstag', abbr: 'sam', day: 6 },
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
      pattern: new RegExp(`\\b(${name}|${abbr})\\b`, 'i'),
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

export function parseDateFromTitle(
  title: string,
  locale: string
): { cleanTitle: string; dueDate: string | null; plannedDate: string | null; matchedKeyword: string | null } {
  if (!title) {
    return { cleanTitle: title, dueDate: null, plannedDate: null, matchedKeyword: null };
  }

  const rules = getRules(locale);
  const isDe = locale === 'de';

  for (const rule of rules) {
    const match = rule.pattern.exec(title);
    if (match) {
      const matchedKeyword = match[0].toLowerCase();
      const date = rule.getDate(match);
      const dueDate = formatDate(date);

      // Determine categorical planned date
      let plannedDate: string | null = 'today';
      if (isDe) {
        if (matchedKeyword.includes('morgen')) plannedDate = 'tomorrow';
        else if (matchedKeyword.includes('nächste woche')) plannedDate = 'thisWeek';
        else if (matchedKeyword.includes('nächster monat')) plannedDate = 'thisMonth';
        // Weekdays
        else if (['son', 'mon', 'die', 'mit', 'don', 'fre', 'sam'].some((abbr) => matchedKeyword.includes(abbr))) plannedDate = 'thisWeek';
      } else {
        if (matchedKeyword.includes('tomorrow')) plannedDate = 'tomorrow';
        else if (matchedKeyword.includes('next week')) plannedDate = 'thisWeek';
        else if (matchedKeyword.includes('next month')) plannedDate = 'thisMonth';
        // Weekdays
        else if (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].some((abbr) => matchedKeyword.includes(abbr))) plannedDate = 'thisWeek';
      }

      let cleanTitle = title.replace(rule.pattern, ' ');
      cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

      return { cleanTitle, dueDate, plannedDate, matchedKeyword };
    }
  }

  return { cleanTitle: title, dueDate: null, plannedDate: null, matchedKeyword: null };
}

export function extractTagsFromTitle(title: string): { cleanTitle: string; tags: string[] } {
  if (!title) {
    return { cleanTitle: title, tags: [] };
  }

  const tagRegex = /#([a-zA-Z0-9\u00C0-\u017F_-]+)/g;
  const tags: string[] = [];
  let match;

  while ((match = tagRegex.exec(title)) !== null) {
    tags.push(match[1].toLowerCase());
  }

  let cleanTitle = title.replace(tagRegex, ' ');
  cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

  return { cleanTitle, tags };
}

export function extractBucketFromTitle(title: string, bucketNames: string[]): { cleanTitle: string; bucket: string | null } {
  if (!title || !bucketNames || bucketNames.length === 0) {
    return { cleanTitle: title, bucket: null };
  }

  const bucketRegex = /(?:^|\s)\/([a-zA-Z0-9\u00C0-\u017F_-]+)/g;
  let foundBucket: string | null = null;

  let cleanTitle = title.replace(bucketRegex, (fullMatch, name) => {
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

export function extractPriorityFromTitle(title: string): { cleanTitle: string; priority: string | null; matchedPriority: string | null } {
  if (!title) {
    return { cleanTitle: title, priority: null, matchedPriority: null };
  }

  // Matches p0, p1, p2, p3, p4 (case-insensitive) optionally slash-prefixed as a standalone word
  const priorityRegex = /(?:^|\s)\/?([pP]([0-4]))\b/;
  const match = priorityRegex.exec(title);

  if (match) {
    const matchedPriority = match[1]; // e.g. "p1"
    const level = match[2]; // e.g. "1"
    let priorityVal = '';
    if (level === '1') priorityVal = 'low';
    else if (level === '2') priorityVal = 'medium';
    else if (level === '3') priorityVal = 'high';
    else if (level === '4') priorityVal = 'urgent';

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
  bucketNames?: string[]
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
  const tagsResult = extractTagsFromTitle(title);
  const bucketResult = extractBucketFromTitle(tagsResult.cleanTitle, bucketNames || []);
  const priorityResult = extractPriorityFromTitle(bucketResult.cleanTitle);
  const dateResult = parseDateFromTitle(priorityResult.cleanTitle, locale);

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
