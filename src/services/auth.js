import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase/config.js';

export function mapUser(fbUser) {
  if (!fbUser) return null;
  return {
    uid: fbUser.uid,
    email: fbUser.email,
    nome: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuário',
  };
}

export function watchAuth(callback) {
  if (!isFirebaseConfigured || !auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, (user) => callback(mapUser(user)));
}

export async function registerAccount({ email, password, nome }) {
  if (!auth) throw new Error('Firebase não configurado. Crie o arquivo .env com suas credenciais.');
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (nome) await updateProfile(cred.user, { displayName: nome });
  return mapUser(cred.user);
}

export async function loginWithEmail(email, password) {
  if (!auth) throw new Error('Firebase não configurado. Crie o arquivo .env com suas credenciais.');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return mapUser(cred.user);
}

export async function logoutUser() {
  if (auth) await signOut(auth);
}

export async function resetPassword(email) {
  if (!auth) throw new Error('Firebase não configurado.');
  await sendPasswordResetEmail(auth, email);
}

export function getAuthErrorMessage(code) {
  const messages = {
    'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
    'auth/user-not-found': 'Usuário não encontrado.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
  };
  return messages[code] || 'Erro ao autenticar. Verifique seus dados.';
}
