import { URL_CONFIG } from "./config";

export interface YearBounds {
  minYear: number;
  maxYear: number;
}

export interface UrlState {
  rfcNumber: number | null;
  fromYear: number;
  toYear: number;
}

function rfcNumberFromPath(pathname: string): number | null {
  const pathPattern = new RegExp(`^${URL_CONFIG.rfcPathPrefix}(\\d+)/?$`);
  return integer(pathname.match(pathPattern)?.[1] ?? null);
}

function integer(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function parseUrlState(search: string, bounds: YearBounds, pathname = ""): UrlState {
  const parameters = new URLSearchParams(search);
  const parsedFrom = integer(parameters.get(URL_CONFIG.parameters.fromYear));
  const parsedTo = integer(parameters.get(URL_CONFIG.parameters.toYear));
  let fromYear = clamp(parsedFrom ?? bounds.minYear, bounds.minYear, bounds.maxYear);
  let toYear = clamp(parsedTo ?? bounds.maxYear, bounds.minYear, bounds.maxYear);
  if (fromYear > toYear) [fromYear, toYear] = [toYear, fromYear];

  const rfcNumber =
    integer(parameters.get(URL_CONFIG.parameters.rfc)) ?? rfcNumberFromPath(pathname);
  return {
    rfcNumber: rfcNumber && rfcNumber > 0 ? rfcNumber : null,
    fromYear,
    toYear,
  };
}

export function includeYear(state: UrlState, year: number | null): UrlState {
  if (year === null) return state;
  return {
    ...state,
    fromYear: Math.min(state.fromYear, year),
    toYear: Math.max(state.toYear, year),
  };
}

export function createUrl(state: UrlState, bounds: YearBounds, currentHref: string): URL {
  const url = new URL(currentHref);
  const parameters = url.searchParams;
  const setOptional = (name: string, value: number | null, defaultValue: number | null) => {
    if (value === defaultValue || value === null) parameters.delete(name);
    else parameters.set(name, String(value));
  };

  parameters.delete(URL_CONFIG.parameters.rfc);
  setOptional(URL_CONFIG.parameters.fromYear, state.fromYear, bounds.minYear);
  setOptional(URL_CONFIG.parameters.toYear, state.toYear, bounds.maxYear);
  url.pathname = state.rfcNumber ? `${URL_CONFIG.rfcPathPrefix}${state.rfcNumber}/` : "/";
  return url;
}

export function writeUrlState(state: UrlState, bounds: YearBounds, mode: "push" | "replace"): void {
  const url = createUrl(state, bounds, window.location.href);
  if (url.href === window.location.href) return;
  window.history[`${mode}State`](null, "", url);
}
