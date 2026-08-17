use crewkill::constants::NO_TARGET;
use crewkill::hashing;
use crewkill::interfaces::{
    ICrewKillAnonymizerDispatcher, ICrewKillAnonymizerDispatcherTrait, ICrewKillDispatcherTrait,
};
use crewkill::mocks::MockPrivacyPool::IMockPoolDispatcherTrait;
use crewkill::objects::{BallotKind, CrewKillOperation, MatchPhase};
use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use starknet::ContractAddress;
use super::common::{
    DETECTIVE_BPS, PROTOCOL_BPS, ROUNDS, SEATS, STAKE, World, addr, deploy_world,
    fund_and_shield, fund_treasury,
};

/// A player's private material. `role_secret` decides the role and is published at the end
/// of the match; `claim_secret` never is, and is the only thing that can move the money.
#[derive(Copy, Drop)]
struct Player {
    account: ContractAddress,
    role_secret: felt252,
    claim_secret: felt252,
}

fn player(account: felt252, role_secret: felt252, claim_secret: felt252) -> Player {
    Player { account: addr(account), role_secret, claim_secret }
}

fn commitment_of(p: Player) -> felt252 {
    hashing::seat_commitment(p.role_secret, hashing::claim_commitment(p.claim_secret))
}

fn create_lobby(w: World, seed: felt252, impostor_bps: u16) -> u64 {
    start_cheat_caller_address(w.game_addr, w.keeper);
    let id = w
        .game
        .create_match(
            STAKE,
            SEATS,
            ROUNDS,
            impostor_bps,
            DETECTIVE_BPS,
            PROTOCOL_BPS,
            hashing::seed_commitment(seed),
        );
    stop_cheat_caller_address(w.game_addr);
    id
}

/// Buys a seat the way a real player does: from inside a pool transaction, so the game
/// contract never sees an address.
fn join(w: World, match_id: u64, p: Player) {
    start_cheat_caller_address(w.pool_addr, p.account);
    w
        .pool
        .invoke(
            w.game_addr,
            w.stake_addr,
            STAKE,
            p.account,
            CrewKillOperation::JoinSeat,
            match_id,
            commitment_of(p),
            BallotKind::Vote,
            0,
            0,
            0,
            'note:join',
        );
    stop_cheat_caller_address(w.pool_addr);
}

fn cast_vote(w: World, match_id: u64, p: Player, round: u8, target: u32) {
    start_cheat_caller_address(w.pool_addr, p.account);
    w
        .pool
        .invoke(
            w.game_addr,
            w.ballot_addr,
            1,
            p.account,
            CrewKillOperation::CastBallot,
            match_id,
            hashing::vote_receipt(p.role_secret, round, target),
            BallotKind::Vote,
            round,
            target,
            0,
            0,
        );
    stop_cheat_caller_address(w.pool_addr);
}

fn cast_kill(w: World, match_id: u64, p: Player, round: u8, victim: u32) {
    start_cheat_caller_address(w.pool_addr, p.account);
    w
        .pool
        .invoke(
            w.game_addr,
            w.ballot_addr,
            1,
            p.account,
            CrewKillOperation::CastBallot,
            match_id,
            hashing::kill_commitment(p.role_secret, round, victim),
            BallotKind::Kill,
            round,
            victim,
            0,
            0,
        );
    stop_cheat_caller_address(w.pool_addr);
}

fn claim(w: World, match_id: u64, p: Player) {
    start_cheat_caller_address(w.pool_addr, p.account);
    w
        .pool
        .invoke(
            w.game_addr,
            w.stake_addr,
            0,
            p.account,
            CrewKillOperation::Claim,
            match_id,
            0,
            BallotKind::Vote,
            0,
            0,
            p.claim_secret,
            'note:claim',
        );
    stop_cheat_caller_address(w.pool_addr);
}

fn reveal(w: World, match_id: u64, p: Player) {
    w.game.reveal_seat(match_id, p.role_secret, hashing::claim_commitment(p.claim_secret));
}

/// Finds a seed under which `p` draws the role the caller wants, so a test can pin roles
/// without weakening the contract. Mirrors what nobody can do in production: here the test
/// knows every secret up front.
fn find_seed(p: Player, others: Span<Player>, impostor_bps: u16, want_impostor: bool) -> felt252 {
    let mut seed: felt252 = 1;
    let mut found: felt252 = 0;
    while found == 0 {
        // The chain derives final_seed itself; replicate that derivation to search.
        let mut acc: Array<felt252> = array![seed];
        acc.append(commitment_of(p));
        for i in 0..others.len() {
            acc.append(commitment_of(*others.at(i)));
        }
        let final_seed = core::poseidon::poseidon_hash_span(acc.span());

        let target_is_impostor = hashing::draw_is_impostor(
            hashing::role_draw(final_seed, p.role_secret), impostor_bps,
        );
        let mut others_ok = true;
        for i in 0..others.len() {
            let o = *others.at(i);
            if hashing::draw_is_impostor(
                hashing::role_draw(final_seed, o.role_secret), impostor_bps,
            ) {
                others_ok = false;
                break;
            }
        }
        if target_is_impostor == want_impostor && others_ok {
            found = seed;
        } else {
            seed += 1;
        }
    }
    found
}

fn cast() -> (Player, Player, Player, Player) {
    (
        player('alice', 'alice_role', 'alice_claim'),
        player('bob', 'bob_role', 'bob_claim'),
        player('carol', 'carol_role', 'carol_claim'),
        player('dave', 'dave_role', 'dave_claim'),
    )
}

// ══════════════════════════════════════════════════════════════════════════════════════

#[test]
fn seat_purchase_is_anonymous_and_pays_out_ballots() {
    let w = deploy_world();
    let (alice, _, _, _) = cast();
    fund_and_shield(w, alice.account, STAKE);

    let id = create_lobby(w, 'seed', 2500);
    join(w, id, alice);

    let m = w.game.get_match(id);
    assert(m.seats_filled == 1, 'seat not registered');
    assert(m.pot == STAKE, 'pot not credited');

    // The stake left the player's shielded balance and the ballots arrived in its place.
    assert(w.pool.shielded_balance(alice.account, w.stake_addr) == 0, 'stake not taken');
    assert(
        w.pool.shielded_balance(alice.account, w.ballot_addr) == ROUNDS.into(),
        'ballots not issued',
    );

    // The seat carries no address. Nothing on-chain links it to alice.
    let seat = w.game.get_seat(id, 0);
    assert(seat.seat_commitment == commitment_of(alice), 'wrong commitment');
    assert(!seat.revealed, 'revealed too early');
}

#[test]
#[should_panic(expected: 'CK: caller not pool')]
fn privacy_invoke_rejects_direct_callers() {
    let w = deploy_world();
    let (alice, _, _, _) = cast();
    let id = create_lobby(w, 'seed', 2500);
    // Calling the helper directly would let anyone claim a seat without paying.
    ICrewKillAnonymizerDispatcher { contract_address: w.game_addr }
        .privacy_invoke(
            CrewKillOperation::JoinSeat,
            id,
            commitment_of(alice),
            BallotKind::Vote,
            0,
            0,
            0,
            'note',
        );
}

#[test]
#[should_panic(expected: 'CK: stake mismatch')]
fn underpaying_a_seat_reverts() {
    let w = deploy_world();
    let (alice, _, _, _) = cast();
    fund_and_shield(w, alice.account, STAKE);
    let id = create_lobby(w, 'seed', 2500);

    start_cheat_caller_address(w.pool_addr, alice.account);
    w
        .pool
        .invoke(
            w.game_addr,
            w.stake_addr,
            STAKE - 1,
            alice.account,
            CrewKillOperation::JoinSeat,
            id,
            commitment_of(alice),
            BallotKind::Vote,
            0,
            0,
            0,
            'note',
        );
    stop_cheat_caller_address(w.pool_addr);
}

#[test]
#[should_panic(expected: 'CK: seed mismatch')]
fn operator_cannot_swap_the_seed_after_seeing_commitments() {
    let w = deploy_world();
    let (alice, bob, carol, dave) = cast();
    let roster = array![alice, bob, carol, dave];
    for i in 0..roster.len() {
        fund_and_shield(w, (*roster.at(i)).account, STAKE);
    }
    let id = create_lobby(w, 'honest_seed', 2500);
    for i in 0..roster.len() {
        join(w, id, *roster.at(i));
    }
    start_cheat_caller_address(w.game_addr, w.keeper);
    // A seed the operator would rather have used, now that it has seen who joined.
    w.game.start_match(id, 'rigged_seed');
    stop_cheat_caller_address(w.game_addr);
}

#[test]
fn agent_seats_fill_an_empty_lobby_from_the_treasury() {
    let w = deploy_world();
    let (alice, bob, carol, dave) = cast();
    fund_and_shield(w, alice.account, STAKE);
    fund_treasury(w, STAKE * 3);

    let id = create_lobby(w, 'seed', 2500);
    join(w, id, alice);

    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.fill_agent_seat(id, commitment_of(bob));
    w.game.fill_agent_seat(id, commitment_of(carol));
    w.game.fill_agent_seat(id, commitment_of(dave));
    stop_cheat_caller_address(w.game_addr);

    let m = w.game.get_match(id);
    assert(m.seats_filled == SEATS, 'lobby not filled');
    assert(m.pot == STAKE * 4, 'pot wrong');
    assert(w.game.treasury() == 0, 'treasury not drawn down');
    assert(w.game.get_seat(id, 1).is_agent, 'seat 1 not an agent');
    assert(!w.game.get_seat(id, 0).is_agent, 'seat 0 wrongly an agent');
}

#[test]
fn crew_wins_by_ejecting_the_impostor_and_detectives_get_paid() {
    let w = deploy_world();
    let (alice, bob, carol, dave) = cast();
    let roster = array![alice, bob, carol, dave];
    for i in 0..roster.len() {
        fund_and_shield(w, (*roster.at(i)).account, STAKE);
    }

    // Pin alice as the only impostor so the assertions below are deterministic.
    let impostor_bps: u16 = 2500;
    let seed = find_seed(alice, array![bob, carol, dave].span(), impostor_bps, true);

    let id = create_lobby(w, seed, impostor_bps);
    for i in 0..roster.len() {
        join(w, id, *roster.at(i));
    }

    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.start_match(id, seed);
    stop_cheat_caller_address(w.game_addr);
    assert(w.game.get_match(id).phase == MatchPhase::Playing, 'not playing');

    // Round 1: alice kills dave at night. Bob reads it right immediately; carol does not.
    cast_kill(w, id, alice, 1, 3);
    cast_vote(w, id, bob, 1, 0);
    cast_vote(w, id, carol, 1, 1);
    cast_vote(w, id, alice, 1, NO_TARGET);

    // Round 2: the room converges on alice.
    cast_vote(w, id, bob, 2, 0);
    cast_vote(w, id, carol, 2, 0);
    cast_vote(w, id, alice, 2, 1);

    assert(w.game.get_tally(id, 2, 0) == 2, 'tally wrong');
    assert(w.game.get_kill_count(id) == 1, 'kill not recorded');

    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.end_play(id, 2);
    stop_cheat_caller_address(w.game_addr);

    for i in 0..roster.len() {
        reveal(w, id, *roster.at(i));
    }
    let m = w.game.get_match(id);
    assert(m.revealed_count == 4, 'reveals missing');
    assert(m.impostor_count == 1, 'expected one impostor');
    assert(w.game.get_seat(id, 0).is_impostor, 'alice should be impostor');

    w.game.settle(id);
    let m = w.game.get_match(id);
    assert(m.phase == MatchPhase::Settled, 'not settled');
    assert(m.crew_won, 'crew should have won');

    // Alice was ejected in round 2, dave was killed in round 1.
    assert(w.game.get_seat(id, 0).eliminated_round == 2, 'alice not ejected r2');
    assert(w.game.get_seat(id, 3).eliminated_round == 1, 'dave not killed r1');

    let pot = STAKE * 4;
    let fee = pot * PROTOCOL_BPS.into() / 10000;
    let detective = pot * DETECTIVE_BPS.into() / 10000;
    let main = pot - fee - detective;

    // Crew won: bob, carol and dave share the main pot — dave included, dead but on the
    // winning side.
    let per_winner = main / 3;
    assert(w.game.get_seat(id, 0).payout == 0, 'impostor paid');

    // Detective weights: bob voted alice in rounds 1 and 2 (weight 2 + 1), carol only in
    // round 2 (weight 1). Total 4.
    assert(m.detective_weight_total == 4, 'weights wrong');
    let bob_expected = per_winner + detective * 3 / 4;
    let carol_expected = per_winner + detective * 1 / 4;
    assert(w.game.get_seat(id, 1).payout == bob_expected, 'bob payout wrong');
    assert(w.game.get_seat(id, 2).payout == carol_expected, 'carol payout wrong');
    assert(w.game.get_seat(id, 3).payout == per_winner, 'dave payout wrong');

    // And the money is actually collectable, into a shielded note, without naming a wallet.
    claim(w, id, bob);
    assert(
        w.pool.shielded_balance(bob.account, w.stake_addr) == bob_expected, 'bob not paid',
    );
    assert(w.game.get_seat(id, 1).claimed, 'claim flag not set');
}

#[test]
fn a_losing_player_still_takes_the_detective_pool() {
    let w = deploy_world();
    let (alice, bob, carol, dave) = cast();
    let roster = array![alice, bob, carol, dave];
    for i in 0..roster.len() {
        fund_and_shield(w, (*roster.at(i)).account, STAKE);
    }

    let impostor_bps: u16 = 2500;
    let seed = find_seed(alice, array![bob, carol, dave].span(), impostor_bps, true);
    let id = create_lobby(w, seed, impostor_bps);
    for i in 0..roster.len() {
        join(w, id, *roster.at(i));
    }
    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.start_match(id, seed);
    stop_cheat_caller_address(w.game_addr);

    // Bob names alice correctly in round 1, but nobody follows him and alice survives.
    cast_vote(w, id, bob, 1, 0);
    cast_vote(w, id, carol, 1, NO_TARGET);
    cast_vote(w, id, dave, 1, NO_TARGET);
    cast_kill(w, id, alice, 1, 1);
    cast_kill(w, id, alice, 2, 2);

    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.end_play(id, 2);
    stop_cheat_caller_address(w.game_addr);
    for i in 0..roster.len() {
        reveal(w, id, *roster.at(i));
    }
    w.game.settle(id);

    let m = w.game.get_match(id);
    assert(!m.crew_won, 'impostor should have won');

    let pot = STAKE * 4;
    let fee = pot * PROTOCOL_BPS.into() / 10000;
    let detective = pot * DETECTIVE_BPS.into() / 10000;
    let main = pot - fee - detective;

    // Alice is the only winner and takes the whole main pot.
    assert(w.game.get_seat(id, 0).payout == main, 'impostor payout wrong');
    // Bob lost the match and is dead, yet his early read still pays.
    assert(w.game.get_seat(id, 1).payout == detective, 'detective not paid');
    assert(w.game.get_seat(id, 2).payout == 0, 'carol should get nothing');
    assert(w.game.get_seat(id, 3).payout == 0, 'dave should get nothing');

    claim(w, id, bob);
    assert(w.pool.shielded_balance(bob.account, w.stake_addr) == detective, 'bob not paid');
}

#[test]
fn a_crewmate_who_fakes_a_kill_forfeits_the_match() {
    let w = deploy_world();
    let (alice, bob, carol, dave) = cast();
    let roster = array![alice, bob, carol, dave];
    for i in 0..roster.len() {
        fund_and_shield(w, (*roster.at(i)).account, STAKE);
    }

    let impostor_bps: u16 = 2500;
    let seed = find_seed(alice, array![bob, carol, dave].span(), impostor_bps, true);
    let id = create_lobby(w, seed, impostor_bps);
    for i in 0..roster.len() {
        join(w, id, *roster.at(i));
    }
    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.start_match(id, seed);
    stop_cheat_caller_address(w.game_addr);

    // Carol is a crewmate but spends a ballot as if she were an impostor. The engine has no
    // way to tell at the time — settlement does, and it costs her everything.
    cast_kill(w, id, carol, 1, 3);
    cast_vote(w, id, bob, 1, 0);
    cast_vote(w, id, dave, 1, 0);
    cast_vote(w, id, alice, 1, NO_TARGET);

    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.end_play(id, 1);
    stop_cheat_caller_address(w.game_addr);
    for i in 0..roster.len() {
        reveal(w, id, *roster.at(i));
    }
    w.game.settle(id);

    assert(w.game.get_match(id).crew_won, 'crew should have won');
    assert(!w.game.get_kill(id, 0).validated, 'bluff should not validate');
    assert(w.game.get_seat(id, 2).payout == 0, 'bluffer was paid');
    assert(w.game.get_seat(id, 1).payout > 0, 'honest crew unpaid');
}

#[test]
fn a_seat_that_never_reveals_forfeits_its_stake() {
    let w = deploy_world();
    let (alice, bob, carol, dave) = cast();
    let roster = array![alice, bob, carol, dave];
    for i in 0..roster.len() {
        fund_and_shield(w, (*roster.at(i)).account, STAKE);
    }
    let impostor_bps: u16 = 2500;
    let seed = find_seed(alice, array![bob, carol, dave].span(), impostor_bps, true);
    let id = create_lobby(w, seed, impostor_bps);
    for i in 0..roster.len() {
        join(w, id, *roster.at(i));
    }
    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.start_match(id, seed);
    stop_cheat_caller_address(w.game_addr);

    cast_vote(w, id, bob, 1, 0);
    cast_vote(w, id, carol, 1, 0);
    cast_vote(w, id, dave, 1, NO_TARGET);

    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.end_play(id, 1);
    stop_cheat_caller_address(w.game_addr);

    // Dave walks away without revealing.
    reveal(w, id, alice);
    reveal(w, id, bob);
    reveal(w, id, carol);
    w.game.settle(id);

    assert(w.game.get_seat(id, 3).payout == 0, 'ghost seat paid');
    // Nothing is stranded: every unit of the pot is either owed to a seat or booked as fees.
    let m = w.game.get_match(id);
    let mut owed: u128 = 0;
    for i in 0..m.seats_filled {
        owed += w.game.get_seat(id, i).payout;
    }
    assert(owed + w.game.protocol_fees() == m.pot, 'pot does not balance');
}

#[test]
#[should_panic(expected: 'CK: replayed commitment')]
fn a_ballot_cannot_be_replayed() {
    let w = deploy_world();
    let (alice, bob, carol, dave) = cast();
    let roster = array![alice, bob, carol, dave];
    for i in 0..roster.len() {
        fund_and_shield(w, (*roster.at(i)).account, STAKE);
    }
    let id = create_lobby(w, 'seed', 2500);
    for i in 0..roster.len() {
        join(w, id, *roster.at(i));
    }
    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.start_match(id, 'seed');
    stop_cheat_caller_address(w.game_addr);

    cast_vote(w, id, bob, 1, 0);
    cast_vote(w, id, bob, 1, 0);
}

#[test]
#[should_panic(expected: 'CK: ballot mismatch')]
fn voting_without_spending_a_ballot_reverts() {
    let w = deploy_world();
    let (alice, bob, carol, dave) = cast();
    let roster = array![alice, bob, carol, dave];
    for i in 0..roster.len() {
        fund_and_shield(w, (*roster.at(i)).account, STAKE);
    }
    let id = create_lobby(w, 'seed', 2500);
    for i in 0..roster.len() {
        join(w, id, *roster.at(i));
    }
    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.start_match(id, 'seed');
    stop_cheat_caller_address(w.game_addr);

    start_cheat_caller_address(w.pool_addr, bob.account);
    w
        .pool
        .invoke(
            w.game_addr,
            w.ballot_addr,
            0, // no ballot spent
            bob.account,
            CrewKillOperation::CastBallot,
            id,
            hashing::vote_receipt(bob.role_secret, 1, 0),
            BallotKind::Vote,
            1,
            0,
            0,
            0,
        );
    stop_cheat_caller_address(w.pool_addr);
}

#[test]
#[should_panic(expected: 'CK: already claimed')]
fn a_payout_cannot_be_claimed_twice() {
    let w = deploy_world();
    let (alice, bob, carol, dave) = cast();
    let roster = array![alice, bob, carol, dave];
    for i in 0..roster.len() {
        fund_and_shield(w, (*roster.at(i)).account, STAKE);
    }
    let impostor_bps: u16 = 2500;
    let seed = find_seed(alice, array![bob, carol, dave].span(), impostor_bps, true);
    let id = create_lobby(w, seed, impostor_bps);
    for i in 0..roster.len() {
        join(w, id, *roster.at(i));
    }
    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.start_match(id, seed);
    stop_cheat_caller_address(w.game_addr);
    cast_vote(w, id, bob, 1, 0);
    cast_vote(w, id, carol, 1, 0);
    cast_vote(w, id, dave, 1, 0);
    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.end_play(id, 1);
    stop_cheat_caller_address(w.game_addr);
    for i in 0..roster.len() {
        reveal(w, id, *roster.at(i));
    }
    w.game.settle(id);
    claim(w, id, bob);
    claim(w, id, bob);
}

#[test]
#[should_panic(expected: 'CK: seat not revealed')]
fn the_role_secret_alone_cannot_move_the_money() {
    let w = deploy_world();
    let (alice, bob, carol, dave) = cast();
    let roster = array![alice, bob, carol, dave];
    for i in 0..roster.len() {
        fund_and_shield(w, (*roster.at(i)).account, STAKE);
    }
    let impostor_bps: u16 = 2500;
    let seed = find_seed(alice, array![bob, carol, dave].span(), impostor_bps, true);
    let id = create_lobby(w, seed, impostor_bps);
    for i in 0..roster.len() {
        join(w, id, *roster.at(i));
    }
    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.start_match(id, seed);
    stop_cheat_caller_address(w.game_addr);
    cast_vote(w, id, bob, 1, 0);
    cast_vote(w, id, carol, 1, 0);
    cast_vote(w, id, dave, 1, 0);
    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.end_play(id, 1);
    stop_cheat_caller_address(w.game_addr);
    for i in 0..roster.len() {
        reveal(w, id, *roster.at(i));
    }
    w.game.settle(id);

    // Bob's role secret is public now. A thief who knows it still has no claim secret.
    let thief = Player {
        account: addr('thief'), role_secret: bob.role_secret, claim_secret: 'wrong',
    };
    claim(w, id, thief);
}

#[test]
fn aborting_a_match_refunds_every_seat_in_full() {
    let w = deploy_world();
    let (alice, bob, _, _) = cast();
    fund_and_shield(w, alice.account, STAKE);
    fund_and_shield(w, bob.account, STAKE);
    let id = create_lobby(w, 'seed', 2500);
    join(w, id, alice);
    join(w, id, bob);

    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.abort_match(id);
    stop_cheat_caller_address(w.game_addr);

    reveal(w, id, alice);
    claim(w, id, alice);
    assert(w.pool.shielded_balance(alice.account, w.stake_addr) == STAKE, 'no refund');
    assert(w.game.protocol_fees() == 0, 'fee taken on abort');
}

#[test]
fn a_match_with_no_impostors_is_a_crew_win() {
    let w = deploy_world();
    let (alice, bob, carol, dave) = cast();
    let roster = array![alice, bob, carol, dave];
    for i in 0..roster.len() {
        fund_and_shield(w, (*roster.at(i)).account, STAKE);
    }
    // Search for a seed under which nobody draws the impostor band.
    let impostor_bps: u16 = 2500;
    let seed = find_seed(alice, array![bob, carol, dave].span(), impostor_bps, false);
    let id = create_lobby(w, seed, impostor_bps);
    for i in 0..roster.len() {
        join(w, id, *roster.at(i));
    }
    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.start_match(id, seed);
    stop_cheat_caller_address(w.game_addr);
    cast_vote(w, id, bob, 1, NO_TARGET);
    cast_vote(w, id, carol, 1, NO_TARGET);
    start_cheat_caller_address(w.game_addr, w.keeper);
    w.game.end_play(id, 1);
    stop_cheat_caller_address(w.game_addr);
    for i in 0..roster.len() {
        reveal(w, id, *roster.at(i));
    }
    w.game.settle(id);

    let m = w.game.get_match(id);
    assert(m.impostor_count == 0, 'expected a ghost ship');
    assert(m.crew_won, 'crew should win by default');
    assert(m.detective_weight_total == 0, 'nothing to detect');
}
