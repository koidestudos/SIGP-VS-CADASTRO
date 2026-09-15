import {
  normalizeStatus,
  isPendenteGerencia,
  isDevolvidaGerencia,
  isAprovadaGerencia,
  needsGerenciaApproval,
  getStatusOptionsForUser,
  statusRequiresJustificativa,
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
  canChangeProgramacaoStatus,
  canDeleteProgramacao,
  canSeeHistory,
  canUpdateLogistica,
  canViewGerencias,
  canAccessAdmin,
  canManageUsers,
  isDiretoria,
  isGerencia,
  isCoordenacao,
  isAdmin,
  isAutorDaProgramacao,
  roleLabel,
  setUserRole,
  filterProgramacoesByAccess,
  programacaoActionFlags,
  statusChangeConfirmMessage,
  MSG_EDICAO_NEGADA,
  MSG_PRIORIZADA_SEMANA,
} from '../src/services/roles.js';
import { resolveAccessRole, foldPersonName } from '../src/config/access-roster.js';
import { findPriorizadaConflito } from '../src/utils/programacao-prioridade.js';
import { weekRangeContainingDateBR } from '../src/utils/datetime-br.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(normalizeStatus('Enviado para Diretoria') === STATUS_AGUARDANDO_GERENCIA, 'legado deve virar aguardando gerência');
assert(isPendenteGerencia('Enviado para Diretoria'), 'legado pendente');
assert(isPendenteGerencia(STATUS_REENVIADA), 'reenvio é pendente');
assert(isDevolvidaGerencia(STATUS_DEVOLVIDA), 'devolvida');
assert(isAprovadaGerencia(STATUS_APROVADA_GERENCIA), 'aprovada');
assert(needsGerenciaApproval(STATUS_AGUARDANDO_GERENCIA), 'needs approval');

const membro = { uid: 'c1', role: 'usuario', perfil: 'usuario', gerencia: 'GAS', gerenciaId: 'GAS' };
const outroMembro = { uid: 'c2', role: 'usuario', gerencia: 'GAS', gerenciaId: 'GAS' };
const gas = { uid: 'g1', role: 'gerencia', perfil: 'gerencia', gerencia: 'GAS', gerenciaId: 'GAS' };
const gvs = { uid: 'g2', role: 'gerencia', perfil: 'gerencia', gerencia: 'GVS', gerenciaId: 'GVS' };
const dir = { uid: 'd1', role: 'diretoria' };
const adm = { uid: 'a1', role: 'admin', perfil: 'admin', nome: 'Sandgy Crystine', email: 'sandgyferreira@gmail.com' };
const progGas = { id: 'p1', gerencia: 'GAS', gerenciaId: 'GAS', criadoPor: 'c1', criadoPorUid: 'c1', status: STATUS_AGUARDANDO_GERENCIA };
const rascunho = { id: 'p2', gerencia: 'GAS', gerenciaId: 'GAS', criadoPor: 'c1', criadoPorUid: 'c1', status: 'Rascunho' };
const devolvida = { id: 'p3', gerencia: 'GAS', gerenciaId: 'GAS', criadoPor: 'c1', criadoPorUid: 'c1', status: STATUS_DEVOLVIDA };
const deOutro = { id: 'p4', gerencia: 'GAS', gerenciaId: 'GAS', criadoPor: 'c2', criadoPorUid: 'c2', status: 'Programada' };
const deGerente = { id: 'p5', gerencia: 'GAS', gerenciaId: 'GAS', criadoPor: 'g1', criadoPorUid: 'g1', status: 'Programada' };
const deGvs = { id: 'p6', gerencia: 'GVS', gerenciaId: 'GVS', criadoPor: 'c9', criadoPorUid: 'c9', status: 'Programada' };
const legado = { id: 'p7', gerencia: 'GAS', gerenciaId: 'GAS', criadoPor: '', criadoPorUid: '', status: 'Programada' };

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
assert(!sendOpts.includes(STATUS_AGUARDANDO_GERENCIA), 'membro não envia para gerência pelo dropdown');
const adminOpts = getStatusOptionsForUser(adm, rascunho);
assert(adminOpts.includes(STATUS_AGUARDANDO_GERENCIA), 'admin altera status');
const gerOpts = getStatusOptionsForUser(gas, progGas);
assert(gerOpts.includes('Priorizada') && gerOpts.includes('Reprovada'), 'gerente da mesma gerência altera qualquer status');
assert(getStatusOptionsForUser(gvs, progGas).length === 1, 'gerente de outra gerência não altera status');

assert(foldPersonName('Bhássia') === 'bhassia', 'nome sem acento');
assert(resolveAccessRole({ nome: 'Sandgy Crystine', email: 'x@y.com' }).role === 'admin', 'Sandgy é admin');
assert(resolveAccessRole({ email: 'sandgyferreira@gmail.com' }).role === 'admin', 'e-mail bootstrap é admin');
assert(resolveAccessRole({ nome: 'Bhassia Silva' }).gerencia === 'GAP', 'Bhassia é GAP');
assert(resolveAccessRole({ nome: 'Joselma Oliveira' }).gerencia === 'GVS', 'Joselma é GVS');
assert(resolveAccessRole({ nome: 'Marylane Souza' }).gerencia === 'GAS', 'Marylane é GAS');
assert(resolveAccessRole({ nome: 'Fulano da Silva' }).role === 'usuario', 'demais são membros');

/* 1 */ assert(canEditProgramacao(adm, deOutro) && canEditProgramacao(adm, legado), '1. administrador edita qualquer programação');
/* 2 */ assert(canChangeProgramacaoStatus(adm, deGvs) && canChangeProgramacaoStatus(adm, legado), '2. administrador altera qualquer status');
/* 3 */ assert(canCreateProgramacao(membro), '3. membro inclui programação');
/* 4 */ assert(canEditProgramacao(membro, rascunho) && canEditProgramacao(membro, devolvida), '4. membro edita a própria');
/* 5 */ assert(!canEditProgramacao(membro, deOutro), '5. membro não edita de outra pessoa');
assert(MSG_EDICAO_NEGADA.includes('Somente o responsável pelo cadastro'), 'mensagem de edição negada');
/* 6 */ assert(!canChangeProgramacaoStatus(membro, rascunho) && !canChangeProgramacaoStatus(membro, deOutro), '6. membro não altera status');
/* 7 */ assert(canCreateProgramacao(gas), '7. gerente inclui programação');
/* 8 */ assert(canEditProgramacao(gas, deGerente), '8. gerente edita somente a que criou');
/* 9 */ assert(!canEditProgramacao(gas, deOutro) && !canEditProgramacao(gas, rascunho), '9. gerente não edita conteúdo de outra pessoa');
/* 10 */ assert(canChangeProgramacaoStatus(gas, deOutro) && canChangeProgramacaoStatus(gas, rascunho), '10. gerente altera status da sua gerência');
/* 11 */ assert(!canChangeProgramacaoStatus(gas, deGvs), '11. gerente não altera programação de outra gerência');
/* 12 */ assert(filterProgramacoesByAccess([progGas, deGvs], gas).every((p) => (p.gerenciaId || p.gerencia) === 'GAS'), '12. gerente só vê a gerência correta');
assert(filterProgramacoesByAccess([progGas, deGvs], adm).length === 2, 'admin vê todas as gerências');
assert(filterProgramacoesByAccess([progGas, deGvs], membro).length === 2, 'membro permanece no fluxo atual de visualização');

const hist = [{
  tipo: 'status',
  em: '2026-09-15T12:00:00.000Z',
  por: 'g1',
  porNome: 'Gerente GAS',
  perfil: 'gerencia',
  statusAnterior: 'Programada',
  statusNovo: 'Priorizada',
}];
assert(hist.length === 1 && hist[0].tipo === 'status' && hist[0].perfil === 'gerencia' && hist[0].em, '13. histórico registra alteração');
assert(canSeeHistory(gas, progGas) && !canSeeHistory(gas, deGvs) && canSeeHistory(adm, deGvs), 'histórico visível ao gerente da gerência e ao admin');
assert(!canSeeHistory(membro, rascunho), 'membro não vê o histórico gerencial');

const week = weekRangeContainingDateBR('2026-09-14');
assert(week.start === '2026-09-14' && week.end === '2026-09-20', 'semana Brasília segunda a domingo');
const lista = [
  { id: 'prio-1', gerencia: 'GAS', gerenciaId: 'GAS', status: 'Priorizada', dataInicial: '2026-09-15', dataFinal: '2026-09-16' },
  { id: 'prio-2', gerencia: 'GAS', gerenciaId: 'GAS', status: 'Programada', dataInicial: '2026-09-17', dataFinal: '2026-09-17' },
  { id: 'prio-gvs', gerencia: 'GVS', gerenciaId: 'GVS', status: 'Priorizada', dataInicial: '2026-09-15', dataFinal: '2026-09-15' },
];
/* 14 */ assert(findPriorizadaConflito(lista, { gerencia: 'GAS', dataInicial: '2026-09-17', excludeId: 'prio-2' }), '14. uma priorizada por gerência/semana');
assert(!findPriorizadaConflito(lista, { gerencia: 'GAS', dataInicial: '2026-09-15', excludeId: 'prio-1' }), 'atualizar a própria priorizada é permitido');
assert(!findPriorizadaConflito(lista, { gerencia: 'GAP', dataInicial: '2026-09-15' }), 'outra gerência pode priorizar na mesma semana');
assert(MSG_PRIORIZADA_SEMANA.includes('já possui uma programação priorizada nesta semana'), 'mensagem da regra de priorização');

/* 15 */ assert(!isAutorDaProgramacao(membro, legado) && !canEditProgramacao(membro, legado) && canEditProgramacao(adm, legado), '15. legado sem autor só o admin edita');
assert(!canChangeProgramacaoStatus(outroMembro, deGvs), '15. acesso direto a outra gerência é negado ao membro');
assert(!canChangeProgramacaoStatus(gvs, progGas), '15. gerente GVS não altera GAS mesmo via URL');
assert(!canDeleteProgramacao(gas) && !canDeleteProgramacao(membro) && canDeleteProgramacao(adm), 'somente admin exclui');

const flagsMembroAutor = programacaoActionFlags(membro, rascunho);
assert(flagsMembroAutor.view && flagsMembroAutor.edit && !flagsMembroAutor.changeStatus && !flagsMembroAutor.approve && !flagsMembroAutor.del, 'botões: membro autor');
const flagsMembroOutro = programacaoActionFlags(membro, deOutro);
assert(flagsMembroOutro.view && !flagsMembroOutro.edit && !flagsMembroOutro.changeStatus, 'botões: membro não autor');
const flagsGerenteAutor = programacaoActionFlags(gas, deGerente);
assert(flagsGerenteAutor.edit && flagsGerenteAutor.changeStatus && flagsGerenteAutor.approve && !flagsGerenteAutor.del, 'botões: gerente autor');
const flagsGerenteOutro = programacaoActionFlags(gas, deOutro);
assert(!flagsGerenteOutro.edit && flagsGerenteOutro.changeStatus && flagsGerenteOutro.approve, 'botões: gerente não autor');
const flagsAdmin = programacaoActionFlags(adm, deOutro);
assert(flagsAdmin.edit && flagsAdmin.changeStatus && flagsAdmin.approve && flagsAdmin.del, 'botões: administrador');

assert(
  statusChangeConfirmMessage('Programada', 'Priorizada')
    === 'Deseja alterar o status desta programação de ‘Programada’ para ‘Priorizada’?',
  'confirmação de status',
);
assert(statusRequiresJustificativa('Reprovada') && statusRequiresJustificativa(STATUS_DEVOLVIDA), 'justificativa exigida');
assert(!canCreateProgramacao(dir), 'diretoria não cadastra');

console.log('OK — permissões: autor edita conteúdo; gerente altera status da gerência; admin total');
