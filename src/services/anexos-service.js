import {
  collection, doc, addDoc, getDoc, getDocs, writeBatch, onSnapshot, query, orderBy, limit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config.js';
import { auth } from '../firebase/config.js';
import { getProgramacaoById, getProgramacaoRawById, markProgramacaoRealizadaPorAnexo } from './programacoes-service.js';
import { notifyProgramacaoAnexo } from './notifications-service.js';
import { canAttachAnexo, isRealizada } from '../utils/status.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
/** Documento Firestore ~1MB; base64 + metadados → limite seguro para 1 gravação */
const SINGLE_DOC_MAX_BYTES = 450 * 1024;
const CHUNK_CHARS = 350_000;
const BATCH_LIMIT = 400;

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
    anexosCache = snap.docs.map((d) => {
      const data = d.data();
      // Não manter base64 gigante no cache da listagem
      const { conteudo, ...rest } = data;
      return {
        id: d.id,
        ...rest,
        hasConteudo: Boolean(conteudo),
      };
    });
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

function readAsBase64(file) {
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

function buildMeta(programacao, user, file, contentType, extra = {}) {
  return {
    programacaoId: programacao.id,
    programacaoTitulo: programacao.titulo || '',
    coordenacaoId: programacao.coordenacaoId || '',
    nomeArquivo: file.name,
    tamanho: file.size,
    mimeType: contentType,
    storagePath: '',
    downloadUrl: '',
    enviadoPor: user.uid,
    enviadoPorNome: user.displayName || user.email?.split('@')[0] || 'Usuário',
    enviadoPorEmail: user.email || '',
    enviadoEm: new Date().toISOString(),
    ...extra,
  };
}

async function finishSideEffects(programacao, anexo) {
  await Promise.allSettled([
    notifyProgramacaoAnexo(programacao, anexo),
    (!isRealizada(programacao.status) && canAttachAnexo(programacao.status))
      ? markProgramacaoRealizadaPorAnexo(programacao.id)
      : Promise.resolve(),
  ]);
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
  onProgress?.(10, 'Lendo arquivo...');
  const base64 = await readAsBase64(file);

  // PDF pequeno: 1 única gravação (rápido)
  if (file.size <= SINGLE_DOC_MAX_BYTES) {
    onProgress?.(60, 'Salvando...');
    const anexoDoc = buildMeta(programacao, user, file, contentType, {
      storedIn: 'firestore',
      chunkCount: 0,
      conteudo: base64,
    });
    const refDoc = await addDoc(collection(db, 'programacao_anexos'), anexoDoc);
    const anexo = { id: refDoc.id, ...anexoDoc, hasConteudo: true };
    delete anexo.conteudo;

    onProgress?.(90, 'Finalizando...');
    // Não bloqueia a UI se notificação/status demorarem
    finishSideEffects(programacao, anexo).catch((err) => console.error(err));
    onProgress?.(100, 'Concluído');
    return anexo;
  }

  // Arquivo maior: metadados + chunks em lotes (paralelo)
  onProgress?.(25, 'Preparando envio...');
  const chunks = [];
  for (let i = 0; i < base64.length; i += CHUNK_CHARS) {
    chunks.push(base64.slice(i, i + CHUNK_CHARS));
  }

  const anexoDoc = buildMeta(programacao, user, file, contentType, {
    storedIn: 'firestore-chunks',
    chunkCount: chunks.length,
  });
  const refDoc = await addDoc(collection(db, 'programacao_anexos'), anexoDoc);
  const anexoId = refDoc.id;

  for (let start = 0; start < chunks.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const slice = chunks.slice(start, start + BATCH_LIMIT);
    slice.forEach((data, offset) => {
      const index = start + offset;
      batch.set(doc(db, 'programacao_anexos', anexoId, 'chunks', String(index)), { index, data });
    });
    await batch.commit();
    const pct = 30 + Math.round(((start + slice.length) / chunks.length) * 60);
    onProgress?.(pct, `Enviando... ${Math.min(start + slice.length, chunks.length)}/${chunks.length}`);
  }

  const anexo = { id: anexoId, ...anexoDoc };
  onProgress?.(95, 'Finalizando...');
  finishSideEffects(programacao, anexo).catch((err) => console.error(err));
  onProgress?.(100, 'Concluído');
  return anexo;
}

async function loadAnexoConteudo(anexoId) {
  const snap = await getDoc(doc(db, 'programacao_anexos', anexoId));
  if (!snap.exists()) throw new Error('Anexo não encontrado.');
  return { id: snap.id, ...snap.data() };
}

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}

/** Monta Blob a partir do conteúdo ou chunks */
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

  const full = await loadAnexoConteudo(anexo.id);
  if (full.conteudo) {
    return base64ToBlob(full.conteudo, full.mimeType || anexo.mimeType);
  }

  const snap = await getDocs(collection(db, 'programacao_anexos', anexo.id, 'chunks'));
  if (!snap.docs.length) throw new Error('Conteúdo do anexo não encontrado.');

  const ordered = snap.docs
    .map((d) => d.data())
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const base64 = ordered.map((c) => c.data || '').join('');
  return base64ToBlob(base64, full.mimeType || anexo.mimeType);
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
