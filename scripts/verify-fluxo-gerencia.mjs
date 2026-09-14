import {
  normalizeStatus,
  isPendenteGerencia,
  isDevolvidaGerencia,
  isAprovadaGerencia,
  needsGerenciaApproval,
  getStatusOptionsForUser,
  STATUS_AGUARDANDO_GERENCIA,
  STATUS_DEVOLVIDA,
  STATUS_REENVIADA,
  STATUS_APROVADA_GERENCIA,
} from '../src/utils/status.js';
import {
  canApproveGerencia,
  canViewGerenciaTab,
  canEditProgramacao,
  canCreateProgramacao,
  canUpdateLogistica,
  canViewGerencias,
  canAccessAdmin,
  canManageUsers,
  isDiretoria,
  isGerencia,
  isCoordenacao,
  isAdmin,
  roleLabel,
  setUserRole,
} from '../src/services/roles.js';
import { resolveAccessRole, foldPersonName } from '../src/config/access-roster.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(normalizeStatus('Enviado para Diretoria') === STATUS_AGUARDANDO_GERENCIA, 'legado deve virar aguardando gerência');
assert(isPendenteGerencia('Enviado para Diretoria'), 'legado pendente');
assert(isPendenteGerencia(STATUS_REENVIADA), 'reenvio é pendente');
assert(isDevolvidaGerencia(STATUS_DEVOLVIDA), 'devolvida');
assert(isAprovadaGerencia(STATUS_APROVADA_GERENCIA), 'aprovada');
assert(needsGerenciaApproval(STATUS_AGUARDANDO_GERENCIA), 'needs approval');

const membro = { uid: 'c1', role: 'usuario' };
const gas = { uid: 'g1', role: 'gerencia', gerencia: 'GAS' };
const gvs = { uid: 'g2', role: 'gerencia', gerencia: 'GVS' };
const dir = { uid: 'd1', role: 'diretoria' };
const adm = { uid: 'a1', role: 'admin', nome: 'Sandgy Crystine', email: 'sandgyferreira@gmail.com' };
const progGas = { id: 'p1', gerencia: 'GAS', criadoPor: 'c1', status: STATUS_AGUARDANDO_GERENCIA };
const rascunho = { id: 'p2', gerencia: 'GAS', criadoPor: 'c1', status: 'Rascunho' };
const devolvida = { id: 'p3', gerencia: 'GAS', criadoPor: 'c1', status: STATUS_DEVOLVIDA };

assert(isCoordenacao(membro), 'membro usa o papel usuario');
assert(isGerencia(gas) && !isDiretoria(gas), 'gerência não é diretoria');
assert(isDiretoria(dir) && isDiretoria(adm), 'diretoria e admin acompanham');
assert(canViewGerencias(gas) && canViewGerencias(dir) && canViewGerencias(adm), 'acesso gerências');
assert(!canViewGerencias(membro), 'membro não acessa fila da gerência');
assert(canViewGerenciaTab(gas, 'GAS') && !canViewGerenciaTab(gas, 'GVS'), 'GAS só vê GAS');
assert(canViewGerenciaTab(dir, 'GAP') && canViewGerenciaTab(adm, 'GVS'), 'diretoria vê todas');
assert(canApproveGerencia(gas, progGas) && !canApproveGerencia(gvs, progGas), 'aprovação só da gerência dona');
assert(!canApproveGerencia(dir, progGas), 'diretoria não aprova');
assert(canApproveGerencia(adm, progGas), 'admin pode aprovar');
assert(!canEditProgramacao(membro, rascunho) && !canEditProgramacao(membro, devolvida), 'membro não edita');
assert(!canCreateProgramacao(membro) && !canCreateProgramacao(gas), 'só admin cadastra');
assert(canCreateProgramacao(adm), 'admin cadastra');
assert(!canUpdateLogistica(membro) && canUpdateLogistica(gas) && canUpdateLogistica(adm), 'logística: gerência e admin');
assert(canAccessAdmin(dir) && canAccessAdmin(adm) && !canAccessAdmin(gas), 'admin page');
assert(canManageUsers(adm) && !canManageUsers(dir), 'só admin gerencia contas');

setUserRole('admin', { gerencia: 'GAS' });
assert(!isAdmin(membro), 'admin logado não transforma outra conta em admin');
assert(!isGerencia(membro), 'gerência atual não vaza para outra conta');
assert(roleLabel(membro) === 'Membro', 'rótulo usa o papel da conta, não o de quem está logado');
assert(roleLabel({ email: 'a@b.com' }) === 'Membro', 'conta sem role é membro');
assert(isAdmin(adm), 'admin continua admin');
assert(roleLabel(gas) === 'Gerência GAS', 'gerência mantém o próprio rótulo');
setUserRole('usuario');

const sendOpts = getStatusOptionsForUser(membro, rascunho);
assert(sendOpts.length === 1 && sendOpts[0] === 'Rascunho', 'membro não altera status');
assert(!sendOpts.includes(STATUS_AGUARDANDO_GERENCIA), 'membro não envia para gerência');
const adminOpts = getStatusOptionsForUser(adm, rascunho);
assert(adminOpts.includes(STATUS_AGUARDANDO_GERENCIA), 'admin altera status');

assert(foldPersonName('Bhássia') === 'bhassia', 'nome sem acento');
assert(resolveAccessRole({ nome: 'Sandgy Crystine', email: 'x@y.com' }).role === 'admin', 'Sandgy é admin');
assert(resolveAccessRole({ email: 'sandgyferreira@gmail.com' }).role === 'admin', 'e-mail bootstrap é admin');
assert(resolveAccessRole({ nome: 'Bhassia Silva' }).gerencia === 'GAP', 'Bhassia é GAP');
assert(resolveAccessRole({ nome: 'Joselma Oliveira' }).gerencia === 'GVS', 'Joselma é GVS');
assert(resolveAccessRole({ nome: 'Marylane Souza' }).gerencia === 'GAS', 'Marylane é GAS');
assert(resolveAccessRole({ nome: 'Fulano da Silva' }).role === 'usuario', 'demais são membros');

console.log('OK — papéis: gerência aprova, membro consulta, Sandgy administra');
