//! Guard rails.
//!
//! The match tests cover the happy paths and the money. These cover the ways a caller can
//! try to bend the rules: bad parameters, the wrong caller, a duplicated commitment, a
//! roster that was never filled, a seat revealed twice, and a ballot minted by someone who
//! is not the game.

use crewkill::constants::MAX_SEATS;
use crewkill::hashing;
use crewkill::interfaces::{
    IBallotTokenDispatcher, IBallotTokenDispatcherTrait, ICrewKillDispatcherTrait, IERC20Dispatcher,
    IERC20DispatcherTrait,
};
use crewkill::mocks::MockPrivacyPool::IMockPoolDispatcherTrait;
use crewkill::objects::{BallotKind, CrewKillOperation, MatchPhase};
use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use super::common::{
    DETECTIVE_BPS, PROTOCOL_BPS, ROUNDS, SEATS, STAKE, World, addr, deploy_world,
    fund_and_shield,
};

fn open(w: World, seed: felt252) -> u64 {
    start_cheat_caller_address(w.game_addr, w.keeper);
    let id = w
        .game
        .create_match(
            STAKE,
            SEATS,
            ROUNDS,
            2500,
            DETECTIVE_BPS,
            PROTOCOL_BPS,
            hashing::seed_commitment(seed),
        );
    stop_cheat_caller_address(w.game_addr);
    id
}

// ── A1: the happy path records exactly what was asked for ────────────────────────────

#[test]
fn create_match_records_the_configuration_verbatim() {
    let w = deploy_world();
    assert(w.game.match_count() == 0, 'should start empty');

    let id = open(w, 'seed');
    assert(id == 1, 'first match should be id 1');
    assert(w.game.match_count() == 1, 'count should be 1');

    let m = w.game.get_match(id);
    assert(m.phase == MatchPhase::Lobby, 'should open in lobby');
    assert(m.stake_amount == STAKE, 'stake wrong');
    assert(m.seat_count == SEATS, 'seat count wrong');
    assert(m.rounds == ROUNDS, 'rounds wrong');
    assert(m.impostor_bps == 2500, 'impostor bps wrong');
    assert(m.detective_bps == DETECTIVE_BPS, 'detective bps wrong');
    assert(m.protocol_bps == PROTOCOL_BPS, 'protocol bps wrong');
    assert(m.seats_filled == 0, 'should have no seats');
    assert(m.pot == 0, 'pot should be empty');
    assert(m.final_seed == 0, 'seed must stay sealed');
}

// ── A2: parameters that cannot make a playable match are refused ─────────────────────

#[test]
#[should_panic(expected: 'CK: too many seats')]
fn a_lobby_bigger_than_the_contract_can_settle_is_refused() {
    let w = deploy_world();
    start_cheat_caller_address(w.game_addr, w.keeper);
    // Settlement loops over seats, so MAX_SEATS is a real bound, not a preference.
    w
        .game
        .create_match(
            STAKE, MAX_SEATS + 1, ROUNDS, 2500, DETECTIVE_BPS, PROTOCOL_BPS, hashing::seed_commitment('s'),
        );
    stop_cheat_caller_address(w.game_addr);
}

#[test]
#[should_panic(expected: 'CK: too many seats')]
fn a_lobby_too_small_to_be_a_game_is_refused() {
    let w = deploy_world();
    start_cheat_caller_address(w.game_addr, w.keeper);
    w
        .game
        .create_match(
            STAKE, 3, ROUNDS, 2500, DETECTIVE_BPS, PROTOCOL_BPS, hashing::seed_commitment('s'),
        );
    stop_cheat_caller_address(w.game_addr);
}

#[test]
#[should_panic(expected: 'CK: bad bps')]
fn reserving_the_whole_pot_before_play_is_refused() {
    let w = deploy_world();
    start_cheat_caller_address(w.game_addr, w.keeper);
    // Detective pool plus protocol fee must leave something for the winners.
    w.game.create_match(STAKE, SEATS, ROUNDS, 2500, 9000, 1000, hashing::seed_commitment('s'));
    stop_cheat_caller_address(w.game_addr);
}

#[test]
#[should_panic(expected: 'CK: zero amount')]
fn a_free_match_is_refused() {
    let w = deploy_world();
    start_cheat_caller_address(w.game_addr, w.keeper);
    w
        .game
        .create_match(
            0, SEATS, ROUNDS, 2500, DETECTIVE_BPS, PROTOCOL_BPS, hashing::seed_commitment('s'),
        );
    stop_cheat_caller_address(w.game_addr);
}

#[test]
#[should_panic(expected: 'CK: bad bps')]
fn an_impossible_impostor_rate_is_refused() {
    let w = deploy_world();
    start_cheat_caller_address(w.game_addr, w.keeper);
    w
        .game
        .create_match(
            STAKE, SEATS, ROUNDS, 0, DETECTIVE_BPS, PROTOCOL_BPS, hashing::seed_commitment('s'),
        );
    stop_cheat_caller_address(w.game_addr);
}

// ── A3: only the keeper drives the lifecycle ─────────────────────────────────────────

#[test]
#[should_panic(expected: 'CK: not keeper')]
fn a_stranger_cannot_open_a_match() {
    let w = deploy_world();
    start_cheat_caller_address(w.game_addr, addr('stranger'));
    w
        .game
        .create_match(
            STAKE, SEATS, ROUNDS, 2500, DETECTIVE_BPS, PROTOCOL_BPS, hashing::seed_commitment('s'),
        );
    stop_cheat_caller_address(w.game_addr);
}

#[test]
#[should_panic(expected: 'CK: not keeper')]
fn a_stranger_cannot_end_play_early() {
    let w = deploy_world();
    let id = open(w, 'seed');
    start_cheat_caller_address(w.game_addr, addr('stranger'));
    w.game.end_play(id, 1);
    stop_cheat_caller_address(w.game_addr);
}

#[test]
#[should_panic(expected: 'CK: not owner')]
fn only_the_owner_can_hand_over_the_keeper_role() {
    let w = deploy_world();
    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.set_keeper(addr('someone_else'));
    stop_cheat_caller_address(w.game_addr);
}

// ── A7: a commitment can only be used once ───────────────────────────────────────────

#[test]
#[should_panic(expected: 'CK: commitment used')]
fn the_same_seat_commitment_cannot_be_bought_twice() {
    let w = deploy_world();
    let alice = addr('alice');
    fund_and_shield(w, alice, STAKE * 2);
    let id = open(w, 'seed');
    let commitment = hashing::seat_commitment('role', hashing::claim_commitment('claim'));

    start_cheat_caller_address(w.pool_addr, alice);
    w
        .pool
        .invoke(
            w.game_addr,
            w.stake_addr,
            STAKE,
            alice,
            CrewKillOperation::JoinSeat,
            id,
            commitment,
            BallotKind::Vote,
            0,
            0,
            0,
            'note:1',
        );
    // A replayed commitment would let one player hold two seats behind one secret.
    w
        .pool
        .invoke(
            w.game_addr,
            w.stake_addr,
            STAKE,
            alice,
            CrewKillOperation::JoinSeat,
            id,
            commitment,
            BallotKind::Vote,
            0,
            0,
            0,
            'note:2',
        );
    stop_cheat_caller_address(w.pool_addr);
}

// ── A9: play cannot start on a half-empty ship ───────────────────────────────────────

#[test]
#[should_panic(expected: 'CK: lobby underfilled')]
fn play_cannot_start_before_every_seat_is_sold() {
    let w = deploy_world();
    let alice = addr('alice');
    fund_and_shield(w, alice, STAKE);
    let id = open(w, 'seed');

    start_cheat_caller_address(w.pool_addr, alice);
    w
        .pool
        .invoke(
            w.game_addr,
            w.stake_addr,
            STAKE,
            alice,
            CrewKillOperation::JoinSeat,
            id,
            hashing::seat_commitment('role', hashing::claim_commitment('claim')),
            BallotKind::Vote,
            0,
            0,
            0,
            'note',
        );
    stop_cheat_caller_address(w.pool_addr);

    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.start_match(id, 'seed');
    stop_cheat_caller_address(w.game_addr);
}

// ── A16: a seat reveals exactly once ─────────────────────────────────────────────────

#[test]
#[should_panic(expected: 'CK: already revealed')]
fn a_seat_cannot_reveal_twice() {
    let w = deploy_world();
    let alice = addr('alice');
    fund_and_shield(w, alice, STAKE);
    let id = open(w, 'seed');

    start_cheat_caller_address(w.pool_addr, alice);
    w
        .pool
        .invoke(
            w.game_addr,
            w.stake_addr,
            STAKE,
            alice,
            CrewKillOperation::JoinSeat,
            id,
            hashing::seat_commitment('role', hashing::claim_commitment('claim')),
            BallotKind::Vote,
            0,
            0,
            0,
            'note',
        );
    stop_cheat_caller_address(w.pool_addr);

    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.abort_match(id);
    stop_cheat_caller_address(w.game_addr);

    w.game.reveal_seat(id, 'role', hashing::claim_commitment('claim'));
    // Revealing twice would double-count the seat in revealed_count and impostor_count.
    w.game.reveal_seat(id, 'role', hashing::claim_commitment('claim'));
}

#[test]
#[should_panic(expected: 'CK: secret mismatch')]
fn a_reveal_that_matches_no_seat_is_refused() {
    let w = deploy_world();
    let id = open(w, 'seed');
    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.abort_match(id);
    stop_cheat_caller_address(w.game_addr);
    w.game.reveal_seat(id, 'not_a_seat', hashing::claim_commitment('nope'));
}

// ── A28: only the game can mint ballots ──────────────────────────────────────────────

#[test]
#[should_panic(expected: 'CK: not owner')]
fn nobody_but_the_game_can_mint_ballots() {
    let w = deploy_world();
    // Free ballots would mean free votes, so this is the whole integrity of the tally.
    start_cheat_caller_address(w.ballot_addr, addr('forger'));
    IBallotTokenDispatcher { contract_address: w.ballot_addr }.mint(addr('forger'), 1000);
    stop_cheat_caller_address(w.ballot_addr);
}

#[test]
#[should_panic(expected: 'CK: not owner')]
fn nobody_but_the_owner_can_reassign_the_minter() {
    let w = deploy_world();
    start_cheat_caller_address(w.ballot_addr, addr('forger'));
    IBallotTokenDispatcher { contract_address: w.ballot_addr }.set_minter(addr('forger'));
    stop_cheat_caller_address(w.ballot_addr);
}

#[test]
fn the_game_is_the_ballot_minter_after_deployment() {
    let w = deploy_world();
    let minter = IBallotTokenDispatcher { contract_address: w.ballot_addr }.minter();
    assert(minter == w.game_addr, 'game should be the minter');
    assert(
        IERC20Dispatcher { contract_address: w.ballot_addr }.total_supply() == 0,
        'no ballots before a seat',
    );
}
