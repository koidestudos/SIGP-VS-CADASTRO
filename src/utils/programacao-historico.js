import { auth } from '../firebase/config.js';
import { getUserRole } from '../services/roles.js';

const MAX_HISTORICO = 50;
const MAX_OBS = 2000;

export function currentActorMeta() {
  const u = auth?.currentUser;
  return {
    uid: u?.uid || '',
    nome: String(u?.displayName || u?.email?.split('@')[0] || 'Usuário').slice(0, 200),
    email: String(u?.email || '').slice(0, 320),
    perfil: getUserRole(),
  };
}

export function makeHistoricoEntry({
  tipo,
  statusAnterior = '',
  statusNovo = '',
  observacao = '',
  gerencia = '',
} = {}) {
  const actor = currentActorMeta();
  return {
    tipo: String(tipo || 'evento').slice(0, 40),
    em: new Date().toISOString(),
    por: actor.uid,
    porNome: actor.nome,
    porEmail: actor.email,
    perfil: actor.perfil || '',
    statusAnterior: String(statusAnterior || '').slice(0, 80),
    statusNovo: String(statusNovo || '').slice(0, 80),
    observacao: String(observacao || '').slice(0, MAX_OBS),
    gerencia: String(gerencia || '').slice(0, 8),
  };
}

export function appendHistorico(list, entry) {
  const prev = Array.isArray(list) ? list.filter((item) => item && typeof item === 'object') : [];
  return [...prev, entry].slice(-MAX_HISTORICO);
}

export function historicoTipoLabel(tipo) {
  const map = {
    cadastro: 'Cadastro',
    edicao: 'Edição do cadastro',
    envio: 'Envio para a Gerência',
    reenvio: 'Reenvio para análise',
    aprovacao: 'Aprovação da Gerência',
    devolucao: 'Devolução para correção',
    status: 'Alteração de status',
  };
  return map[tipo] || tipo || 'Evento';
}

export function historicoPerfilLabel(perfil) {
  const p = String(perfil || '').toLowerCase();
  if (p === 'admin') return 'Administrador';
  if (p === 'gerencia') return 'Gerente';
  if (p === 'diretoria') return 'Diretoria';
  if (p === 'usuario') return 'Membro';
  return perfil || '';
}
