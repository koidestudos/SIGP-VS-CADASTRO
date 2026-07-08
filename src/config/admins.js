/** E-mails que recebem papel admin automaticamente no primeiro login */
export const BOOTSTRAP_ADMIN_EMAILS = [
  'sandgyferreira@gmail.com',
];

export function isBootstrapAdminEmail(email) {
  if (!email) return false;
  return BOOTSTRAP_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
