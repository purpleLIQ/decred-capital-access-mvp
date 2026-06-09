const checklist = `## Verification
- [ ] npm run verify:protocol
- [ ] npm run safety:check
- [ ] npm run verify

## Safety boundary
- [ ] no signing
- [ ] no broadcast
- [ ] no wallet unlock
- [ ] no private-key handling
- [ ] no real funds
- [ ] no production liquidation execution

## Scope check
- [ ] focused change
- [ ] docs updated if behavior or workflow changed
- [ ] unsafe capabilities remain gated or absent
`;

console.log(checklist.trim());
