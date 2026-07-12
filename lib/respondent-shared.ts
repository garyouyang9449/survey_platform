/**
 * Shared constants for respondent identity. Kept dependency-free so it can be
 * imported from both edge (proxy) and node (route handlers) runtimes.
 */
export const RESPONDENT_COOKIE = "respondent_id";

// One year in seconds. Long-lived so respondents can resume much later.
export const RESPONDENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
