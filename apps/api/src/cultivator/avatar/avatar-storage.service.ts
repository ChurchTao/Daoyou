import type { AvatarSize } from '@daoyou/contracts/player/avatar';
import { Inject, Injectable } from '@nestjs/common';
import { AppConfigService } from '@server/config/app-config.service.js';
import COS from 'cos-nodejs-sdk-v5';
import { createHash } from 'node:crypto';

@Injectable()
export class AvatarStorageService {
  private readonly client: COS | undefined;
  private readonly bucket: string;
  private readonly region: string;

  constructor(@Inject(AppConfigService) config: AppConfigService) {
    this.bucket = config.get('AVATAR_COS_BUCKET') ?? '';
    this.region = config.get('AVATAR_COS_REGION') ?? '';
    const SecretId = config.get('AVATAR_COS_SECRET_ID');
    const SecretKey = config.get('AVATAR_COS_SECRET_KEY');
    if (this.bucket && this.region && SecretId && SecretKey) {
      this.client = new COS({ SecretId, SecretKey, Timeout: 15_000 });
    }
  }

  get configured() {
    return this.client !== undefined;
  }

  private object(id: string, size: AvatarSize) {
    return {
      Bucket: this.bucket,
      Region: this.region,
      Key: `avatars/${id}/${size}.webp`,
    };
  }

  private requireClient() {
    if (!this.client) throw new Error('Avatar storage is not configured');
    return this.client;
  }

  async save(id: string, size: AvatarSize, body: Buffer, retry: boolean) {
    const client = this.requireClient();
    const object = this.object(id, size);
    const digest = createHash('md5').update(body);
    const contentMD5 = digest.copy().digest('base64');
    const etag = digest.digest('hex');
    if (retry) {
      const existing = await client.headObject(object).catch(() => undefined);
      if (
        existing?.headers?.etag === `"${etag}"` &&
        Number(existing.headers['content-length']) === body.length
      )
        return;
    }
    await client.putObject({
      ...object,
      Body: body,
      ContentLength: body.length,
      Headers: { 'Content-MD5': contentMD5 },
      ContentType: 'image/webp',
      ContentDisposition: 'inline',
    });
    const result = await client.headObject(object);
    if (Number(result.headers?.['content-length']) !== body.length) {
      throw new Error('Stored avatar has an unexpected length');
    }
  }

  signedImageUrl(id: string, size: AvatarSize) {
    return this.requireClient().getObjectUrl({
      ...this.object(id, size),
      Sign: true,
      Protocol: 'https:',
      Expires: 60,
      Query: { 'response-cache-control': 'private, no-store' },
    });
  }

  async remove(id: string, size: AvatarSize) {
    await this.requireClient().deleteObject(this.object(id, size));
  }
}
