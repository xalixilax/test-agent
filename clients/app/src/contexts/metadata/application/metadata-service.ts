import type { Clock } from "@/shared/clock";
import type { MetadataRepository } from "../domain/metadata-repository";
import { serializeRating, serializeTags } from "../domain/metadata";

export class MetadataService {
  constructor(
    private readonly repository: MetadataRepository,
    private readonly clock: Clock,
    private readonly onChange?: () => void,
  ) {}

  private async write(
    url: string,
    field: "note" | "rating" | "tags" | "screenshot_url" | "image_key",
    value: string | null,
  ): Promise<void> {
    const deviceId = await this.repository.getDeviceId();
    await this.repository.setFieldByUrl({
      url,
      field,
      value,
      updatedAt: this.clock.now(),
      deviceId,
    });
    this.onChange?.();
  }

  async setNote(url: string, note: string): Promise<void> {
    const trimmed = note.trim();
    await this.write(url, "note", trimmed === "" ? null : trimmed);
  }

  async setRating(url: string, rating: number | null): Promise<void> {
    await this.write(url, "rating", rating === null ? null : serializeRating(rating));
  }

  async setTags(url: string, tags: string[]): Promise<void> {
    const serialized = serializeTags(tags);
    await this.write(url, "tags", serialized === "[]" ? null : serialized);
  }

  async setScreenshotUrl(url: string, screenshotUrl: string): Promise<void> {
    await this.write(url, "screenshot_url", screenshotUrl);
  }

  async clearScreenshot(url: string): Promise<void> {
    await this.write(url, "screenshot_url", null);
    await this.write(url, "image_key", null);
  }

  async setImageKey(url: string, imageKey: string): Promise<void> {
    await this.write(url, "image_key", imageKey);
  }

  async purge(url: string): Promise<void> {
    const deviceId = await this.repository.getDeviceId();
    await this.repository.purgeByUrl(url, this.clock.now(), deviceId);
    this.onChange?.();
  }

  async setDeviceName(name: string): Promise<void> {
    await this.repository.setDeviceName(name.trim(), this.clock.now());
    this.onChange?.();
  }
}
