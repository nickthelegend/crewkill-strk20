//! External interfaces CrewKill talks to, plus the CrewKill surface itself.

use starknet::ContractAddress;
use crate::objects::{
    BallotKind, CrewKillOperation, KillClaim, MatchInfo, OpenNoteDeposit, Seat, VoteReceipt,
};

/// The subset of SNIP-2 / ERC-20 CrewKill needs. Declared locally to keep the package
/// dependency-free; any standards-compliant token satisfies it.
#[starknet::interface]
pub trait IERC20<T> {
    fn balance_of(self: @T, account: ContractAddress) -> u256;
    fn transfer(ref self: T, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: T, sender: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> bool;
    fn approve(ref self: T, spender: ContractAddress, amount: u256) -> bool;
    fn allowance(self: @T, owner: ContractAddress, spender: ContractAddress) -> u256;
    fn total_supply(self: @T) -> u256;
}

/// The ballot token: a valueless ERC-20 the game mints so that a vote can be *spent*
/// through the privacy pool. Spending a note is what makes a vote anonymous — the pool
/// proves the voter owns a ballot without revealing which one.
#[starknet::interface]
pub trait IBallotToken<T> {
    fn mint(ref self: T, recipient: ContractAddress, amount: u256);
    fn burn(ref self: T, account: ContractAddress, amount: u256);
    fn set_minter(ref self: T, minter: ContractAddress);
    fn minter(self: @T) -> ContractAddress;
}

/// The privacy-pool-facing entry point. The pool deserializes calldata straight into these
/// parameters, so their order is part of the wire format.
#[starknet::interface]
pub trait ICrewKillAnonymizer<T> {
    fn privacy_invoke(
        ref self: T,
        operation: CrewKillOperation,
        match_id: u64,
        commitment: felt252,
        kind: BallotKind,
        round: u8,
        target_seat: u32,
        secret: felt252,
        note_id: felt252,
    ) -> Span<OpenNoteDeposit>;
}

/// Everything that is not a pool call: match lifecycle, public reveals, permissionless
/// settlement, and reads.
#[starknet::interface]
pub trait ICrewKill<T> {
    // ── lifecycle (keeper) ────────────────────────────────────────────────────────────
    fn create_match(
        ref self: T,
        stake_amount: u128,
        seat_count: u32,
        rounds: u8,
        impostor_bps: u16,
        detective_bps: u16,
        protocol_bps: u16,
        seed_commitment: felt252,
    ) -> u64;
    /// Buys a seat for a house agent out of the contract's treasury. This is the cold-start
    /// fix: a match never fails to run because humans did not show up.
    fn fill_agent_seat(ref self: T, match_id: u64, seat_commitment: felt252) -> u32;
    /// Locks the roster and publishes `final_seed`, at which point every seat — and only
    /// that seat — can compute its own role.
    fn start_match(ref self: T, match_id: u64, operator_seed: felt252);
    /// Ends play and opens the reveal window.
    fn end_play(ref self: T, match_id: u64, rounds_played: u8);
    /// Refunds every seat in full. Used when a lobby cannot reach quorum or play stalls.
    fn abort_match(ref self: T, match_id: u64);

    // ── permissionless ────────────────────────────────────────────────────────────────
    /// Publishes a seat's role secret. Knowledge of the secret is the authorisation, so
    /// this can be called from any address without leaking who owns the seat.
    fn reveal_seat(ref self: T, match_id: u64, role_secret: felt252, claim_commitment: felt252);
    /// Recomputes the whole match from on-chain data — ejections, valid kills, the win
    /// condition, the Detective Pool — and writes every seat's payout. Anyone may call it.
    fn settle(ref self: T, match_id: u64);

    // ── reads ─────────────────────────────────────────────────────────────────────────
    fn get_match(self: @T, match_id: u64) -> MatchInfo;
    fn get_seat(self: @T, match_id: u64, seat_index: u32) -> Seat;
    fn get_seat_index(self: @T, match_id: u64, seat_commitment: felt252) -> u32;
    fn get_tally(self: @T, match_id: u64, round: u8, target_seat: u32) -> u32;
    fn get_receipt(self: @T, receipt: felt252) -> VoteReceipt;
    fn get_kill(self: @T, match_id: u64, index: u32) -> KillClaim;
    fn get_kill_count(self: @T, match_id: u64) -> u32;
    fn match_count(self: @T) -> u64;
    fn config(self: @T) -> (ContractAddress, ContractAddress, ContractAddress, ContractAddress);
    fn treasury(self: @T) -> u128;
    fn protocol_fees(self: @T) -> u128;

    // ── admin ─────────────────────────────────────────────────────────────────────────
    fn fund_treasury(ref self: T, amount: u128);
    fn withdraw_protocol_fees(ref self: T, recipient: ContractAddress);
    fn set_keeper(ref self: T, keeper: ContractAddress);
    fn transfer_ownership(ref self: T, owner: ContractAddress);
}
