/** Papéis nominais pedidos pela administradora. */

export const BOOTSTRAP_ADMIN_EMAIL = 'sandgyferreira@gmail.com';

export function foldPersonName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Define o papel da conta pelo nome/e-mail.
 * Bhassia → GAP, Joselma → GVS, Marylane → GAS (uma gerência cada).
 * Sandgy Crystine permanece administradora. Demais contas são membro (só leitura).
 */
export function resolveAccessRole(person = {}) {
  const email = String(person.email || '').trim().toLowerCase();
  const nome = foldPersonName(person.nome || person.name || '');

  if (email === BOOTSTRAP_ADMIN_EMAIL || nome.includes('sandgy')) {
    return { role: 'admin', gerencia: '' };
  }
  if (nome.includes('bhassia')) {
    return { role: 'gerencia', gerencia: 'GAP' };
  }
  if (nome.includes('joselma')) {
    return { role: 'gerencia', gerencia: 'GVS' };
  }
  if (nome.includes('marylane') || nome.includes('mary lane') || nome.includes('marilane')) {
    return { role: 'gerencia', gerencia: 'GAS' };
  }
  return { role: 'usuario', gerencia: '' };
}
