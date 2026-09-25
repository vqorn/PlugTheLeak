// Known providers. `re` is matched against payee + purpose text.
// `url` is only set where the account/cancel page is stable; everything else
// gets a search link and the letter generator instead of a guessed URL.
// Order matters: specific entries (Amazon Prime) must come before broad ones (Amazon).

export const CATEGORIES = [
  'video', 'music', 'audio', 'software', 'cloud', 'ai', 'news', 'fitness', 'gaming',
  'dating', 'learning', 'mobile', 'internet', 'tv', 'food', 'mobility', 'insurance',
  'energy', 'broadcast', 'housing', 'finance', 'charity', 'shopping', 'other',
];

// Categories that are typically optional and cancellable by the user.
export const SUBSCRIPTION_CATEGORIES = new Set([
  'video', 'music', 'audio', 'software', 'cloud', 'ai', 'news', 'fitness', 'gaming',
  'dating', 'learning', 'mobile', 'internet', 'tv', 'food', 'mobility', 'other',
]);

export const MERCHANTS = [
  // Video
  { name: 'Netflix', re: /netflix/i, cat: 'video', url: 'https://www.netflix.com/cancelplan' },
  { name: 'Disney+', re: /disney\s*plus|disneyplus|disney\+/i, cat: 'video' },
  { name: 'Amazon Prime', re: /amazon\s*prime|prime\s*video|amzn\s*prime|primevideo/i, cat: 'video', url: 'https://www.amazon.de/mc' },
  { name: 'DAZN', re: /\bdazn\b/i, cat: 'video' },
  { name: 'Sky / WOW', re: /\bsky\s*(deutschland|ticket)?\b|wow\s*tv|\bwowtv\b/i, cat: 'video' },
  { name: 'RTL+', re: /rtl\s*\+|rtl\s*plus|rtlplus/i, cat: 'video' },
  { name: 'Joyn', re: /\bjoyn\b/i, cat: 'video' },
  { name: 'Paramount+', re: /paramount/i, cat: 'video' },
  { name: 'Crunchyroll', re: /crunchyroll/i, cat: 'video' },
  { name: 'YouTube Premium', re: /youtube/i, cat: 'video', url: 'https://www.youtube.com/paid_memberships' },
  { name: 'Apple TV+', re: /apple\s*tv/i, cat: 'video' },
  { name: 'waipu.tv', re: /waipu/i, cat: 'tv' },
  { name: 'Zattoo', re: /zattoo/i, cat: 'tv' },
  { name: 'MagentaTV', re: /magenta\s*tv/i, cat: 'tv' },
  { name: 'Twitch', re: /twitch/i, cat: 'video' },
  // Music & audio
  { name: 'Spotify', re: /spotify/i, cat: 'music', url: 'https://www.spotify.com/account/subscription/' },
  { name: 'Apple Music', re: /apple\s*music/i, cat: 'music' },
  { name: 'Deezer', re: /deezer/i, cat: 'music' },
  { name: 'Tidal', re: /\btidal\b/i, cat: 'music' },
  { name: 'Amazon Music', re: /amazon\s*music|amzn\s*music/i, cat: 'music' },
  { name: 'Audible', re: /audible/i, cat: 'audio' },
  { name: 'BookBeat', re: /bookbeat/i, cat: 'audio' },
  { name: 'Nextory', re: /nextory/i, cat: 'audio' },
  { name: 'Kindle Unlimited', re: /kindle\s*(unltd|unlimited)/i, cat: 'audio' },
  { name: 'Blinkist', re: /blinkist/i, cat: 'audio' },
  // Software & cloud
  { name: 'Xbox Game Pass', re: /xbox/i, cat: 'gaming' },
  { name: 'Microsoft 365', re: /microsoft|msbill|office\s*365/i, cat: 'software', url: 'https://account.microsoft.com/services' },
  { name: 'Adobe', re: /adobe/i, cat: 'software', url: 'https://account.adobe.com/plans' },
  { name: 'Dropbox', re: /dropbox/i, cat: 'cloud', url: 'https://www.dropbox.com/account/plan' },
  { name: 'Google One / Google Play', re: /google/i, cat: 'cloud', url: 'https://myaccount.google.com/payments-and-subscriptions' },
  { name: 'iCloud / Apple', re: /apple\.com|itunes|icloud|apple\s*services/i, cat: 'cloud' },
  { name: 'Canva', re: /canva/i, cat: 'software' },
  { name: 'Notion', re: /notion\.so|\bnotion\b/i, cat: 'software' },
  { name: '1Password', re: /1password|agilebits/i, cat: 'software' },
  { name: 'NordVPN', re: /nordvpn|nordsec|nord\s*vpn/i, cat: 'software' },
  { name: 'Surfshark', re: /surfshark/i, cat: 'software' },
  { name: 'ExpressVPN', re: /expressvpn/i, cat: 'software' },
  { name: 'CyberGhost', re: /cyberghost/i, cat: 'software' },
  { name: 'Proton', re: /\bproton\b/i, cat: 'software' },
  { name: 'GitHub', re: /github/i, cat: 'software' },
  { name: 'Norton', re: /norton/i, cat: 'software' },
  { name: 'McAfee', re: /mcafee/i, cat: 'software' },
  { name: 'Kaspersky', re: /kaspersky/i, cat: 'software' },
  // AI
  { name: 'ChatGPT', re: /openai|chatgpt/i, cat: 'ai' },
  { name: 'Claude', re: /anthropic|claude\.ai/i, cat: 'ai' },
  { name: 'Midjourney', re: /midjourney/i, cat: 'ai' },
  { name: 'Perplexity', re: /perplexity/i, cat: 'ai' },
  // News
  { name: 'Der Spiegel', re: /spiegel/i, cat: 'news' },
  { name: 'Die Zeit', re: /zeit\s*online|zeitverlag|\bdie zeit\b/i, cat: 'news' },
  { name: 'FAZ', re: /\bfaz\b|frankfurter allgemeine/i, cat: 'news' },
  { name: 'Süddeutsche', re: /sueddeutsche|süddeutsche|\bsz\s*plus/i, cat: 'news' },
  { name: 'BILDplus', re: /bild\s*plus|bildplus|axel springer/i, cat: 'news' },
  { name: 'Handelsblatt', re: /handelsblatt/i, cat: 'news' },
  { name: 'Readly', re: /readly/i, cat: 'news' },
  { name: 'Patreon', re: /patreon/i, cat: 'other' },
  // Fitness & health
  { name: 'McFit', re: /mcfit|rsg group/i, cat: 'fitness' },
  { name: 'FitX', re: /\bfitx\b/i, cat: 'fitness' },
  { name: 'clever fit', re: /clever\s*fit/i, cat: 'fitness' },
  { name: 'Urban Sports Club', re: /urban\s*sports/i, cat: 'fitness' },
  { name: 'EGYM Wellpass', re: /wellpass|egym/i, cat: 'fitness' },
  { name: 'Fitness First', re: /fitness\s*first/i, cat: 'fitness' },
  { name: 'John Reed', re: /john\s*reed/i, cat: 'fitness' },
  { name: 'Freeletics', re: /freeletics/i, cat: 'fitness' },
  { name: 'Strava', re: /strava/i, cat: 'fitness' },
  { name: 'Komoot', re: /komoot/i, cat: 'fitness' },
  { name: 'Headspace', re: /headspace/i, cat: 'fitness' },
  { name: 'Calm', re: /\bcalm\.com|\bcalm\b/i, cat: 'fitness' },
  { name: 'Fitnessstudio', generic: true, re: /fitness|\bgym\b|sportstudio/i, cat: 'fitness' },
  // Gaming
  { name: 'PlayStation Plus', re: /playstation|sony interactive/i, cat: 'gaming' },
  { name: 'Nintendo', re: /nintendo/i, cat: 'gaming' },
  { name: 'EA Play', re: /electronic arts|\bea\s*play/i, cat: 'gaming' },
  // Dating
  { name: 'Tinder', re: /tinder/i, cat: 'dating' },
  { name: 'Parship', re: /parship/i, cat: 'dating' },
  { name: 'ElitePartner', re: /elitepartner/i, cat: 'dating' },
  { name: 'Bumble', re: /bumble/i, cat: 'dating' },
  { name: 'LoveScout24', re: /lovescout/i, cat: 'dating' },
  // Learning
  { name: 'Duolingo', re: /duolingo/i, cat: 'learning' },
  { name: 'Babbel', re: /babbel/i, cat: 'learning' },
  { name: 'LinkedIn Premium', re: /linkedin/i, cat: 'learning' },
  // Mobile & internet
  { name: 'Telekom', re: /telekom/i, cat: 'mobile' },
  { name: 'Vodafone', re: /vodafone|kabel deutschland|unitymedia/i, cat: 'internet' },
  { name: 'O2 / Telefónica', re: /telefonica|telefónica|\bo2\b/i, cat: 'mobile' },
  { name: '1&1', re: /1\s*&\s*1|1und1|einsundeins/i, cat: 'internet' },
  { name: 'congstar', re: /congstar/i, cat: 'mobile' },
  { name: 'freenet', re: /freenet|mobilcom/i, cat: 'mobile' },
  { name: 'fraenk', re: /fraenk/i, cat: 'mobile' },
  { name: 'PŸUR', re: /pyur|tele columbus/i, cat: 'internet' },
  { name: 'Drillisch / WinSIM', re: /drillisch|winsim|premiumsim/i, cat: 'mobile' },
  // Food boxes
  { name: 'HelloFresh', re: /hellofresh/i, cat: 'food' },
  { name: 'Marley Spoon', re: /marley\s*spoon/i, cat: 'food' },
  { name: 'Lieferando Plus', re: /lieferando/i, cat: 'food' },
  { name: 'Wolt+', re: /\bwolt\b/i, cat: 'food' },
  // Mobility
  { name: 'Deutschlandticket', re: /deutschland\s*-?\s*ticket|d-ticket|dticket/i, cat: 'mobility' },
  { name: 'ADAC', re: /\badac\b/i, cat: 'mobility' },
  { name: 'Deutsche Bahn', re: /\bdb\s*(fernverkehr|vertrieb)|deutsche bahn|bahncard/i, cat: 'mobility' },
  { name: 'ShareNow / Miles', re: /share\s*now|miles mobility/i, cat: 'mobility' },
  // Broadcasting fee (mandatory, not cancellable)
  { name: 'Rundfunkbeitrag', re: /rundfunk|beitragsservice|ard zdf/i, cat: 'broadcast' },
  // Insurance
  { name: 'Allianz', re: /allianz/i, cat: 'insurance' },
  { name: 'HUK-COBURG', re: /huk/i, cat: 'insurance' },
  { name: 'ERGO', re: /\bergo\b/i, cat: 'insurance' },
  { name: 'AXA', re: /\baxa\b/i, cat: 'insurance' },
  { name: 'DEVK', re: /\bdevk\b/i, cat: 'insurance' },
  { name: 'Generali', re: /generali/i, cat: 'insurance' },
  { name: 'CosmosDirekt', re: /cosmos\s*direkt/i, cat: 'insurance' },
  { name: 'Barmenia', re: /barmenia/i, cat: 'insurance' },
  { name: 'R+V', re: /r\s*\+\s*v\b|ruv versicherung/i, cat: 'insurance' },
  { name: 'Versicherung', generic: true, re: /versicherung|insurance/i, cat: 'insurance' },
  // Energy
  { name: 'E.ON', re: /\be\.?on\b/i, cat: 'energy' },
  { name: 'Vattenfall', re: /vattenfall/i, cat: 'energy' },
  { name: 'EnBW', re: /\benbw\b/i, cat: 'energy' },
  { name: 'LichtBlick', re: /lichtblick/i, cat: 'energy' },
  { name: 'Tibber', re: /tibber/i, cat: 'energy' },
  { name: 'Octopus Energy', re: /octopus/i, cat: 'energy' },
  { name: 'Stadtwerke', generic: true, re: /stadtwerke/i, cat: 'energy' },
  { name: 'Strom / Gas', generic: true, re: /\bstrom\b|\bgas\b|energie/i, cat: 'energy' },
  // Housing & finance
  { name: 'Miete', generic: true, re: /\bmiete\b|mietzahlung|hausverwaltung|wohnungsbau/i, cat: 'housing' },
  { name: 'Kredit', generic: true, re: /kredit|darlehen|finanzierung|ratenzahlung|tilgung/i, cat: 'finance' },
  { name: 'Kontoführung', generic: true, re: /kontof(ü|ue)hrung|entgelt.*konto|kartenpreis|jahresgeb(ü|ue)hr/i, cat: 'finance' },
  { name: 'Sparplan', generic: true, re: /sparplan|trade republic|scalable|umbuchung|(ü|ue)bertrag|sparen/i, cat: 'finance' },
  // Charity
  { name: 'Spende', generic: true, re: /spende|unicef|greenpeace|wwf|ärzte ohne grenzen|aerzte ohne grenzen|sos-kinderdorf|wikimedia/i, cat: 'charity' },
  // Shopping (broad, last)
  { name: 'Amazon', re: /amazon|amzn/i, cat: 'shopping' },
];

// Payment intermediaries hide the real merchant in the purpose text.
export const INTERMEDIARIES = /paypal|klarna|sofort|stripe|adyen|mollie|sumup|payone|computop|unzer|giropay|wirecard|nexi|worldline/i;

export function findKnownMerchant(text) {
  if (!text) return null;
  // Wallet names show up on ordinary card payments and must not match Google/Apple.
  const cleaned = text.replace(/(google|apple)\s*pay\b/gi, ' ');
  for (const m of MERCHANTS) if (m.re.test(cleaned)) return m;
  return null;
}
