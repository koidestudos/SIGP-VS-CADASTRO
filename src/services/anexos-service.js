import {
  collection, addDoc, onSnapshot, query, orderBy, limit,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, isFirebaseConfigured } from '../firebase/config.js';
import { auth } from '../firebase/config.js';
import { getProgramacaoById, updateProgramacaoStatus } from './programacoes-service.js';
import { notifyProgramacaoAnexo } from './notifications-service.js';
import { canAttachAnexo, normalizeStatus, isRealizada } from '../utils/status.js';

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

let anexosCache = [];
const listeners = new Set();
let unsub = null;

function notify() {
  listeners.forEach((fn) => fn([...anexosCache]));
}

export function subscribeAnexos(callback) {
  listeners.add(callback);
  callback([...anexosCache]);
  return () => listeners.delete(callback);
}

export function getAnexos() {
  return [...anexosCache];
}

export function getAnexosByProgramacao(programacaoId) {
  return anexosCache.filter((a) => a.programacaoId === programacaoId);
}

export function initAnexosSync() {
  if (!isFirebaseConfigured || !db) return;
  if (unsub) unsub();

  const q = query(
    collection(db, 'programacao_anexos'),
    orderBy('enviadoEm', 'desc'),
    limit(500),
  );

  unsub = onSnapshot(q, (snap) => {
    anexosCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    notify();
  }, () => {
    anexosCache = [];
    notify();
  });
}

function requireUser() {
  const user = auth?.currentUser;
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  return user;
}

function sanitizeFileName(name) {
  return (name || 'arquivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
}

export function canUploadAnexo(programacao) {
  if (!programacao?.id) return false;
  return canAttachAnexo(programacao.status);
}

export async function uploadProgramacaoAnexo(programacaoId, file) {
  if (!db || !storage) throw new Error('Firebase Storage não configurado.');
  const user = requireUser();
  const programacao = getProgramacaoById(programacaoId);
  if (!programacao) throw new Error('Programação não encontrada.');

  if (!canUploadAnexo(programacao)) {
    throw new Error('Não é possível anexar documentos em programações reprovadas ou canceladas.');
  }
  if (!file) throw new Error('Selecione um arquivo.');
  if (file.size > MAX_FILE_SIZE) throw new Error('Arquivo muito grande (máx. 15 MB).');
  if (ALLOWED_TYPES.length && file.type && !ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Tipo de arquivo não permitido. Use PDF, imagem ou documento Office.');
  }

  const safeName = sanitizeFileName(file.name);
  const storagePath = `programacoes/${programacaoId}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, {
    contentType: file.type || 'application/octet-stream',
    customMetadata: {
      programacaoId,
      enviadoPor: user.uid,
    },
  });

  const downloadUrl = await getDownloadURL(storageRef);
  const enviadoEm = new Date().toISOString();
  const enviadoPorNome = user.displayName || user.email?.split('@')[0] || 'Usuário';

  const anexoDoc = {
    programacaoId,
    programacaoTitulo: programacao.titulo || '',
    coordenacaoId: programacao.coordenacaoId || '',
    nomeArquivo: file.name,
    tamanho: file.size,
    mimeType: file.type || '',
    storagePath,
    downloadUrl,
    enviadoPor: user.uid,
    enviadoPorNome,
    enviadoPorEmail: user.email || '',
    enviadoEm,
  };

  const refDoc = await addDoc(collection(db, 'programacao_anexos'), anexoDoc);
  const anexo = { id: refDoc.id, ...anexoDoc };

  const status = normalizeStatus(programacao.status);
  if (!isRealizada(status) && canAttachAnexo(status)) {
    await updateProgramacaoStatus(programacaoId, 'Realizada');
  }

  await notifyProgramacaoAnexo(programacao, anexo);
  return anexo;
}
