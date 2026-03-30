import { ResourceRole } from '@/models/common';
import { RETRIEVE_METHOD } from '@/models/datasets';
import { ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const chars =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
const nameWords = [
  'rapid',
  'bright',
  'silent',
  'amber',
  'lunar',
  'silver',
  'echo',
  'summit',
  'river',
  'atlas',
  'vector',
  'nova',
  'comet',
  'zenith',
  'cobalt',
  'harbor',
];

/**
 *
 * @param length
 * @returns
 */
export function randomString(length: number) {
  let result = '';
  for (let i = length; i > 0; --i)
    result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

/**
 *
 * @param rl
 * @returns
 */
export const isOwnerResource = (rl: ResourceRole): boolean => {
  if (rl === ResourceRole.owner) return true;
  return false;
};

/**
 *
 * @param method
 * @returns
 */
export function retrieveMethodFromString(method: string): RETRIEVE_METHOD {
  switch (method) {
    case RETRIEVE_METHOD.semantic:
      return RETRIEVE_METHOD.semantic;
    case RETRIEVE_METHOD.fullText:
      return RETRIEVE_METHOD.fullText;
    case RETRIEVE_METHOD.hybrid:
      return RETRIEVE_METHOD.hybrid;
    case RETRIEVE_METHOD.invertedIndex:
      return RETRIEVE_METHOD.invertedIndex;
    default:
      return RETRIEVE_METHOD.semantic; // Or throw an error if appropriate
  }
}

/**
 *
 * @param string
 * @returns
 */
export function ValidHttpUrl(string) {
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === 'http:' || url.protocol === 'https:';
}

/**
 * Calls all functions in the order they were chained with the same arguments.
 * @internal
 */
export function chain(...callbacks: any[]): (...args: any[]) => void {
  return (...args: any[]) => {
    for (const callback of callbacks) {
      if (typeof callback === 'function') {
        try {
          callback(...args);
        } catch (e) {
          console.error(e);
        }
      }
    }
  };
}

interface Props {
  [key: string]: any;
}

// taken from: https://stackoverflow.com/questions/51603250/typescript-3-parameter-list-intersection-type/51604379#51604379
type TupleTypes<T> = { [P in keyof T]: T[P] } extends { [key: number]: infer V }
  ? V
  : never;
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

/**
 * Merges multiple props objects together. Event handlers are chained,
 * classNames are combined, and ids are deduplicated - different ids
 * will trigger a side-effect and re-render components hooked up with `useId`.
 * For all other props, the last prop object overrides all previous ones.
 * @param args - Multiple sets of props to merge together.
 * @internal
 */
export function mergeProps<T extends Props[]>(
  ...args: T
): UnionToIntersection<TupleTypes<T>> {
  // Start with a base clone of the first argument. This is a lot faster than starting
  // with an empty object and adding properties as we go.
  const result: Props = { ...args[0] };
  for (let i = 1; i < args.length; i++) {
    const props = args[i];
    for (const key in props) {
      const a = result[key];
      const b = props[key];

      // Chain events
      if (
        typeof a === 'function' &&
        typeof b === 'function' &&
        // This is a lot faster than a regex.
        key[0] === 'o' &&
        key[1] === 'n' &&
        key.charCodeAt(2) >= /* 'A' */ 65 &&
        key.charCodeAt(2) <= /* 'Z' */ 90
      ) {
        result[key] = chain(a, b);

        // Merge classnames, sometimes classNames are empty string which eval to false, so we just need to do a type check
      } else if (
        (key === 'className' || key === 'UNSAFE_className') &&
        typeof a === 'string' &&
        typeof b === 'string'
      ) {
        result[key] = clsx(a, b);
      } else {
        result[key] = b !== undefined ? b : a;
      }
    }
  }

  return result as UnionToIntersection<TupleTypes<T>>;
}

/**
 *
 * @param prefix
 * @returns
 */
export const randomMeaningfullName = (prefix?: string): string => {
  const name = Array.from({ length: 3 })
    .map(() => nameWords[Math.floor(Math.random() * nameWords.length)])
    .join('-');
  return prefix ? `${prefix}-${name}` : name;
};
