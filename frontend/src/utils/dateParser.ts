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
): { cleanTitle: string; dueDate: string | null; matchedKeyword: string | null } {
  if (!title) {
    return { cleanTitle: title, dueDate: null, matchedKeyword: null };
  }

  const rules = getRules(locale);
  for (const rule of rules) {
    const match = rule.pattern.exec(title);
    if (match) {
      const matchedKeyword = match[0];
      const date = rule.getDate(match);
      const dueDate = formatDate(date);

      let cleanTitle = title.replace(rule.pattern, ' ');
      cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

      return { cleanTitle, dueDate, matchedKeyword };
    }
  }

  return { cleanTitle: title, dueDate: null, matchedKeyword: null };
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

export function parseTitleState(
  title: string,
  locale: string
): { cleanTitle: string; dueDate: string | null; matchedKeyword: string | null; tags: string[] } {
  const tagsResult = extractTagsFromTitle(title);
  const dateResult = parseDateFromTitle(tagsResult.cleanTitle, locale);

  return {
    cleanTitle: dateResult.cleanTitle,
    dueDate: dateResult.dueDate,
    matchedKeyword: dateResult.matchedKeyword,
    tags: tagsResult.tags,
  };
}
