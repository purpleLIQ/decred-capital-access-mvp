# Decred Ticket Collateral

The user requested research into using a full Decred staking ticket, or proof of a ticket, as collateral.

## Finding

Existing ticket proof is easy to imagine as a borrower signal, but it is not secure v1 collateral. A live ticket is locked by Decred consensus and cannot be canceled. It may vote, miss, or expire, and funds return only after the protocol lifecycle completes.

## Safe MVP Treatment

Use ticket proof as research-only context:

- It can show the borrower has DCR locked in staking.
- It can show voting exposure.
- It should not increase borrow limit in v1.
- It should not be described as liquid collateral.

## Future Research

The interesting path is not an existing ticket. It is a new ticket purchased under an escrow-aware design where reward/refund proceeds can be directed safely. That must be proven on simnet before UI work.

## Simnet Questions

- Can ticket purchase commitments direct proceeds to a controlled address?
- Can voting rights stay with borrower while proceeds are escrowed?
- Can a VSP participate without gaining collateral control?
- What happens on miss, expiry, and revocation?
