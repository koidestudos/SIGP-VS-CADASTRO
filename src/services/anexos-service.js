import {
  Bytes,
  collection, doc, addDoc, setDoc, getDoc, getDocs, onSnapshot, query, orderBy, limit,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, isFirebaseConfigured } from '../firebase/config.js';
import { auth } from '../firebase/config.js';
import { getProgramacaoById, getProgramacaoRawById, markProgramacaoRealizadaPorAnexo } from './programacoes-service.js';
import { notifyProgramacaoAnexo } from './notifications-service.js';
import { canAttachAnexo, isRealizada } from '../utils/status.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SINGLE_DOC_MAX = 850 * 1024;
const CHUNK_SIZE = 800 * 1024;
const PARALLEL = 8;
const CHUNK_TIMEOUT_MS = 30000;

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
  if (code === 'storage/unauthorized' || code === 'storage/unauthenticated') {
    return 'Sem permissão no Cloud Storage. Publique as regras do Storage ou use o envio pelo Firestore.';
  }
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

function readFileBuffer(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (!e.lengthComputable) return;
      onProgress?.(Math.max(2, Math.round((e.loaded / e.total) * 15)), `Lendo ${formatMb(e.loaded)}...`);
    };
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsArrayBuffer(file);
  });
}

function splitBytes(uint8) {
  const chunks = [];
  for (let i = 0; i < uint8.length; i += CHUNK_SIZE) {
    chunks.push(uint8.subarray(i, i + CHUNK_SIZE));
  }
  return chunks.length ? chunks : [new Uint8Array(0)];
}

async function runPool(items, concurrency, worker) {
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length || 1) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
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

/** Um único upload de até 10 MB via Cloud Storage (cota gratuita). */
function uploadViaCloudStorage(file, programacaoId, user, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    if (!storage) {
      reject(new Error('Cloud Storage não configurado.'));
      return;
    }
    const safe = (file.name || 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    const path = `programacoes/${programacaoId}/${Date.now()}_${safe}`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file, {
      contentType,
      customMetadata: { programacaoId, enviadoPor: user.uid },
    });

    const timer = setTimeout(() => {
      try { task.cancel(); } catch { /* ignore */ }
      reject(Object.assign(new Error('timeout'), { code: 'upload-timeout' }));
    }, 120000);

    task.on(
      'state_changed',
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / Math.max(snap.totalBytes, 1)) * 85) + 5;
        onProgress?.(
          Math.min(90, pct),
          `Enviando ${formatMb(snap.bytesTransferred)} / ${formatMb(snap.totalBytes)}`,
        );
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
      async () => {
        clearTimeout(timer);
        try {
          const downloadUrl = await getDownloadURL(task.snapshot.ref);
          resolve({ downloadUrl, storagePath: path });
        } catch (err) {
          reject(err);
        }
      },
    );
  });
}

/** Envio “de uma vez” (um clique) até 10 MB pelo Firestore, em paralelo por baixo. */
async function uploadViaFirestore(file, programacao, user, contentType, bytes, onProgress) {
  if (file.size <= SINGLE_DOC_MAX) {
    onProgress?.(40, 'Enviando...');
    const anexoDoc = buildMeta(programacao, user, file, contentType, {
      storedIn: 'firestore',
      chunkCount: 0,
      conteudoBytes: Bytes.fromUint8Array(bytes),
    });
    const refDoc = await withTimeout(
      addDoc(collection(db, 'programacao_anexos'), anexoDoc),
      CHUNK_TIMEOUT_MS,
    );
    const anexo = { id: refDoc.id, ...anexoDoc, hasConteudo: true };
    delete anexo.conteudoBytes;
    return anexo;
  }

  const parts = splitBytes(bytes);
  onProgress?.(18, `Enviando 0.0 / ${formatMb(file.size)}`);

  const anexoDoc = buildMeta(programacao, user, file, contentType, {
    storedIn: 'firestore-chunks',
    chunkCount: parts.length,
  });
  const refDoc = await withTimeout(
    addDoc(collection(db, 'programacao_anexos'), anexoDoc),
    CHUNK_TIMEOUT_MS,
  );
  const anexoId = refDoc.id;

  let sentBytes = 0;
  await runPool(parts, PARALLEL, async (part, index) => {
    await withTimeout(
      setDoc(doc(db, 'programacao_anexos', anexoId, 'chunks', String(index)), {
        index,
        encoding: 'bytes',
        data: Bytes.fromUint8Array(part),
      }),
      CHUNK_TIMEOUT_MS,
    );
    sentBytes += part.byteLength;
    const pct = 20 + Math.round((sentBytes / file.size) * 70);
    onProgress?.(Math.min(92, pct), `Enviando ${formatMb(sentBytes)} / ${formatMb(file.size)}`);
  });

  return { id: anexoId, ...anexoDoc, hasConteudo: true };
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

  // Preferência: Cloud Storage = 1 upload contínuo de até 10 MB (cota free)
  if (storage && file.size > SINGLE_DOC_MAX) {
    onProgress?.(5, 'Enviando arquivo...');
    try {
      const uploaded = await uploadViaCloudStorage(file, programacaoId, user, contentType, onProgress);
      const anexoDoc = buildMeta(programacao, user, file, contentType, {
        storedIn: 'storage',
        chunkCount: 0,
        storagePath: uploaded.storagePath,
        downloadUrl: uploaded.downloadUrl,
      });
      const refDoc = await addDoc(collection(db, 'programacao_anexos'), anexoDoc);
      const anexo = { id: refDoc.id, ...anexoDoc, hasConteudo: true };
      onProgress?.(95, 'Finalizando...');
      finishSideEffects(programacao, anexo).catch((err) => console.error(err));
      onProgress?.(100, 'Concluído');
      return anexo;
    } catch (err) {
      console.warn('Cloud Storage indisponível, usando Firestore:', err);
      onProgress?.(10, 'Alternativa: enviando pelo banco...');
    }
  }

  onProgress?.(5, 'Lendo arquivo...');
  const bytes = await readFileBuffer(file, onProgress);
  const anexo = await uploadViaFirestore(file, programacao, user, contentType, bytes, onProgress);
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
