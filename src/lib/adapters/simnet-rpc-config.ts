export type SimnetWalletRole = "borrower" | "lender" | "arbiter";

export type SimnetRpcEnv = Record<string, string | undefined>;

export interface SimnetDcrdRpcConfig {
  rpcUrl: string | null;
  rpcUser: string | null;
  rpcPasswordEnvVar: "DCRD_SIMNET_RPC_PASSWORD";
  rpcCertPath: string | null;
  configured: boolean;
  missingEnvVars: string[];
}

export interface SimnetWalletRpcConfig {
  role: SimnetWalletRole;
  rpcUrl: string | null;
  rpcUser: string | null;
  rpcPasswordEnvVar: string;
  rpcCertPath: string | null;
  account: string | null;
  configured: boolean;
  missingEnvVars: string[];
}

export interface SimnetRpcConfig {
  network: "simnet";
  enabled: boolean;
  readyForWalletRpc: boolean;
  dcrd: SimnetDcrdRpcConfig;
  wallets: Record<SimnetWalletRole, SimnetWalletRpcConfig>;
  missingEnvVars: string[];
  blockers: string[];
  warnings: string[];
}

export const simnetWalletRoles = ["borrower", "lender", "arbiter"] as const satisfies readonly SimnetWalletRole[];

const dcrdRequiredEnvVars = ["DCRD_SIMNET_RPC_URL", "DCRD_SIMNET_RPC_USER", "DCRD_SIMNET_RPC_PASSWORD"] as const;

export function readSimnetRpcConfig(env: SimnetRpcEnv = process.env): SimnetRpcConfig {
  const enabled = envValue(env, "DCR_SIMNET_ENABLED") === "true";
  const dcrd = readDcrdConfig(env);
  const wallets = simnetWalletRoles.reduce((acc, role) => {
    acc[role] = readWalletConfig(env, role);
    return acc;
  }, {} as Record<SimnetWalletRole, SimnetWalletRpcConfig>);

  const missingEnvVars = [
    ...dcrd.missingEnvVars,
    ...simnetWalletRoles.flatMap((role) => wallets[role].missingEnvVars),
  ];
  const urlBlockers = [
    ...validateRpcUrl("DCRD_SIMNET_RPC_URL", dcrd.rpcUrl),
    ...simnetWalletRoles.flatMap((role) =>
      validateRpcUrl(walletEnvVar(role, "RPC_URL"), wallets[role].rpcUrl),
    ),
  ];
  const blockers = [
    ...(!enabled ? ["Simnet RPC config is disabled. Set DCR_SIMNET_ENABLED=true only for isolated simnet."] : []),
    ...(missingEnvVars.length > 0 ? [`Missing simnet RPC env vars: ${missingEnvVars.join(", ")}.`] : []),
    ...urlBlockers,
  ];

  return {
    network: "simnet",
    enabled,
    readyForWalletRpc: enabled && blockers.length === 0,
    dcrd,
    wallets,
    missingEnvVars,
    blockers,
    warnings: [
      "Simnet RPC credentials are read from environment variables only.",
      "This config does not allow server-side private-key storage, signing, or broadcast.",
      "Use separate borrower, lender, and arbiter wallets for simnet proof.",
    ],
  };
}

function readDcrdConfig(env: SimnetRpcEnv): SimnetDcrdRpcConfig {
  const missingEnvVars = missingRequiredEnvVars(env, dcrdRequiredEnvVars);

  return {
    rpcUrl: envValue(env, "DCRD_SIMNET_RPC_URL"),
    rpcUser: envValue(env, "DCRD_SIMNET_RPC_USER"),
    rpcPasswordEnvVar: "DCRD_SIMNET_RPC_PASSWORD",
    rpcCertPath: envValue(env, "DCRD_SIMNET_RPC_CERT_PATH"),
    configured: missingEnvVars.length === 0,
    missingEnvVars,
  };
}

function readWalletConfig(env: SimnetRpcEnv, role: SimnetWalletRole): SimnetWalletRpcConfig {
  const requiredEnvVars = [walletEnvVar(role, "RPC_URL"), walletEnvVar(role, "RPC_USER"), walletEnvVar(role, "RPC_PASSWORD")];
  const missingEnvVars = missingRequiredEnvVars(env, requiredEnvVars);

  return {
    role,
    rpcUrl: envValue(env, walletEnvVar(role, "RPC_URL")),
    rpcUser: envValue(env, walletEnvVar(role, "RPC_USER")),
    rpcPasswordEnvVar: walletEnvVar(role, "RPC_PASSWORD"),
    rpcCertPath: envValue(env, walletEnvVar(role, "RPC_CERT_PATH")),
    account: envValue(env, walletEnvVar(role, "ACCOUNT")),
    configured: missingEnvVars.length === 0,
    missingEnvVars,
  };
}

function missingRequiredEnvVars(env: SimnetRpcEnv, names: readonly string[]): string[] {
  return names.filter((name) => envValue(env, name) === null);
}

function envValue(env: SimnetRpcEnv, name: string): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

function walletEnvVar(role: SimnetWalletRole, suffix: "RPC_URL" | "RPC_USER" | "RPC_PASSWORD" | "RPC_CERT_PATH" | "ACCOUNT"): string {
  return `DCRWALLET_SIMNET_${role.toUpperCase()}_${suffix}`;
}

function validateRpcUrl(envVarName: string, value: string | null): string[] {
  if (!value) return [];

  try {
    const url = new URL(value);
    const blockers: string[] = [];

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      blockers.push(`${envVarName} must use http:// or https://.`);
    }

    if (value.toLowerCase().includes("mainnet")) {
      blockers.push(`${envVarName} must not point at a mainnet endpoint.`);
    }

    return blockers;
  } catch {
    return [`${envVarName} must be a valid HTTP(S) URL.`];
  }
}
