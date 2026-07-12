import {
  Bytes,
  collection, doc, addDoc, setDoc, getDoc, getDocs, onSnapshot, query, orderBy, limit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config.js';
import { auth } from '../firebase/config.js';
import { getProgramacaoById, getProgramacaoRawById, markProgramacaoRealizadaPorAnexo } from './programacoes-service.js';
import { notifyProgramacaoAnexo } from './notifications-service.js';
import { canAttachAnexo, isRealizada } from '../utils/status.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
/** 1 doc ~1 MB → arquivo pequeno em 1 gravação */
const SINGLE_DOC_MAX = 900 * 1024;
/** Partes grandes = menos idas ao servidor */
const CHUNK_SIZE = 900 * 1024;
const WRITE_TIMEOUT_MS = 45000;

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
    limit(300),
  );

  unsub = onSnapshot(q, (snap) => {
    anexosCache = snap.docs.map((d) => {
      const data = d.data();
      const { conteudoBytes, conteudo, ...rest } = data;
      return {
        id: d.id,
        ...rest,
        hasConteudo: Boolean(conteudoBytes || conteudo) || (rest.chunkCount > 0) || Boolean(rest.downloadUrl),
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
  if (code === 'permission-denied') return 'Sem permissão para registrar o anexo.';
  if (err?.message?.includes('timeout') || code === 'upload-timeout') {
    return 'O envio demorou demais. Verifique a internet e tente de novo.';
  }
  return err?.message || 'Erro ao enviar anexo.';
}

export function canUploadAnexo(programacao) {
  if (!programacao?.id) return false;
  return canAttachAnexo(programacao.status);
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error('timeout'), { code: 'upload-timeout' }));
    }, ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

function formatMb(n) {
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function splitBytes(uint8) {
  const chunks = [];
  for (let i = 0; i < uint8.length; i += CHUNK_SIZE) {
    chunks.push(uint8.subarray(i, i + CHUNK_SIZE));
  }
  return chunks.length ? chunks : [new Uint8Array(0)];
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
 * Envio rápido até 10 MB sem Storage pago.
 * Arquivo grande: todas as partes sobem AO MESMO TEMPO (paralelo total).
 *
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

  onProgress?.(5, 'Preparando...');
  // arrayBuffer é mais rápido que FileReader
  const bytes = new Uint8Array(await file.arrayBuffer());
  onProgress?.(15, 'Enviando...');

  // Pequeno: 1 gravação
  if (file.size <= SINGLE_DOC_MAX) {
    const anexoDoc = buildMeta(programacao, user, file, contentType, {
      storedIn: 'firestore',
      chunkCount: 0,
      conteudoBytes: Bytes.fromUint8Array(bytes),
    });
    const refDoc = await withTimeout(
      addDoc(collection(db, 'programacao_anexos'), anexoDoc),
      WRITE_TIMEOUT_MS,
    );
    const anexo = { id: refDoc.id, ...anexoDoc, hasConteudo: true };
    delete anexo.conteudoBytes;
    onProgress?.(90, 'Finalizando...');
    finishSideEffects(programacao, anexo).catch((err) => console.error(err));
    onProgress?.(100, 'Concluído');
    return anexo;
  }

  // Até 10 MB: metadados + TODAS as partes em paralelo (1 onda de rede)
  const parts = splitBytes(bytes);
  const anexoDoc = buildMeta(programacao, user, file, contentType, {
    storedIn: 'firestore-chunks',
    chunkCount: parts.length,
  });
  const refDoc = await withTimeout(
    addDoc(collection(db, 'programacao_anexos'), anexoDoc),
    WRITE_TIMEOUT_MS,
  );
  const anexoId = refDoc.id;

  let sentBytes = 0;
  onProgress?.(20, `Enviando 0.0 / ${formatMb(file.size)}`);

  await Promise.all(parts.map((part, index) => (
    withTimeout(
      setDoc(doc(db, 'programacao_anexos', anexoId, 'chunks', String(index)), {
        index,
        encoding: 'bytes',
        data: Bytes.fromUint8Array(part),
      }),
      WRITE_TIMEOUT_MS,
    ).then(() => {
      sentBytes += part.byteLength;
      const pct = 20 + Math.round((sentBytes / file.size) * 70);
      onProgress?.(Math.min(92, pct), `Enviando ${formatMb(Math.min(sentBytes, file.size))} / ${formatMb(file.size)}`);
    })
  )));

  const anexo = { id: anexoId, ...anexoDoc, hasConteudo: true };
  onProgress?.(95, 'Finalizando...');
  finishSideEffects(programacao, anexo).catch((err) => console.error(err));
  onProgress?.(100, 'Concluído');
  return anexo;
}

function bytesFieldToUint8(value) {
  if (!value) return null;
  if (value instanceof Uint8Array) return value;
  if (typeof value.toUint8Array === 'function') return value.toUint8Array();
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return null;
}

function base64ToUint8(base64) {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

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
  const snap = await getDoc(doc(db, 'programacao_anexos', anexo.id));
  if (!snap.exists()) throw new Error('Anexo não encontrado.');
  const data = snap.data();
  const mime = data.mimeType || anexo.mimeType || 'application/octet-stream';

  if (data.downloadUrl && /^https?:/i.test(data.downloadUrl)) {
    const res = await fetch(data.downloadUrl);
    if (!res.ok) throw new Error('Não foi possível baixar o arquivo.');
    return res.blob();
  }

  const raw = bytesFieldToUint8(data.conteudoBytes);
  if (raw) return new Blob([raw], { type: mime });
  if (data.conteudo) return new Blob([base64ToUint8(data.conteudo)], { type: mime });

  const chunkSnap = await getDocs(collection(db, 'programacao_anexos', anexo.id, 'chunks'));
  if (!chunkSnap.docs.length) throw new Error('Conteúdo do anexo não encontrado.');

  const ordered = chunkSnap.docs
    .map((d) => d.data())
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  const parts = ordered.map((c) => {
    const asBytes = bytesFieldToUint8(c.data);
    if (asBytes) return asBytes;
    if (typeof c.data === 'string') return base64ToUint8(c.data);
    return new Uint8Array(0);
  });
  const total = parts.reduce((n, p) => n + p.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  parts.forEach((p) => {
    merged.set(p, offset);
    offset += p.length;
  });
  return new Blob([merged], { type: mime });
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
