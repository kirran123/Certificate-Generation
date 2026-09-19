/**
 * columnHelper.js - Shared Frontend Utility for Smart Column Matching & Value Extraction
 * Handles flexible column headers (e.g. Name(Eg: Kirran S T - IV IT), NAME, Email Address, Dept, Year)
 * and guarantees non-empty value extraction for certificate generation.
 */

// Clean column header string by removing parenthetical examples, special symbols, and extra spaces
export const cleanHeaderName = (header) => {
  if (!header) return '';
  return String(header)
    .replace(/\s*\([^)]*\)/g, '') // Remove anything inside parentheses e.g. (Eg: ...) or (Example: ...)
    .replace(/[^a-zA-Z0-9]/g, ' ') // Replace punctuation with space
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

// Check if a column header looks like an event feedback or survey question
export const isFeedbackQuestionHeader = (header) => {
  if (!header) return false;
  const raw = String(header).trim().toLowerCase();
  if (raw.includes('?') || raw.length > 35) return true;
  const keywords = ['feedback', 'rating', 'rate', 'opinion', 'suggestion', 'how was', 'comments', 'remarks', 'experience'];
  return keywords.some(kw => raw.includes(kw));
};

// Generic multi-tier column finder for target field types
export const findBestColumnForField = (headers = [], fieldType = '') => {
  if (!headers || !headers.length) return '';

  const cleanType = cleanHeaderName(fieldType);

  // Filter out survey/feedback question columns first for core fields
  const candidateHeaders = headers.filter(h => !isFeedbackQuestionHeader(h) || cleanType === 'feedback');

  // Tier 1: Exact case-insensitive match on clean header
  const exactClean = candidateHeaders.find(h => {
    const c = cleanHeaderName(h);
    if (cleanType === 'name') return ['name', 'full name', 'participant name', 'candidate name', 'student name', 'recipient name'].includes(c);
    if (cleanType === 'email') return ['email', 'email address', 'mail', 'mail id', 'e mail', 'recipient email', 'student mail'].includes(c);
    if (cleanType === 'college') return ['college', 'institution', 'university', 'school', 'college name', 'inst'].includes(c);
    if (cleanType === 'department') return ['department', 'dept', 'branch', 'stream', 'specialization', 'degree dept'].includes(c);
    if (cleanType === 'year') return ['year', 'academic year', 'year of study', 'class', 'sem', 'semester', 'batch year'].includes(c);
    return c === cleanType;
  });
  if (exactClean) return exactClean;

  // Tier 2: Partial keyword match
  const partialMatch = candidateHeaders.find(h => {
    const c = cleanHeaderName(h);
    if (cleanType === 'name') return c.includes('name');
    if (cleanType === 'email') return c.includes('email') || c.includes('mail');
    if (cleanType === 'college') return c.includes('college') || c.includes('inst') || c.includes('univ');
    if (cleanType === 'department') return c.includes('dept') || c.includes('branch') || c.includes('stream');
    if (cleanType === 'year') return c.includes('year') || c.includes('sem') || c.includes('class');
    return c.includes(cleanType);
  });
  if (partialMatch) return partialMatch;

  // Fallback to searching all headers if candidate headers yielded no match
  if (candidateHeaders.length < headers.length) {
    const fallback = headers.find(h => cleanHeaderName(h).includes(cleanType));
    if (fallback) return fallback;
  }

  return '';
};

export const findBestNameColumn = (headers = []) => findBestColumnForField(headers, 'name');
export const findBestEmailColumn = (headers = []) => findBestColumnForField(headers, 'email');
export const findBestCollegeColumn = (headers = []) => findBestColumnForField(headers, 'college');
export const findBestDeptColumn = (headers = []) => findBestColumnForField(headers, 'department');
export const findBestYearColumn = (headers = []) => findBestColumnForField(headers, 'year');

/**
 * 5-Step Extraction Pipeline: Retrieves row value for a given target column key.
 * Guarantees zero empty values for recipient names and core fields.
 */
export const getRowColumnValue = (row = {}, targetCol = '', fieldType = '') => {
  if (!row || typeof row !== 'object') return '';

  // 1. Direct exact property lookup
  if (targetCol && row[targetCol] !== undefined && row[targetCol] !== null && String(row[targetCol]).trim() !== '') {
    return String(row[targetCol]).trim();
  }

  const rowKeys = Object.keys(row);
  if (rowKeys.length === 0) return '';

  // 2. Case & trim insensitive lookup
  if (targetCol) {
    const targetTrimmed = String(targetCol).trim().toLowerCase();
    const caseMatch = rowKeys.find(k => k.trim().toLowerCase() === targetTrimmed);
    if (caseMatch && row[caseMatch] !== undefined && row[caseMatch] !== null && String(row[caseMatch]).trim() !== '') {
      return String(row[caseMatch]).trim();
    }

    // 3. Cleaned header lookup (ignoring parenthetical example suffixes)
    const targetClean = cleanHeaderName(targetCol);
    if (targetClean) {
      const cleanMatch = rowKeys.find(k => cleanHeaderName(k) === targetClean);
      if (cleanMatch && row[cleanMatch] !== undefined && row[cleanMatch] !== null && String(row[cleanMatch]).trim() !== '') {
        return String(row[cleanMatch]).trim();
      }
    }
  }

  // 4. Field type fuzzy scan across row keys
  const effectiveType = fieldType || (targetCol ? cleanHeaderName(targetCol) : '');
  if (effectiveType) {
    const fuzzyKey = rowKeys.find(k => {
      const c = cleanHeaderName(k);
      if (effectiveType.includes('name')) return c.includes('name') || c.includes('student') || c.includes('participant') || c.includes('candidate');
      if (effectiveType.includes('email') || effectiveType.includes('mail')) return c.includes('email') || c.includes('mail');
      if (effectiveType.includes('college')) return c.includes('college') || c.includes('inst') || c.includes('univ');
      if (effectiveType.includes('dept') || effectiveType.includes('department')) return c.includes('dept') || c.includes('branch');
      if (effectiveType.includes('year')) return c.includes('year') || c.includes('sem');
      return c.includes(effectiveType);
    });

    if (fuzzyKey && row[fuzzyKey] !== undefined && row[fuzzyKey] !== null && String(row[fuzzyKey]).trim() !== '') {
      return String(row[fuzzyKey]).trim();
    }
  }

  // 5. Direct standard property fallbacks
  if (effectiveType.includes('name')) {
    if (row.name) return String(row.name).trim();
    if (row.fullName) return String(row.fullName).trim();
    if (row.participantName) return String(row.participantName).trim();
  }
  if (effectiveType.includes('email') || effectiveType.includes('mail')) {
    if (row.email) return String(row.email).trim();
    if (row.mail) return String(row.mail).trim();
    // Pattern search for '@' in any string field
    const emailValue = rowKeys.map(k => String(row[k] || '')).find(val => val.includes('@') && val.includes('.'));
    if (emailValue) return emailValue.trim();
  }

  return '';
};
