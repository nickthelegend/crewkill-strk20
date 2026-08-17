//! Commitment helpers.
//!
//! These are `pub` and free-standing on purpose: the keeper and the browser client
//! recompute the exact same hashes in TypeScript (see `packages/protocol/src/hashing.ts`),
//! and the Cairo tests pin the two implementations together.

use core::poseidon::poseidon_hash_span;
use crate::constants::{CLAIM_TAG, DRAW_TAG, KILL_TAG, OPSEED_TAG, SEAT_TAG, VOTE_TAG};

/// The public identity of a seat. Binds the role secret (which decides the role) and the
/// claim commitment (which gates the money) in one value, so revealing the role secret at
/// the end of the match cannot be used by anyone else to steal the payout.
pub fn seat_commitment(role_secret: felt252, claim_commitment: felt252) -> felt252 {
    poseidon_hash_span([SEAT_TAG, role_secret, claim_commitment].span())
}

/// Published at reveal, checked again at claim time.
pub fn claim_commitment(claim_secret: felt252) -> felt252 {
    poseidon_hash_span([CLAIM_TAG, claim_secret].span())
}

/// The operator's pre-commitment to its half of the role randomness.
pub fn seed_commitment(operator_seed: felt252) -> felt252 {
    poseidon_hash_span([OPSEED_TAG, operator_seed].span())
}

/// A seat's private role draw. Only the seat holder can compute it, because only they
/// know `role_secret` — this is what keeps the operator from learning who the impostors are.
pub fn role_draw(final_seed: felt252, role_secret: felt252) -> felt252 {
    poseidon_hash_span([DRAW_TAG, final_seed, role_secret].span())
}

/// An anonymous vote receipt. Unforgeable without `role_secret`, and unlinkable to a seat
/// until that secret is published at the end of the match.
pub fn vote_receipt(role_secret: felt252, round: u8, target_seat: u32) -> felt252 {
    poseidon_hash_span([VOTE_TAG, role_secret, round.into(), target_seat.into()].span())
}

/// An anonymous night action, validated against the revealed impostor secrets at settlement.
pub fn kill_commitment(role_secret: felt252, round: u8, victim_seat: u32) -> felt252 {
    poseidon_hash_span([KILL_TAG, role_secret, round.into(), victim_seat.into()].span())
}

/// Whether a draw lands in the impostor band. `impostor_bps` out of 10000 draws do.
pub fn draw_is_impostor(draw: felt252, impostor_bps: u16) -> bool {
    let draw_u256: u256 = draw.into();
    let bucket: u256 = draw_u256 % 10000_u256;
    bucket < impostor_bps.into()
}
