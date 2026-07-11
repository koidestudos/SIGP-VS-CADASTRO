import {
  collection, addDoc, onSnapshot, query, orderBy, limit,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, isFirebaseConfigured } from '../firebase/config.js';
import { auth } from '../firebase/config.js';
import { getProgramacaoById, getProgramacaoRawById, markProgramacaoRealizadaPorAnexo } from './programacoes-service.js';
import { notifyProgramacaoAnexo } from './notifications-service.js';
import { canAttachAnexo, normalizeStatus, isRealizada } from '../utils/status.js';

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const EXT_MIME = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

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
  }, (err) => {
    console.error('Erro ao sincronizar anexos:', err);
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

function guessContentType(file) {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return EXT_MIME[ext] || 'application/octet-stream';
}

function isAllowedFile(file) {
  const type = guessContentType(file);
  if (Object.values(EXT_MIME).includes(type)) return true;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return Boolean(ext && EXT_MIME[ext]);
}

export function formatUploadError(err) {
  const code = err?.code || '';
  if (code === 'storage/unauthorized' || code === 'storage/unauthenticated') {
    return 'Sem permissão no Storage. Peça ao admin para publicar as regras do Storage.';
  }
  if (code === 'permission-denied') {
    return 'Sem permissão para registrar o anexo no Firestore.';
  }
  return err?.message || 'Erro ao enviar anexo.';
}

export function canUploadAnexo(programacao) {
  if (!programacao?.id) return false;
  return canAttachAnexo(programacao.status);
}

export async function uploadProgramacaoAnexo(programacaoId, file) {
  if (!db) throw new Error('Firebase não configurado.');
  if (!storage) throw new Error('Firebase Storage não configurado. Verifique VITE_FIREBASE_STORAGE_BUCKET.');
  const user = requireUser();
  const programacao = getProgramacaoById(programacaoId) || getProgramacaoRawById(programacaoId);
  if (!programacao) throw new Error('Programação não encontrada.');

  if (!canUploadAnexo(programacao)) {
    throw new Error('Não é possível anexar documentos em programações reprovadas ou canceladas.');
  }
  if (!file) throw new Error('Selecione um arquivo.');
  if (file.size > MAX_FILE_SIZE) throw new Error('Arquivo muito grande (máx. 15 MB).');
  if (!isAllowedFile(file)) {
    throw new Error('Tipo de arquivo não permitido. Use PDF, imagem ou documento Office.');
  }

  const contentType = guessContentType(file);
  const safeName = sanitizeFileName(file.name);
  const storagePath = `programacoes/${programacaoId}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, {
    contentType,
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
    mimeType: contentType,
    storagePath,
    downloadUrl,
    enviadoPor: user.uid,
    enviadoPorNome,
    enviadoPorEmail: user.email || '',
    enviadoEm,
  };

  const refDoc = await addDoc(collection(db, 'programacao_anexos'), anexoDoc);
  const anexo = { id: refDoc.id, ...anexoDoc };

  try {
    await notifyProgramacaoAnexo(programacao, anexo);
  } catch (err) {
    console.error('Falha ao criar notificação de anexo:', err);
  }

  const status = normalizeStatus(programacao.status);
  if (!isRealizada(status) && canAttachAnexo(status)) {
    await markProgramacaoRealizadaPorAnexo(programacaoId);
  }

  return anexo;
}
