//! Shared value objects.
//!
//! `OpenNoteDeposit` is ABI-identical to `privacy::objects::OpenNoteDeposit` in
//! `starkware-libs/starknet-privacy`. It is re-declared here rather than imported so the
//! CrewKill package builds against a stock Cairo toolchain without pulling the whole
//! privacy monorepo (and its Ekubo / starkware_utils git dependencies) into the build.
//! The pool deserializes the return value of `privacy_invoke` by shape, so the field
//! order and types below are load-bearing and must not be reordered.

use starknet::ContractAddress;

/// Instruction handed back to the privacy pool: credit `amount` of `token` into open note
/// `note_id`. The pool pulls the tokens itself, so a helper approves rather than transfers.
#[derive(Serde, Copy, Drop, PartialEq, starknet::Store)]
pub struct OpenNoteDeposit {
    /// The identifier of the open note to deposit to.
    pub note_id: felt252,
    /// The ERC20 token contract to deposit.
    pub token: ContractAddress,
    /// The amount of tokens to deposit.
    pub amount: u128,
}

/// What a caller is asking the CrewKill anonymizer to do inside a pool transaction.
#[derive(Serde, Copy, Drop, PartialEq)]
pub enum CrewKillOperation {
    /// Stake into an open seat. The pool has already withdrawn the stake to this contract;
    /// the helper hands back a bundle of ballot notes.
    JoinSeat,
    /// Spend one ballot note to cast a vote or a night action.
    CastBallot,
    /// Collect a settled payout into an open note.
    Claim,
}

/// What a spent ballot note is being spent on.
#[derive(Serde, Copy, Drop, PartialEq)]
pub enum BallotKind {
    /// A meeting vote against `target` (or `NO_TARGET` to skip).
    Vote,
    /// A night action: eliminate `target`. Only an impostor's kill survives settlement.
    Kill,
}

/// Lifecycle of a match.
///
/// `Lobby` is variant zero, so an unwritten storage slot reads back as an empty lobby.
/// `MatchInfo.seat_count == 0` is what actually distinguishes "no such match".
#[derive(Serde, Copy, Drop, PartialEq, Default, starknet::Store)]
pub enum MatchPhase {
    /// Seats are open, stakes are being taken.
    #[default]
    Lobby,
    /// Roster locked, `final_seed` published, ballots live.
    Playing,
    /// Play is over. Seats reveal their role secrets.
    Revealing,
    /// Outcome and payouts computed on-chain. Claims open.
    Settled,
    /// Cancelled before play. Every seat may reclaim its stake in full.
    Aborted,
}

/// A seat in a match. `seat_commitment` binds a role secret and a claim commitment that
/// nobody but the seat holder knows at join time.
#[derive(Serde, Copy, Drop, PartialEq, starknet::Store)]
pub struct Seat {
    /// `poseidon(SEAT_TAG, role_secret, claim_commitment)`, published when the seat is bought.
    pub seat_commitment: felt252,
    /// Filled in at reveal. Zero until then.
    pub role_secret: felt252,
    /// `poseidon(CLAIM_TAG, claim_secret)`. Filled in at reveal; gates the payout.
    pub claim_commitment: felt252,
    /// True once `role_secret` has been published.
    pub revealed: bool,
    /// True if this seat was auto-filled by a house agent rather than bought by a human.
    pub is_agent: bool,
    /// Derived at settlement from `final_seed` and `role_secret`.
    pub is_impostor: bool,
    /// Eliminated during play (ejected by vote or killed at night).
    pub eliminated: bool,
    /// Round in which the seat was eliminated. Zero while alive.
    pub eliminated_round: u8,
    /// Payout owed after settlement, in stake-token units.
    pub payout: u128,
    /// True once the payout has been pulled into an open note.
    pub claimed: bool,
}

/// Everything the chain knows about a match.
#[derive(Serde, Copy, Drop, PartialEq, starknet::Store)]
pub struct MatchInfo {
    pub phase: MatchPhase,
    /// Stake per seat, in stake-token units.
    pub stake_amount: u128,
    /// Total seats in the match.
    pub seat_count: u32,
    /// Seats bought or auto-filled so far.
    pub seats_filled: u32,
    /// Meetings per match. Also the number of ballot notes issued per seat.
    pub rounds: u8,
    /// Probability, in basis points, that any given seat draws the impostor role.
    pub impostor_bps: u16,
    /// Share of the pot, in basis points, reserved for the Detective Pool.
    pub detective_bps: u16,
    /// Protocol fee, in basis points.
    pub protocol_bps: u16,
    /// `poseidon(OPSEED_TAG, operator_seed)`, fixed before the lobby opens.
    pub seed_commitment: felt252,
    /// `poseidon(operator_seed, seat_commitment_0, .., seat_commitment_n)`. Zero until play starts.
    pub final_seed: felt252,
    /// Sum of every stake taken, in stake-token units.
    pub pot: u128,
    /// Rounds actually played, set when play ends.
    pub rounds_played: u8,
    /// True if the crew won. Meaningful once `phase == Settled`.
    pub crew_won: bool,
    /// Seats that revealed a role secret.
    pub revealed_count: u32,
    /// Impostor seats among the revealed ones.
    pub impostor_count: u32,
    /// Sum of detective weights across all correct votes, used as the payout denominator.
    pub detective_weight_total: u64,
}

/// A night action recorded during play, validated at settlement.
#[derive(Serde, Copy, Drop, PartialEq, starknet::Store)]
pub struct KillClaim {
    /// `poseidon(KILL_TAG, role_secret, round, victim_seat)`.
    pub commitment: felt252,
    pub victim_seat: u32,
    pub round: u8,
    /// Set at settlement once a revealed impostor's secret reproduces `commitment`.
    pub validated: bool,
}

/// A vote receipt: the anonymous proof-of-vote a seat can cash in for the Detective Pool.
#[derive(Serde, Copy, Drop, PartialEq, starknet::Store)]
pub struct VoteReceipt {
    pub match_id: u64,
    pub round: u8,
    pub target_seat: u32,
    pub exists: bool,
}
