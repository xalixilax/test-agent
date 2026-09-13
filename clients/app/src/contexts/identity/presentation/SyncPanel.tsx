import { useState } from "react";
import { Button } from "@design-system/ui/button";
import { Input } from "@design-system/ui/input";
import { Label } from "@design-system/ui/label";
import { useBackfillImages } from "@/presentation/hooks/useMetadata";
import {
  useIdentityChangePassword,
  useIdentityLogin,
  useIdentityLogout,
  useIdentityRegister,
  useSyncNow,
  useSyncStatus,
} from "@/presentation/hooks/useSync";

interface SyncPanelProps {
  onClose: () => void;
}

export function SyncPanel({ onClose }: SyncPanelProps) {
  const { data: status } = useSyncStatus();
  const register = useIdentityRegister();
  const login = useIdentityLogin();
  const logout = useIdentityLogout();
  const changePassword = useIdentityChangePassword();
  const syncNow = useSyncNow();
  const backfill = useBackfillImages();

  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const loggedIn = status?.loggedIn ?? false;
  const registered = status?.registered ?? false;
  const reachable = status?.reachable ?? false;
  const busy =
    register.isPending ||
    login.isPending ||
    logout.isPending ||
    changePassword.isPending ||
    syncNow.isPending;

  const run = async (action: () => Promise<unknown>, success: string) => {
    setMessage(null);
    try {
      await action();
      setPassword("");
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.6)" }}
    >
      <div
        className="w-full max-w-md border-4 border-black p-4 mt-16 space-y-3"
        style={{ background: "var(--color-white)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">SYNC</h2>
          <Button variant="secondary" size="sm" onClick={onClose}>
            CLOSE
          </Button>
        </div>

        <div className="text-xs font-bold space-y-1 border-2 border-dashed border-gray-300 p-2">
          <p>
            MODE:{" "}
            {loggedIn
              ? `SYNCED TO ${status?.apiUrl ?? ""}`
              : "LOCAL ONLY (NO LOGIN)"}
          </p>
          <p>
            LAST SYNC:{" "}
            {status?.lastSyncAt
              ? new Date(status.lastSyncAt).toLocaleTimeString()
              : "NEVER"}
          </p>
          <p>PENDING CHANGES: {status?.pendingCount ?? 0}</p>
          {status?.lastError && (
            <p className="text-red-600">ERROR: {status.lastError}</p>
          )}
        </div>

        {!loggedIn && !reachable && (
          <p className="text-xs font-bold text-red-600">
            Sync server unreachable. Local mode keeps working; check the
            Worker URL in src/shared/config.ts.
          </p>
        )}

        {!loggedIn && reachable && !registered && (
          <div className="space-y-2">
            <p className="text-xs font-bold">
              First-time setup: create the sync account on your Worker. Keep the
              password safe - there is no recovery by design.
            </p>
            <Label htmlFor="invite">INVITE CODE</Label>
            <Input
              id="invite"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              type="password"
            />
            <Label htmlFor="password">PASSWORD (MIN 8 CHARS)</Label>
            <Input
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
            />
            <Button
              className="w-full"
              disabled={busy || password.length < 8 || inviteCode === ""}
              onClick={() =>
                run(
                  () =>
                    register.mutateAsync({
                      password,
                      inviteCode,
                    }),
                  "Account created and syncing.",
                )
              }
            >
              {register.isPending ? "CREATING..." : "CREATE SYNC ACCOUNT"}
            </Button>
          </div>
        )}

        {!loggedIn && reachable && registered && (
          <div className="space-y-2">
            <Label htmlFor="login-password">PASSWORD</Label>
            <Input
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              onKeyDown={(e) => {
                if (e.key === "Enter" && password) {
                  void run(
                    () => login.mutateAsync({ password }),
                    "Logged in.",
                  );
                }
              }}
            />
            <Button
              className="w-full"
              disabled={busy || password === ""}
              onClick={() =>
                run(() => login.mutateAsync({ password }), "Logged in.")
              }
            >
              {login.isPending ? "LOGGING IN..." : "LOG IN"}
            </Button>
          </div>
        )}

        {loggedIn && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={busy}
                onClick={() =>
                  run(() => syncNow.mutateAsync(), "Synced.")
                }
              >
                {syncNow.isPending ? "SYNCING..." : "SYNC NOW"}
              </Button>
              <Button
                className="flex-1"
                variant="secondary"
                disabled={backfill.isPending}
                onClick={() => backfill.mutate()}
              >
                {backfill.isPending ? "STARTING..." : "ARCHIVE IMAGES"}
              </Button>
            </div>
            <Label htmlFor="new-password">NEW PASSWORD (MIN 8 CHARS)</Label>
            <Input
              id="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
            />
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="secondary"
                disabled={busy || password.length < 8}
                onClick={() =>
                  run(
                    () => changePassword.mutateAsync({ newPassword: password }),
                    "Password changed.",
                  )
                }
              >
                CHANGE PASSWORD
              </Button>
              <Button
                className="flex-1"
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  run(() => logout.mutateAsync(), "Logged out.")
                }
              >
                LOG OUT
              </Button>
            </div>
          </div>
        )}

        {message && <p className="text-xs font-bold">{message}</p>}
      </div>
    </div>
  );
}
