import {
  Bytes,
  collection, doc, addDoc, getDoc, getDocs, onSnapshot, query, orderBy, limit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config.js';
import { auth } from '../firebase/config.js';
import { getProgramacaoById, getProgramacaoRawById, markProgramacaoRealizadaPorAnexo } from './programacoes-service.js';
import { notifyProgramacaoAnexo } from './notifications-service.js';
import { canAttachAnexo, isRealizada } from '../utils/status.js';

const MAX_FILE_SIZE = 900 * 1024; // ~900 KB (limite prático do doc Firestore ~1 MB)
const WRITE_TIMEOUT_MS = 20000;

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
      // Listagem leve: sem bytes do arquivo
      const { conteudoBytes, conteudo, ...rest } = data;
      return {
        id: d.id,
        ...rest,
        hasConteudo: Boolean(conteudoBytes || conteudo),
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
    return 'Sem permissão para registrar o anexo.';
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

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error(message), { code: 'upload-timeout' }));
    }, ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

function readFileBuffer(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 40);
      onProgress?.(Math.max(5, pct), 'Lendo arquivo...');
    };
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsArrayBuffer(file);
  });
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
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Arquivo muito grande. Envie um PDF/imagem de até 900 KB (compacte o arquivo se preciso).');
  }
  if (!isAllowedFile(file)) {
    throw new Error('Tipo de arquivo não permitido. Use PDF, imagem ou documento Office.');
  }

  const contentType = guessContentType(file);
  onProgress?.(5, 'Lendo arquivo...');
  const bytes = await readFileBuffer(file, onProgress);

  onProgress?.(55, 'Enviando...');
  const anexoDoc = {
    programacaoId: programacao.id,
    programacaoTitulo: programacao.titulo || '',
    coordenacaoId: programacao.coordenacaoId || '',
    nomeArquivo: file.name,
    tamanho: file.size,
    mimeType: contentType,
    storagePath: '',
    downloadUrl: '',
    storedIn: 'firestore',
    chunkCount: 0,
    conteudoBytes: Bytes.fromUint8Array(bytes),
    enviadoPor: user.uid,
    enviadoPorNome: user.displayName || user.email?.split('@')[0] || 'Usuário',
    enviadoPorEmail: user.email || '',
    enviadoEm: new Date().toISOString(),
  };

  const refDoc = await withTimeout(
    addDoc(collection(db, 'programacao_anexos'), anexoDoc),
    WRITE_TIMEOUT_MS,
    'timeout',
  );

  const anexo = {
    id: refDoc.id,
    ...anexoDoc,
    hasConteudo: true,
  };
  delete anexo.conteudoBytes;

  onProgress?.(90, 'Finalizando...');
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

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return new Blob([out], { type: mimeType || 'application/octet-stream' });
}

/** Monta Blob do anexo para abrir/baixar */
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

  const raw = bytesFieldToUint8(data.conteudoBytes);
  if (raw) {
    return new Blob([raw], { type: data.mimeType || anexo.mimeType || 'application/octet-stream' });
  }
  if (data.conteudo) {
    return base64ToBlob(data.conteudo, data.mimeType || anexo.mimeType);
  }

  // Legado: chunks
  const chunkSnap = await getDocs(collection(db, 'programacao_anexos', anexo.id, 'chunks'));
  if (chunkSnap.docs.length) {
    const ordered = chunkSnap.docs
      .map((d) => d.data())
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    return base64ToBlob(ordered.map((c) => c.data || '').join(''), data.mimeType || anexo.mimeType);
  }

  throw new Error('Conteúdo do anexo não encontrado.');
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
