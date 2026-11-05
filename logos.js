// Company logos. The data has no company websites, so we guess each company's
// domain and ask Google's favicon service for its logo. If the guess is wrong
// the service returns 404 and the card keeps its colored letter.

const LOGO_SIZE = 128;

// Exact domains for large companies whose names don't turn into their domain.
const KNOWN_DOMAINS = {
  "amazon": "amazon.com",
  "american express": "americanexpress.com",
  "analog devices": "analog.com",
  "bny": "bny.com",
  "boeing": "boeing.com",
  "capital one": "capitalone.com",
  "citadel": "citadel.com",
  "electronic arts": "ea.com",
  "emerson electric": "emerson.com",
  "ernst & young": "ey.com",
  "ge vernova": "gevernova.com",
  "general dynamics mission systems": "gd.com",
  "general motors": "gm.com",
  "goldman sachs": "goldmansachs.com",
  "google": "google.com",
  "hewlett packard": "hp.com",
  "hewlett packard enterprise": "hpe.com",
  "hudson river trading": "hudsonrivertrading.com",
  "jane street": "janestreet.com",
  "john deere": "deere.com",
  "johns hopkins applied physics laboratory": "jhuapl.edu",
  "johnson & johnson": "jnj.com",
  "jp morgan chase": "jpmorganchase.com",
  "jpmorgan chase": "jpmorganchase.com",
  "jump trading": "jumptrading.com",
  "manulife financial": "manulife.com",
  "meta": "meta.com",
  "microsoft": "microsoft.com",
  "morgan stanley": "morganstanley.com",
  "motorola": "motorolasolutions.com",
  "navy federal": "navyfederal.org",
  "nissan global": "nissan-global.com",
  "northrop grumman": "northropgrumman.com",
  "pennsylvania state university": "psu.edu",
  "procter & gamble": "pg.com",
  "rtx": "rtx.com",
  "susquehanna international group (sig)": "sig.com",
  "texas instruments": "ti.com",
  "two sigma": "twosigma.com",
  "united airlines": "united.com",
  "university of illinois urbana-champaign": "illinois.edu",
};

// Words that companies add to their names but leave out of their domains.
const NAME_SUFFIXES = /\b(inc|llc|ltd|corp|corporation|co|company|technologies|technology|group|global|holdings)\b/g;

// Shared hiring sites: a link to one of these says nothing about the company's own domain.
const HIRING_SITES = new Set([
  "myworkdayjobs.com", "myworkdaysite.com", "greenhouse.io", "oraclecloud.com", "ashbyhq.com",
  "icims.com", "lever.co", "smartrecruiters.com", "applytojob.com", "workable.com", "eightfold.ai",
  "rippling.com", "avature.net", "paylocity.com", "jobvite.com", "taleo.net", "successfactors.com",
  "ultipro.com", "adp.com", "bamboohr.com", "simplify.jobs", "adzuna.com", "brassring.com", "dayforcehcm.com",
]);

function compactName(companyName) {
  return companyName.toLowerCase().replace(/\(.*?\)/g, "").replace(NAME_SUFFIXES, "").replace(/[^a-z0-9]/g, "");
}

// The application link's site, if it belongs to the company itself (e.g. "amazon.jobs" for Amazon).
function domainFromApplyLink(companyName, url) {
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null;
  }
  const domain = hostname.split(".").slice(-2).join(".");
  if (HIRING_SITES.has(domain)) return null;
  const firstWord = companyName.toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, "");
  return firstWord.length >= 3 && domain.includes(firstWord) ? domain : null;
}

/** Best guess at a company's website domain, or null if there's nothing to guess from. */
export function guessCompanyDomain(companyName, applyUrl) {
  const knownDomain = KNOWN_DOMAINS[companyName.trim().toLowerCase()];
  if (knownDomain) return knownDomain;
  const linkDomain = domainFromApplyLink(companyName, applyUrl);
  if (linkDomain) return linkDomain;
  const compact = compactName(companyName);
  return compact.length >= 2 ? `${compact}.com` : null;
}

export function logoUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${LOGO_SIZE}`;
}
