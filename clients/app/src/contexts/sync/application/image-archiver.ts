import type { MetadataService } from "@/contexts/metadata/application/metadata-service";
import { normalizeUrl } from "@/contexts/metadata/domain/url";
import { stableUuid } from "@/contexts/metadata/domain/uuid";
import type { ImageGateway } from "./ports";

export class ImageArchiver {
  constructor(
    private readonly gateway: ImageGateway,
    private readonly metadata: MetadataService,
    private readonly isEnabled: () => Promise<boolean>,
  ) {}

  async archive(bookmarkUrl: string, imageUrl: string): Promise<string | null> {
    if (!(await this.isEnabled())) return null;
    const uuid = await stableUuid(normalizeUrl(bookmarkUrl));
    const { key } = await this.gateway.fetchAndStore({ uuid, url: imageUrl });
    await this.metadata.setImageKey(bookmarkUrl, key);
    return key;
  }
}
