//! Domain-separation tags and protocol limits.
//!
//! Every hash the protocol commits to is domain-separated. Without this a vote receipt
//! could be replayed as a kill commitment, or a seat commitment as a claim commitment.

/// `poseidon(SEAT_TAG, role_secret, claim_commitment)` — published when a seat is bought.
pub const SEAT_TAG: felt252 = 'CREWKILL_SEAT:V1';
/// `poseidon(CLAIM_TAG, claim_secret)` — gates the payout after the role secret goes public.
pub const CLAIM_TAG: felt252 = 'CREWKILL_CLAIM:V1';
/// `poseidon(OPSEED_TAG, operator_seed)` — the operator's half of the role randomness.
pub const OPSEED_TAG: felt252 = 'CREWKILL_OPSEED:V1';
/// `poseidon(DRAW_TAG, final_seed, role_secret)` — a seat's private role draw.
pub const DRAW_TAG: felt252 = 'CREWKILL_DRAW:V1';
/// `poseidon(VOTE_TAG, role_secret, round, target_seat)` — an anonymous vote receipt.
pub const VOTE_TAG: felt252 = 'CREWKILL_VOTE:V1';
/// `poseidon(KILL_TAG, role_secret, round, victim_seat)` — an anonymous night action.
pub const KILL_TAG: felt252 = 'CREWKILL_KILL:V1';

/// Sentinel target meaning "skip vote".
pub const NO_TARGET: u32 = 0xffffffff;

/// Basis-point denominator.
pub const BPS_DENOM: u128 = 10000;

/// Upper bound on seats per match. Settlement loops over seats, so this bounds the
/// worst-case step count of `settle`.
pub const MAX_SEATS: u32 = 12;
/// Upper bound on meetings per match. Also the number of ballot notes issued per seat.
pub const MAX_ROUNDS: u8 = 8;
/// Upper bound on recorded night actions per match.
pub const MAX_KILLS: u32 = 24;

pub mod errors {
    pub const NOT_KEEPER: felt252 = 'CK: not keeper';
    pub const NOT_POOL: felt252 = 'CK: caller not pool';
    pub const BAD_PHASE: felt252 = 'CK: bad phase';
    pub const NO_MATCH: felt252 = 'CK: no such match';
    pub const SEATS_FULL: felt252 = 'CK: seats full';
    pub const SEAT_TAKEN: felt252 = 'CK: commitment used';
    pub const BAD_STAKE: felt252 = 'CK: stake mismatch';
    pub const BAD_BALLOT: felt252 = 'CK: ballot mismatch';
    pub const BAD_SEED: felt252 = 'CK: seed mismatch';
    pub const BAD_SECRET: felt252 = 'CK: secret mismatch';
    pub const BAD_ROUND: felt252 = 'CK: bad round';
    pub const BAD_TARGET: felt252 = 'CK: bad target';
    pub const REPLAY: felt252 = 'CK: replayed commitment';
    pub const ALREADY_REVEALED: felt252 = 'CK: already revealed';
    pub const NOT_REVEALED: felt252 = 'CK: seat not revealed';
    pub const ALREADY_CLAIMED: felt252 = 'CK: already claimed';
    pub const NOTHING_TO_CLAIM: felt252 = 'CK: nothing to claim';
    pub const TOO_MANY_SEATS: felt252 = 'CK: too many seats';
    pub const TOO_MANY_ROUNDS: felt252 = 'CK: too many rounds';
    pub const TOO_MANY_KILLS: felt252 = 'CK: too many kills';
    pub const BAD_BPS: felt252 = 'CK: bad bps';
    pub const ZERO_ADDRESS: felt252 = 'CK: zero address';
    pub const ZERO_AMOUNT: felt252 = 'CK: zero amount';
    pub const TREASURY_EMPTY: felt252 = 'CK: treasury too small';
    pub const SEAT_DEAD: felt252 = 'CK: seat eliminated';
    pub const NOT_ENOUGH_SEATS: felt252 = 'CK: lobby underfilled';
    pub const U128_OVERFLOW: felt252 = 'CK: u256 to u128 overflow';
    pub const NOT_OWNER: felt252 = 'CK: not owner';
}
