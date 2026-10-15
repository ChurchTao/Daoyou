import { TransferChallengeSchema, type TransferChallenge } from '@daoyou/contracts/transfer';
import { AppConfigService } from '@server/config/app-config.service.js';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { createHash, createPrivateKey, createPublicKey, type KeyObject } from 'node:crypto';
import { CompactEncrypt, CompactSign, compactDecrypt, compactVerify, decodeProtectedHeader } from 'jose';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

@Injectable()
export class TransferCrypto {
  readonly serverId: string | undefined;
  private readonly signingKey: KeyObject | undefined;
  private readonly encryptionKey: KeyObject | undefined;

  constructor(@Inject(AppConfigService) config: AppConfigService) {
    this.serverId = config.get('TRANSFER_SERVER_ID');
    const signing = config.get('TRANSFER_SIGNING_PRIVATE_KEY_B64');
    const encryption = config.get('TRANSFER_ENCRYPTION_PRIVATE_KEY_B64');
    if (signing && encryption) {
      this.signingKey = createPrivateKey(Buffer.from(signing, 'base64'));
      this.encryptionKey = createPrivateKey(Buffer.from(encryption, 'base64'));
      if (this.signingKey.asymmetricKeyType !== 'ed25519' || this.encryptionKey.asymmetricKeyType !== 'rsa')
        throw new Error('Transfer requires Ed25519 signing and RSA encryption keys');
    }
  }

  private requireKeys() {
    if (!this.serverId || !this.signingKey || !this.encryptionKey)
      throw new HttpException({ error: '此服务器未启用转服' }, 503);
    return { serverId: this.serverId, signingKey: this.signingKey, encryptionKey: this.encryptionKey };
  }

  publicIdentity() {
    const { serverId, signingKey, encryptionKey } = this.requireKeys();
    return {
      serverId,
      signingPublicKey: createPublicKey(signingKey).export({ type: 'spki', format: 'pem' }).toString(),
      encryptionPublicKey: createPublicKey(encryptionKey).export({ type: 'spki', format: 'pem' }).toString(),
    };
  }

  async signChallenge(challenge: TransferChallenge): Promise<string> {
    const { serverId, signingKey } = this.requireKeys();
    return new CompactSign(textEncoder.encode(JSON.stringify(challenge)))
      .setProtectedHeader({ alg: 'EdDSA', kid: serverId, typ: 'daoyou-transfer-challenge-v1' })
      .sign(signingKey);
  }

  async verifyChallenge(compact: string, requireUnexpired = true): Promise<TransferChallenge> {
    if (compact.length > 15_000) throw new Error('导入凭证过大');
    const encoded = compact.split('.')[1];
    if (!encoded) throw new Error('导入凭证格式错误');
    const untrusted = TransferChallengeSchema.parse(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')));
    const key = createPublicKey(untrusted.signingPublicKey);
    const verified = await compactVerify(compact, key, { algorithms: ['EdDSA'] });
    const challenge = TransferChallengeSchema.parse(JSON.parse(textDecoder.decode(verified.payload)));
    if (JSON.stringify(challenge) !== JSON.stringify(untrusted) || verified.protectedHeader.kid !== challenge.targetServerId)
      throw new Error('导入凭证签名与目标服务器不一致');
    if (requireUnexpired && Date.parse(challenge.expiresAt) <= Date.now()) throw new Error('导入凭证已过期');
    const encryptionKey = createPublicKey(challenge.encryptionPublicKey);
    if (encryptionKey.asymmetricKeyType !== 'rsa' || key.asymmetricKeyType !== 'ed25519')
      throw new Error('导入凭证密钥类型无效');
    return challenge;
  }

  async seal(snapshot: unknown, challenge: TransferChallenge): Promise<string> {
    const { serverId, signingKey } = this.requireKeys();
    const encrypted = await new CompactEncrypt(textEncoder.encode(JSON.stringify(snapshot)))
      .setProtectedHeader({ alg: 'RSA-OAEP-256', enc: 'A256GCM', typ: 'daoyou-transfer-v1' })
      .encrypt(createPublicKey(challenge.encryptionPublicKey));
    return new CompactSign(textEncoder.encode(encrypted))
      .setProtectedHeader({ alg: 'EdDSA', kid: serverId, typ: 'daoyou-transfer-v1' })
      .sign(signingKey);
  }

  sourceId(compact: string): string {
    const header = decodeProtectedHeader(compact);
    if (header.alg !== 'EdDSA' || header.typ !== 'daoyou-transfer-v1' || typeof header.kid !== 'string')
      throw new Error('转服包头无效');
    return header.kid;
  }

  async open(compact: string, sourcePublicKey: string): Promise<unknown> {
    const { encryptionKey } = this.requireKeys();
    if (compact.length > 500_000) throw new Error('转服包过大');
    const verified = await compactVerify(compact, createPublicKey(sourcePublicKey), { algorithms: ['EdDSA'] });
    const encrypted = textDecoder.decode(verified.payload);
    const decrypted = await compactDecrypt(encrypted, encryptionKey, { keyManagementAlgorithms: ['RSA-OAEP-256'], contentEncryptionAlgorithms: ['A256GCM'] });
    if (decrypted.plaintext.length > 256_000) throw new Error('转服存档过大');
    return JSON.parse(textDecoder.decode(decrypted.plaintext));
  }

  hash(compact: string) { return createHash('sha256').update(compact).digest('hex'); }

  async signReceipt(input: { requestId: string; packageHash: string; status: 'imported' | 'rejected' }): Promise<string> {
    const { serverId, signingKey } = this.requireKeys();
    return new CompactSign(textEncoder.encode(JSON.stringify({ ...input, targetServerId: serverId })))
      .setProtectedHeader({ alg: 'EdDSA', kid: serverId, typ: 'daoyou-transfer-receipt-v1' })
      .sign(signingKey);
  }

  async verifyReceipt(compact: string, challenge: TransferChallenge): Promise<{ requestId: string; packageHash: string; status: 'imported' | 'rejected'; targetServerId: string }> {
    if (compact.length > 4096) throw new Error('转服回执过大');
    const verified = await compactVerify(compact, createPublicKey(challenge.signingPublicKey), { algorithms: ['EdDSA'] });
    if (verified.protectedHeader.kid !== challenge.targetServerId || verified.protectedHeader.typ !== 'daoyou-transfer-receipt-v1')
      throw new Error('转服回执来源不一致');
    const value = JSON.parse(textDecoder.decode(verified.payload)) as Record<string, unknown>;
    if (value['targetServerId'] !== challenge.targetServerId || value['requestId'] !== challenge.requestId ||
      (value['status'] !== 'imported' && value['status'] !== 'rejected') || typeof value['packageHash'] !== 'string')
      throw new Error('转服回执内容无效');
    return value as { requestId: string; packageHash: string; status: 'imported' | 'rejected'; targetServerId: string };
  }
}
