import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { createWorkerClient } from "@/shared/rpc/client";
import type { AppRouter } from "@/routers/appRouters";
import type { MetadataRecordView } from "@/contexts/metadata/domain/metadata";
import { normalizeUrl } from "@/contexts/metadata/domain/url";

const client = createWorkerClient<AppRouter>();

const invalidateMetadata = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: ["metadataRecords"] });
  void queryClient.invalidateQueries({ queryKey: ["syncStatus"] });
};

const useMetadataRecords = () =>
  useQuery({
    queryKey: ["metadataRecords"],
    queryFn: () => client.getMetadataRecords.query(),
  });

export const useRecordsByUrl = () => {
  const query = useMetadataRecords();
  const byUrl = new Map<string, MetadataRecordView>();
  for (const record of query.data ?? []) {
    byUrl.set(normalizeUrl(record.url), record);
  }
  return { ...query, byUrl };
};

const useInvalidatingMutation = <TInput, TOutput>(
  mutationFn: (input: TInput) => Promise<TOutput>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => invalidateMetadata(queryClient),
  });
};

export const useSetNote = () =>
  useInvalidatingMutation((input: { url: string; note: string }) => client.setNote.mutate(input));

export const useSetRating = () =>
  useInvalidatingMutation((input: { url: string; rating: number | null }) =>
    client.setRating.mutate(input),
  );

export const useSetTags = () =>
  useInvalidatingMutation((input: { url: string; tags: string[] }) => client.setTags.mutate(input));

export const useClearScreenshot = () =>
  useInvalidatingMutation((input: { url: string }) => client.clearScreenshot.mutate(input));

export const useCaptureImage = () =>
  useInvalidatingMutation((input: { url: string }) => client.captureImage.mutate(input));

export const useBackfillImages = () =>
  useInvalidatingMutation(() => client.backfillImages.mutate());

export const useMetadataEvents = (): void => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = (message: unknown) => {
      const action = (message as { action?: string } | null)?.action;
      if (action === "dataChanged" || action === "bookmarkChanged") {
        void queryClient.invalidateQueries({ queryKey: ["metadataRecords"] });
        void queryClient.invalidateQueries({ queryKey: ["chromeBookmarks"] });
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [queryClient]);
};
