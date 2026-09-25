// Cancellation letter generator. Plain text, so it works for letters, e-mails
// and contact forms alike.

function fmtDate(ms, lang) {
  return new Date(ms).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function buildLetter(opts) {
  const {
    lang = 'de',
    provider = '',
    providerAddress = '',
    name = '',
    address = '',
    email = '',
    customerNo = '',
    date = Date.now(),
    revokeMandate = true,
  } = opts;
  const today = fmtDate(date, lang);
  const lines = [];
  const push = (...l) => lines.push(...l);

  if (lang === 'de') {
    const subject = `Kündigung meines Vertrags${customerNo ? ` (Kunden-/Vertragsnummer ${customerNo})` : ''}`;
    if (name) push(name);
    if (address) push(...address.split('\n'));
    if (email) push(email);
    push('');
    push(provider || '[Anbieter]');
    if (providerAddress) push(...providerAddress.split('\n'));
    push('', `${address ? address.split('\n').pop().replace(/^\d{5}\s*/, '') + ', ' : ''}${today}`, '');
    push(subject, '');
    push('Sehr geehrte Damen und Herren,', '');
    push(
      `hiermit kündige ich meinen Vertrag bzw. mein Abonnement${customerNo ? ` mit der Kunden-/Vertragsnummer ${customerNo}` : ''} fristgerecht zum nächstmöglichen Zeitpunkt.`,
      '',
    );
    push('Bitte senden Sie mir eine schriftliche Bestätigung der Kündigung unter Angabe des Vertragsendes zu.', '');
    if (revokeMandate) {
      push(
        'Zum Vertragsende widerrufe ich außerdem die Ihnen erteilte Einzugsermächtigung bzw. das SEPA-Lastschriftmandat.',
        '',
      );
    }
    push(
      'Einer Verlängerung des Vertrags sowie der Nutzung meiner Daten zu Werbezwecken widerspreche ich.',
      '',
      'Mit freundlichen Grüßen',
      '',
      name || '[Name]',
    );
    return { subject, body: lines.join('\n') };
  }

  const subject = `Cancellation of my contract${customerNo ? ` (customer/contract no. ${customerNo})` : ''}`;
  if (name) push(name);
  if (address) push(...address.split('\n'));
  if (email) push(email);
  push('');
  push(provider || '[Provider]');
  if (providerAddress) push(...providerAddress.split('\n'));
  push('', today, '');
  push(subject, '');
  push('Dear Sir or Madam,', '');
  push(
    `I hereby cancel my contract/subscription${customerNo ? ` with the customer/contract number ${customerNo}` : ''} at the earliest possible date.`,
    '',
  );
  push('Please send me a written confirmation of the cancellation, including the end date of the contract.', '');
  if (revokeMandate) {
    push('As of the end of the contract, I also revoke the direct debit authorisation (SEPA mandate) I granted you.', '');
  }
  push('I object to any renewal of the contract and to the use of my data for marketing purposes.', '', 'Kind regards', '', name || '[Name]');
  return { subject, body: lines.join('\n') };
}
