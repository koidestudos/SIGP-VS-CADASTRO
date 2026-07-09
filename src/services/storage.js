import {
  subscribeProgramacoes,
  subscribeLogistica,
  getProgramacoes,
  getLogistica,
  getProgramacaoById,
  initProgramacoesSync,
  saveProgramacao,
  removeProgramacao,
  approveProgramacao,
  syncLogisticaFromProgramacao,
  updateLogisticaSituacao,
  upsertUserProfile,
  subscribeUserRole,
  fetchUserRole,
  importProgramacoesSeed,
  getSeedProgramacoesCount,
} from './programacoes-service.js';
import { getCoordenacoes, getMunicipios, getRegionais } from './catalog-service.js';
import { EQUIPES } from '../data/seed.js';
import { canEdit, canApprove, isAdmin, canDeleteProgramacao } from './roles.js';

export {
  subscribeProgramacoes,
  subscribeLogistica,
  getProgramacoes,
  initProgramacoesSync,
  saveProgramacao,
  removeProgramacao,
  approveProgramacao,
  syncLogisticaFromProgramacao,
  updateLogisticaSituacao,
  upsertUserProfile,
  subscribeUserRole,
  fetchUserRole,
  importProgramacoesSeed,
  getSeedProgramacoesCount,
  canEdit,
  canApprove,
  isAdmin,
  canDeleteProgramacao,
};

export function getCollection(name) {
  const map = {
    programacoes: getProgramacoes(),
    coordenacoes: getCoordenacoes(),
    municipios: getMunicipios(),
    regionais: getRegionais(),
    equipes: EQUIPES,
    logistica: getLogistica(),
  };
  return map[name] || [];
}

export function getItemById(collection, id) {
  if (collection === 'programacoes') return getProgramacaoById(id);
  return getCollection(collection).find((i) => i.id === id) || null;
}

export function deleteItem(collection, id) {
  if (collection === 'programacoes') return removeProgramacao(id);
}

export function updateItem(collection, id, updates) {
  if (collection === 'logistica') return updateLogisticaSituacao(id, updates.situacao);
}

export function addItem() {}
export function setCollection() {}
export function initStorage() {}
export function getData() { return {}; }
export function saveData() {}
export function setAuth() {}
export function getAuth() { return null; }
export function clearAuth() {}
export function login() { return null; }
export function resetData() {}
