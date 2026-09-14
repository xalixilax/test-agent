import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createWorkerClient } from "@/shared/rpc/client";
import type { AppRouter } from "@/routers/appRouters";

const client = createWorkerClient<AppRouter>();

export const useSyncStatus = () =>
  useQuery({
    queryKey: ["syncStatus"],
    queryFn: () => client.getSyncStatus.query(),
    refetchInterval: 10_000,
  });

const useIdentityMutation = <TInput>(mutationFn: (input: TInput) => Promise<unknown>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["syncStatus"] });
      void queryClient.invalidateQueries({ queryKey: ["identityStatus"] });
      void queryClient.invalidateQueries({ queryKey: ["metadataRecords"] });
    },
  });
};

export const useIdentityRegister = () =>
  useIdentityMutation((input: { password: string; inviteCode: string }) =>
    client.identityRegister.mutate(input),
  );

export const useIdentityLogin = () =>
  useIdentityMutation((input: { password: string }) => client.identityLogin.mutate(input));

export const useIdentityLogout = () => useIdentityMutation(() => client.identityLogout.mutate());

export const useIdentityChangePassword = () =>
  useIdentityMutation((input: { newPassword: string }) =>
    client.identityChangePassword.mutate(input),
  );

export const useSyncNow = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => client.syncNow.mutate(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["syncStatus"] });
      void queryClient.invalidateQueries({ queryKey: ["metadataRecords"] });
    },
  });
};

export interface FetchProgress {
  processed: number;
  total: number;
  success: number;
  failed: number;
}

export const useFetchProgress = (): FetchProgress => {
  const [progress, setProgress] = useState<FetchProgress>({
    processed: 0,
    total: 0,
    success: 0,
    failed: 0,
  });

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime) return;

    const handler = (message: unknown) => {
      const data = message as (FetchProgress & { action?: string }) | null;
      if (data?.action === "fetchProgress") {
        setProgress({
          processed: data.processed,
          total: data.total,
          success: data.success,
          failed: data.failed,
        });
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  return progress;
};
