import {
  AVATAR_SIZES,
  type AvatarFailure,
} from '@daoyou/contracts/player/avatar';
import { AiService } from '@nestjs/ai';
import { Inject, Injectable } from '@nestjs/common';
import { AppConfigService } from '@server/config/app-config.service.js';
import {
  renderPrompt,
  renderPromptUser,
} from '@server/lib/prompts/registry.js';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { AvatarStorageService } from './avatar-storage.service.js';

const ARK_IMAGES_URL =
  'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const IMAGE_LIMIT = 12 * 1024 * 1024;
const ArkImagesResponse = z.object({
  data: z
    .array(z.object({ url: z.url().optional(), error: z.unknown().optional() }))
    .optional(),
  error: z.object({ code: z.string() }).optional(),
});
const AppearanceSchema = z.object({
  appearance: z.string().trim().min(2).max(90).nullable(),
});

export class AvatarRenderError extends Error {
  constructor(readonly reason: AvatarFailure) {
    super(reason);
  }
}

function checkImageUrl(value: string) {
  const url = new URL(value);
  // Only the fixed Ark provider may select a TOS result endpoint.
  if (
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    !url.hostname.endsWith('.volces.com')
  ) {
    throw new AvatarRenderError('generation');
  }
  return url;
}

function provenance(id: string, size: string) {
  const metadata = JSON.stringify({
    Label: '1',
    ContentProducer: '万界道友',
    ProduceID: `${id}-${size}`,
  });
  return `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:TC260="http://www.tc260.org.cn/ns/AIGC/1.0/"><TC260:AIGC>${metadata}</TC260:AIGC></rdf:Description></rdf:RDF></x:xmpmeta>`;
}

@Injectable()
export class AvatarRendererService {
  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(AiService) private readonly ai: AiService,
    @Inject(AvatarStorageService)
    private readonly storage: AvatarStorageService,
  ) {}

  get configured() {
    return Boolean(
      this.storage.configured &&
      this.config.get('ARK_AVATAR_API_KEY') &&
      this.config.get('ALIBABA_API_KEY')?.trim(),
    );
  }

  async generate(description: string, userId: string) {
    const key = this.config.get('ARK_AVATAR_API_KEY');
    if (!key) throw new AvatarRenderError('generation');
    const request = renderPrompt('cultivator-avatar-appearance', {
      input: JSON.stringify({ description }),
    });
    const { object } = await this.ai.generateObject({
      model: 'alibaba.fast',
      instructions: request.system,
      prompt: request.user,
      schema: AppearanceSchema,
      label: 'cultivator-avatar-appearance',
      abortSignal: AbortSignal.timeout(25_000),
    });
    if (!object.appearance || /[\r\n{}<>]/u.test(object.appearance)) {
      throw new AvatarRenderError('description');
    }

    const response = await fetch(ARK_IMAGES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(75_000),
      body: JSON.stringify({
        model: 'doubao-seedream-5-5-261028',
        prompt: renderPromptUser('cultivator-avatar', {
          appearance: object.appearance,
        }),
        size: '1024x1024',
        output_format: 'png',
        background: 'transparent',
        response_format: 'url',
        watermark: false,
        safety_identifier: createHash('sha256').update(userId).digest('hex'),
      }),
    });
    const output = ArkImagesResponse.parse(await response.json());
    const image = output.data?.[0];
    if (
      !response.ok ||
      output.error ||
      image?.error ||
      output.data?.length !== 1 ||
      !image?.url
    ) {
      const code =
        output.error?.code ??
        z.object({ code: z.string() }).safeParse(image?.error).data?.code;
      throw new AvatarRenderError(
        code?.includes('SensitiveContent') ? 'moderation' : 'generation',
      );
    }
    return checkImageUrl(image.url).href;
  }

  async process(id: string, sourceUrl: string, retry: boolean) {
    const response = await fetch(checkImageUrl(sourceUrl), {
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    });
    if (
      !response.ok ||
      !response.body ||
      Number(response.headers.get('content-length')) > IMAGE_LIMIT
    ) {
      throw new Error('Unable to download avatar image');
    }
    const buffers: Uint8Array[] = [];
    const reader = response.body.getReader();
    let length = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > IMAGE_LIMIT) {
          await reader.cancel();
          throw new AvatarRenderError('generation');
        }
        buffers.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const image = sharp(Buffer.concat(buffers, length), {
      limitInputPixels: 1_048_576,
    });
    const metadata = await image.metadata();
    if (
      metadata.format !== 'png' ||
      metadata.width !== 1024 ||
      metadata.height !== 1024 ||
      !metadata.hasAlpha
    ) {
      throw new AvatarRenderError('generation');
    }
    const { channels } = await image.stats();
    const alpha = channels[3];
    if (!alpha || alpha.min !== 0 || alpha.max === 0)
      throw new AvatarRenderError('generation');
    // Wait for all writes before allowing a cleanup or a retry of this job.
    const writes = await Promise.allSettled(
      AVATAR_SIZES.map(async (size) => {
        const bytes = await image
          .clone()
          .resize(Number(size), Number(size))
          .withXmp(provenance(id, size))
          .webp({ quality: 86, alphaQuality: 100 })
          .toBuffer();
        await this.storage.save(id, size, bytes, retry);
      }),
    );
    if (writes.some((write) => write.status === 'rejected'))
      throw new Error('Avatar upload failed');
  }
}
