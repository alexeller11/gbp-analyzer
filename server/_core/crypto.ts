import crypto from 'crypto';

// Chave secreta (deve ter exatamente 32 caracteres)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'gbp-analyzer-secure-key-32-chars!';
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error("[Crypto] Erro ao criptografar:", error);
    return text; // Fallback
  }
}

export function decrypt(text: string): string {
  if (!text) return text;
  if (!text.includes(':')) return text; // Se for um token antigo não criptografado, devolve como está
  
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts[0], 'hex');
    const authTag = Buffer.from(textParts[1], 'hex');
    const encryptedText = Buffer.from(textParts[2], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error("[Crypto] Erro ao descriptografar token:", error);
    return text;
  }
}
