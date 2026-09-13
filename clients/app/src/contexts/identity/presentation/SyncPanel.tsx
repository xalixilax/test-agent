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
import type { SyncStatus } from "@/routers/appRouters";

interface SyncPanelProps {
  onClose: () => void;
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

type PanelMode = "offline" | "register" | "login" | "account";

const panelMode = (status?: SyncStatus): PanelMode => {
  if (!status?.loggedIn) {
    if (!status?.reachable) return "offline";
    return status.registered ? "login" : "register";
  }
  return "account";
};

export function SyncPanel({ onClose }: SyncPanelProps) {
  const { data: status } = useSyncStatus();
  const register = useIdentityRegister();
  const login = useIdentityLogin();
  const logout = useIdentityLogout();
  const changePassword = useIdentityChangePassword();
  const syncNow = useSyncNow();
  const backfill = useBackfillImages();
  const mode = panelMode(status);

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

        <SyncStatusSummary status={status} />

        {mode === "offline" && (
          <p className="text-xs font-bold text-red-600">
            Sync server unreachable. Local mode keeps working; check the Worker URL in
            src/shared/config.ts.
          </p>
        )}

        {mode === "register" && <RegisterForm register={register} />}
        {mode === "login" && <LoginForm login={login} />}
        {mode === "account" && (
          <AccountActions
            syncNow={syncNow}
            backfill={backfill}
            changePassword={changePassword}
            logout={logout}
          />
        )}
      </div>
    </div>
  );
}

function SyncStatusSummary({ status }: { status?: SyncStatus }) {
  const lastSync = status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleTimeString() : "NEVER";

  return (
    <div className="text-xs font-bold space-y-1 border-2 border-dashed border-gray-300 p-2">
      <p>MODE: {status?.loggedIn ? `SYNCED TO ${status.apiUrl}` : "LOCAL ONLY (NO LOGIN)"}</p>
      <p>LAST SYNC: {lastSync}</p>
      <p>PENDING CHANGES: {status?.pendingCount ?? 0}</p>
      {status?.lastError && <p className="text-red-600">ERROR: {status.lastError}</p>}
    </div>
  );
}

function RegisterForm({ register }: { register: ReturnType<typeof useIdentityRegister> }) {
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    setMessage(null);
    try {
      await register.mutateAsync({ password, inviteCode });
      setPassword("");
      setMessage("Account created and syncing.");
    } catch (error) {
      setMessage(messageOf(error));
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold">
        First-time setup: create the sync account on your Worker. Keep the password safe - there is
        no recovery by design.
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
        disabled={register.isPending || password.length < 8 || inviteCode === ""}
        onClick={() => void submit()}
      >
        {register.isPending ? "CREATING..." : "CREATE SYNC ACCOUNT"}
      </Button>
      {message && <p className="text-xs font-bold">{message}</p>}
    </div>
  );
}

function LoginForm({ login }: { login: ReturnType<typeof useIdentityLogin> }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    setMessage(null);
    try {
      await login.mutateAsync({ password });
      setPassword("");
      setMessage("Logged in.");
    } catch (error) {
      setMessage(messageOf(error));
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="login-password">PASSWORD</Label>
      <Input
        id="login-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        onKeyDown={(e) => {
          if (e.key === "Enter" && password) void submit();
        }}
      />
      <Button
        className="w-full"
        disabled={login.isPending || password === ""}
        onClick={() => void submit()}
      >
        {login.isPending ? "LOGGING IN..." : "LOG IN"}
      </Button>
      {message && <p className="text-xs font-bold">{message}</p>}
    </div>
  );
}

function AccountActions({
  syncNow,
  backfill,
  changePassword,
  logout,
}: {
  syncNow: ReturnType<typeof useSyncNow>;
  backfill: ReturnType<typeof useBackfillImages>;
  changePassword: ReturnType<typeof useIdentityChangePassword>;
  logout: ReturnType<typeof useIdentityLogout>;
}) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setMessage(null);
    try {
      await action();
      setPassword("");
      setMessage(success);
    } catch (error) {
      setMessage(messageOf(error));
    }
  };

  const busy = syncNow.isPending || changePassword.isPending || logout.isPending;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={busy}
          onClick={() => void run(() => syncNow.mutateAsync(), "Synced.")}
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
            void run(
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
          onClick={() => void run(() => logout.mutateAsync(), "Logged out.")}
        >
          LOG OUT
        </Button>
      </div>
      {message && <p className="text-xs font-bold">{message}</p>}
    </div>
  );
}
