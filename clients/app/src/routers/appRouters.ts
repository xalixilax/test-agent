import { z } from "zod";
import type { IdentityStatus } from "../contexts/identity/application/identity-service";
import type { MetadataRecord, MetadataRecordView } from "../contexts/metadata/domain/metadata";
import { createRouter, mutation, query } from "../shared/rpc/router";

export interface SyncStatus {
  loggedIn: boolean;
  registered: boolean;
  reachable: boolean;
  apiUrl: string;
  lastSyncAt: number | null;
  lastError: string | null;
  pendingCount: number;
}

export interface CaptureResult {
  imageKey: string | null;
}

export interface DeviceInfo {
  deviceId: string;
  name: string;
  isSelf: boolean;
}

export interface AppRouterContext {
  listRecords(): Promise<MetadataRecordView[]>;
  findByUrl(url: string): Promise<MetadataRecord | null>;
  setNote(url: string, note: string): Promise<void>;
  setRating(url: string, rating: number | null): Promise<void>;
  setTags(url: string, tags: string[]): Promise<void>;
  clearScreenshot(url: string): Promise<void>;
  purgeMetadata(url: string): Promise<void>;
  captureImage(url: string): Promise<CaptureResult>;
  backfillImages(): Promise<{ started: boolean }>;
  syncNow(): Promise<SyncStatus>;
  status(): Promise<SyncStatus>;
  listDevices(): Promise<DeviceInfo[]>;
  setDeviceName(name: string): Promise<void>;
  moveBookmark(url: string, target: string): Promise<void>;
  identityStatus(): Promise<IdentityStatus>;
  register(password: string, inviteCode: string): Promise<void>;
  login(password: string): Promise<void>;
  logout(): Promise<void>;
  changePassword(newPassword: string): Promise<void>;
}

const urlInput = z.object({ url: z.string().min(1) });

export const createAppRouter = (context: AppRouterContext) =>
  createRouter({
    getMetadataRecords: query({
      handler: (): Promise<MetadataRecordView[]> => context.listRecords(),
    }),

    getSyncStatus: query({
      handler: (): Promise<SyncStatus> => context.status(),
    }),

    setNote: mutation({
      input: urlInput.extend({ note: z.string() }),
      handler: async (input) => {
        await context.setNote(input.url, input.note);
        return { ok: true as const };
      },
    }),

    setRating: mutation({
      input: urlInput.extend({
        rating: z.number().min(0).max(5).nullable(),
      }),
      handler: async (input) => {
        await context.setRating(input.url, input.rating);
        return { ok: true as const };
      },
    }),

    setTags: mutation({
      input: urlInput.extend({ tags: z.array(z.string()) }),
      handler: async (input) => {
        await context.setTags(input.url, input.tags);
        return { ok: true as const };
      },
    }),

    clearScreenshot: mutation({
      input: urlInput,
      handler: async (input) => {
        await context.clearScreenshot(input.url);
        return { ok: true as const };
      },
    }),

    purgeMetadata: mutation({
      input: urlInput,
      handler: async (input) => {
        await context.purgeMetadata(input.url);
        return { ok: true as const };
      },
    }),

    captureImage: mutation({
      input: urlInput,
      handler: (input): Promise<CaptureResult> => context.captureImage(input.url),
    }),

    backfillImages: mutation({
      handler: (): Promise<{ started: boolean }> => context.backfillImages(),
    }),

    syncNow: mutation({
      handler: (): Promise<SyncStatus> => context.syncNow(),
    }),

    listDevices: query({
      handler: (): Promise<DeviceInfo[]> => context.listDevices(),
    }),

    setDeviceName: mutation({
      input: z.object({ name: z.string().min(1).max(64) }),
      handler: async (input) => {
        await context.setDeviceName(input.name);
        return { ok: true as const };
      },
    }),

    moveBookmark: mutation({
      input: z.object({ url: z.string().min(1), target: z.string().min(1) }),
      handler: async (input) => {
        await context.moveBookmark(input.url, input.target);
        return { ok: true as const };
      },
    }),

    identityStatus: query({
      handler: (): Promise<IdentityStatus> => context.identityStatus(),
    }),

    identityRegister: mutation({
      input: z.object({
        password: z.string().min(8),
        inviteCode: z.string().min(1),
      }),
      handler: async (input) => {
        await context.register(input.password, input.inviteCode);
        return { ok: true as const };
      },
    }),

    identityLogin: mutation({
      input: z.object({ password: z.string().min(1) }),
      handler: async (input) => {
        await context.login(input.password);
        return { ok: true as const };
      },
    }),

    identityLogout: mutation({
      handler: async () => {
        await context.logout();
        return { ok: true as const };
      },
    }),

    identityChangePassword: mutation({
      input: z.object({ newPassword: z.string().min(8) }),
      handler: async (input) => {
        await context.changePassword(input.newPassword);
        return { ok: true as const };
      },
    }),
  });

export type AppRouter = ReturnType<typeof createAppRouter>;
