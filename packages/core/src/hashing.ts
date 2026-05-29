import CryptoJS from 'crypto-js';

export function md5(input: string): string {
  return CryptoJS.MD5(input).toString();
}

export function sha256(input: string): string {
  return CryptoJS.SHA256(input).toString();
}

export function sha1(input: string): string {
  return CryptoJS.SHA1(input).toString();
}

export function sha512(input: string): string {
  return CryptoJS.SHA512(input).toString();
}
