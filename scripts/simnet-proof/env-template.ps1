# PowerShell template for local simnet proof runs.
# Copy this file outside the repo or fill values in your current shell only.
# Do not commit real RPC passwords, wallet secrets, private keys, or generated proof artifacts.

$env:DCR_SIMNET_ENABLED = "true"

# Isolated local dcrd simnet RPC. This harness currently uses wallet RPC probes,
# but keep dcrd values present so the config check matches the app config boundary.
$env:DCRD_SIMNET_RPC_URL = "http://127.0.0.1:19556"
$env:DCRD_SIMNET_RPC_USER = "replace-me"
$env:DCRD_SIMNET_RPC_PASSWORD = "replace-me"
$env:DCRD_SIMNET_RPC_CERT_PATH = ""

# Borrower wallet RPC. Used for collateral release unsigned previews.
$env:DCRWALLET_SIMNET_BORROWER_RPC_URL = "http://127.0.0.1:19557"
$env:DCRWALLET_SIMNET_BORROWER_RPC_USER = "replace-me"
$env:DCRWALLET_SIMNET_BORROWER_RPC_PASSWORD = "replace-me"
$env:DCRWALLET_SIMNET_BORROWER_RPC_CERT_PATH = ""
$env:DCRWALLET_SIMNET_BORROWER_ACCOUNT = "default"

# Lender wallet RPC. Used for liquidation unsigned previews.
$env:DCRWALLET_SIMNET_LENDER_RPC_URL = "http://127.0.0.1:19558"
$env:DCRWALLET_SIMNET_LENDER_RPC_USER = "replace-me"
$env:DCRWALLET_SIMNET_LENDER_RPC_PASSWORD = "replace-me"
$env:DCRWALLET_SIMNET_LENDER_RPC_CERT_PATH = ""
$env:DCRWALLET_SIMNET_LENDER_ACCOUNT = "default"

# Arbiter wallet RPC. Required for role separation checks and later signing proof.
$env:DCRWALLET_SIMNET_ARBITER_RPC_URL = "http://127.0.0.1:19559"
$env:DCRWALLET_SIMNET_ARBITER_RPC_USER = "replace-me"
$env:DCRWALLET_SIMNET_ARBITER_RPC_PASSWORD = "replace-me"
$env:DCRWALLET_SIMNET_ARBITER_RPC_CERT_PATH = ""
$env:DCRWALLET_SIMNET_ARBITER_ACCOUNT = "default"

# Unsigned preview proof values. Fill these only after a real simnet escrow address
# has confirmed UTXOs.
$env:SIMNET_PREVIEW_PURPOSE = "collateral_release"
$env:SIMNET_PREVIEW_LOAN_ID = "simnet_proof_loan"
$env:SIMNET_PREVIEW_ESCROW_ADDRESS = "replace-me"
$env:SIMNET_PREVIEW_REDEEM_SCRIPT = "replace-me"
$env:SIMNET_PREVIEW_COLLATERAL_DCR = "0"
$env:SIMNET_PREVIEW_DESTINATION_ADDRESS = "replace-me"
$env:SIMNET_PREVIEW_FEE_DCR = "0.001"
$env:SIMNET_PREVIEW_MIN_CONFIRMATIONS = "1"
$env:SIMNET_PREVIEW_OUTPUT_PATH = "artifacts/simnet/unsigned-release-preview.json"

Write-Host "Simnet proof environment variables loaded for this PowerShell session only."
Write-Host "Run: npm run simnet:check-config"
Write-Host "Then: npm run simnet:probe-rpc"
Write-Host "After escrow UTXOs exist: npm run simnet:build-unsigned-preview"
