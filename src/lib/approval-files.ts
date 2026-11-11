// Task 30: which files can be attached as a customer's approval, checked by their CONTENT (not just the name): a PDF, a JPEG
// or PNG image, or a saved email (.eml or Outlook .msg). Never SVG, HTML or anything that could run in a browser; every file
// is downloaded as an attachment, never shown inline. Pure (the tests load this file directly).
export const APPROVAL_MAX_BYTES = 10 * 1024 * 1024;
export type ApprovalFileType = 'application/pdf' | 'image/jpeg' | 'image/png' | 'message/rfc822' | 'application/vnd.ms-outlook';
const EXT: Record<ApprovalFileType, string[]> = {
  'application/pdf': ['pdf'], 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'message/rfc822': ['eml'], 'application/vnd.ms-outlook': ['msg'],
};
const starts = (b: Uint8Array, sig: number[]) => sig.every((v, i) => b[i] === v);

/** The file's real type from its first bytes and its name, or why it is refused. */
export function checkApprovalFile(bytes: Uint8Array, fileName: string): { type: ApprovalFileType; ext: string } | { error: string } {
  if (!bytes.length) return { error: 'The file is empty.' };
  if (bytes.length > APPROVAL_MAX_BYTES) return { error: 'The file is over 10 MB.' };
  const ext = (fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '');
  let type: ApprovalFileType | null = null;
  if (starts(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) type = 'application/pdf'; // %PDF-
  else if (starts(bytes, [0xff, 0xd8, 0xff])) type = 'image/jpeg';
  else if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) type = 'image/png';
  else if (starts(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) type = 'application/vnd.ms-outlook'; // Outlook .msg
  else {
    // A saved email is plain text that starts with mail headers. HTML, SVG and anything with NUL bytes is refused.
    const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 4096));
    const looksLikeMarkup = /^\s*(<\?xml|<!doctype|<html|<svg|<)/i.test(head);
    const headers = head.split(/\r?\n/).slice(0, 40).filter((l) => /^(From|To|Subject|Date|Received|Return-Path|MIME-Version|Message-ID|Delivered-To):/i.test(l)).length;
    if (!looksLikeMarkup && !head.includes('\u0000') && headers >= 2) type = 'message/rfc822';
  }
  if (!type) return { error: 'Only a PDF, a JPEG or PNG image, or a saved email (.eml or .msg) can be attached.' };
  if (!EXT[type].includes(ext)) return { error: `The file name ends in ".${ext || '?'}" but the file is a ${type === 'application/pdf' ? 'PDF' : type === 'message/rfc822' ? 'saved email' : type.split('/')[1].toUpperCase()}. Rename it or attach the right file.` };
  return { type, ext };
}

/** A safe file name to show and to download as: letters, digits, spaces, dots, dashes and underscores only. */
export const safeFileName = (name: string) => name.normalize('NFKD').replace(/[^A-Za-z0-9 ._-]+/g, '_').replace(/^[._ ]+/, '').slice(0, 120) || 'approval';
