import type {
  AuthParamsResponse,
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
} from "sync-protocol";

export interface StoredSession {
  token: string;
  dataKey: string;
}

export interface SessionStore {
  get(): Promise<StoredSession | null>;
  set(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}

export interface AuthGateway {
  params(): Promise<AuthParamsResponse>;
  register(input: RegisterRequest): Promise<LoginResponse>;
  login(input: LoginRequest): Promise<LoginResponse>;
  changePassword(input: ChangePasswordRequest & { token: string }): Promise<void>;
  logout(token: string): Promise<void>;
}
