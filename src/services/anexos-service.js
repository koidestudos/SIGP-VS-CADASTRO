import {
  collection, doc, addDoc, setDoc, getDocs, onSnapshot, query, orderBy, limit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config.js';
import { auth } from '../firebase/config.js';
import { getProgramacaoById, getProgramacaoRawById, markProgramacaoRealizadaPorAnexo } from './programacoes-service.js';
import { notifyProgramacaoAnexo } from './notifications-service.js';
import { canAttachAnexo, normalizeStatus, isRealizada } from '../utils/status.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
/** ~400KB de base64 por chunk (abaixo do limite de 1MB do Firestore) */
const CHUNK_CHARS = 400_000;

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
  if (code === 'permission-denied') {
    return 'Sem permissão para registrar o anexo. Aguarde o deploy das regras do Firestore.';
  }
  return err?.message || 'Erro ao enviar anexo.';
}

export function canUploadAnexo(programacao) {
  if (!programacao?.id) return false;
  return canAttachAnexo(programacao.status);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

function splitChunks(base64) {
  const chunks = [];
  for (let i = 0; i < base64.length; i += CHUNK_CHARS) {
    chunks.push(base64.slice(i, i + CHUNK_CHARS));
  }
  return chunks.length ? chunks : [''];
}

/**
 * @param {string} programacaoId
 * @param {File} file
 * @param {{ onProgress?: (pct: number, label?: string) => void }} [options]
 */
export async function uploadProgramacaoAnexo(programacaoId, file, options = {}) {
  const { onProgress } = options;
  if (!db) throw new Error('Firebase não configurado.');
  const user = requireUser();
  const programacao = getProgramacaoById(programacaoId) || getProgramacaoRawById(programacaoId);
  if (!programacao) throw new Error('Programação não encontrada.');

  if (!canUploadAnexo(programacao)) {
    throw new Error('Não é possível anexar documentos em programações reprovadas ou canceladas.');
  }
  if (!file) throw new Error('Selecione um arquivo.');
  if (file.size > MAX_FILE_SIZE) throw new Error('Arquivo muito grande (máx. 10 MB).');
  if (!isAllowedFile(file)) {
    throw new Error('Tipo de arquivo não permitido. Use PDF, imagem ou documento Office.');
  }

  const contentType = guessContentType(file);
  onProgress?.(5, 'Lendo arquivo...');
  const base64 = await fileToBase64(file);
  const chunks = splitChunks(base64);
  onProgress?.(15, `Preparando ${chunks.length} parte(s)...`);

  const enviadoEm = new Date().toISOString();
  const enviadoPorNome = user.displayName || user.email?.split('@')[0] || 'Usuário';

  const anexoDoc = {
    programacaoId: programacao.id,
    programacaoTitulo: programacao.titulo || '',
    coordenacaoId: programacao.coordenacaoId || '',
    nomeArquivo: file.name,
    tamanho: file.size,
    mimeType: contentType,
    storagePath: '',
    downloadUrl: '',
    storedIn: 'firestore-chunks',
    chunkCount: chunks.length,
    enviadoPor: user.uid,
    enviadoPorNome,
    enviadoPorEmail: user.email || '',
    enviadoEm,
  };

  const refDoc = await addDoc(collection(db, 'programacao_anexos'), anexoDoc);
  const anexoId = refDoc.id;

  for (let i = 0; i < chunks.length; i += 1) {
    await setDoc(doc(db, 'programacao_anexos', anexoId, 'chunks', String(i)), {
      index: i,
      data: chunks[i],
    });
    const pct = 15 + Math.round(((i + 1) / chunks.length) * 70);
    onProgress?.(pct, `Enviando parte ${i + 1} de ${chunks.length}...`);
  }

  const anexo = { id: anexoId, ...anexoDoc };

  onProgress?.(90, 'Notificando administração...');
  try {
    await notifyProgramacaoAnexo(programacao, anexo);
  } catch (err) {
    console.error('Falha ao criar notificação de anexo:', err);
  }

  const status = normalizeStatus(programacao.status);
  if (!isRealizada(status) && canAttachAnexo(status)) {
    try {
      await markProgramacaoRealizadaPorAnexo(programacao.id);
    } catch (err) {
      console.error('Falha ao marcar Realizada:', err);
    }
  }

  onProgress?.(100, 'Concluído');
  return anexo;
}

/** Monta Blob a partir dos chunks (para download/visualização) */
export async function getAnexoBlob(anexo) {
  if (!anexo?.id) throw new Error('Anexo inválido.');

  if (anexo.downloadUrl && String(anexo.downloadUrl).startsWith('data:')) {
    const res = await fetch(anexo.downloadUrl);
    return res.blob();
  }
  if (anexo.downloadUrl && /^https?:/i.test(anexo.downloadUrl)) {
    const res = await fetch(anexo.downloadUrl);
    if (!res.ok) throw new Error('Não foi possível baixar o arquivo.');
    return res.blob();
  }

  if (!db) throw new Error('Firebase não configurado.');
  const snap = await getDocs(collection(db, 'programacao_anexos', anexo.id, 'chunks'));
  if (!snap.docs.length) throw new Error('Conteúdo do anexo não encontrado.');

  const ordered = snap.docs
    .map((d) => d.data())
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const base64 = ordered.map((c) => c.data || '').join('');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: anexo.mimeType || 'application/octet-stream' });
}

export async function openAnexo(anexo) {
  const blob = await getAnexoBlob(anexo);
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.download = anexo.nomeArquivo || 'anexo';
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
