/** Datas no fuso de Brasília (America/Sao_Paulo) */

const TZ = 'America/Sao_Paulo';

/** Retorna YYYY-MM-DD no horário de Brasília */
export function todayBR() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Partes numéricas da data de hoje em Brasília */
export function todayPartsBR() {
  const [y, m, d] = todayBR().split('-').map(Number);
  return { year: y, month: m, day: d };
}

/**
 * Semana corrente em Brasília (segunda a domingo).
 * @returns {{ start: string, end: string, label: string }}
 */
export function currentWeekRangeBR() {
  const today = todayBR();
  const [y, m, d] = today.split('-').map(Number);
  // Meio-dia UTC evita virada de dia ao calcular weekday
  const noon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  // getUTCDay: 0=domingo … 6=sábado → deslocar para segunda=0
  const weekday = (noon.getUTCDay() + 6) % 7;
  const monday = new Date(noon);
  monday.setUTCDate(noon.getUTCDate() - weekday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const fmt = (dt) => {
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  const start = fmt(monday);
  const end = fmt(sunday);
  const labelStart = start.split('-').reverse().join('/');
  const labelEnd = end.split('-').reverse().join('/');
  return { start, end, label: `${labelStart} – ${labelEnd}` };
}

/** Programação ocorre na semana se o intervalo de datas cruza [weekStart, weekEnd] */
export function programacaoNaSemana(p, weekStart, weekEnd) {
  const ini = p.dataInicial;
  const fim = p.dataFinal || p.dataInicial;
  if (!ini) return false;
  return ini <= weekEnd && fim >= weekStart;
}
