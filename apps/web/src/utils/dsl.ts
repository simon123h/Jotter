import { parseQuery, stringifyQuery } from '@jotter/task-filter';

/** The search query language lives in packages/task-filter, shared with the mobile app. */
export const parseDSL = parseQuery;
export const stringifyDSL = stringifyQuery;
