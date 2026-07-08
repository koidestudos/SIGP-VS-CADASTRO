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
} from './programacoes-service.js';
import { COORDENACOES, MUNICIPIOS, REGIONAIS, EQUIPES } from '../data/seed.js';

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
};

export function getCollection(name) {
  const map = {
    programacoes: getProgramacoes(),
    coordenacoes: COORDENACOES,
    municipios: MUNICIPIOS,
    regionais: REGIONAIS,
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

export const canEdit = () => true;
export const canApprove = () => true;
export const isAdmin = () => true;

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
