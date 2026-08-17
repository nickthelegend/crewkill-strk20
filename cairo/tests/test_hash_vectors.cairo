//! Cross-language pin.
//!
//! The same vectors are asserted in `packages/protocol/tests/hashing.test.ts`. The browser
//! computes a seat commitment before it stakes and a claim commitment before it collects; if
//! Cairo and TypeScript ever disagree about a tag, an argument order or a Poseidon call, a
//! player's money becomes unreachable. This suite is what makes that a red build instead.

use crewkill::hashing;

const ROLE_SECRET: felt252 = 111;
const CLAIM_SECRET: felt252 = 222;
const OPERATOR_SEED: felt252 = 333;

#[test]
fn claim_commitment_matches_typescript() {
    assert(
        hashing::claim_commitment(CLAIM_SECRET) == 0x336f8495b2d8a30911f6e1792fb0f13f9831eec163c551664bf1e5b602028ec,
        'claim vector drifted',
    );
}

#[test]
fn seat_commitment_matches_typescript() {
    let claim = hashing::claim_commitment(CLAIM_SECRET);
    assert(
        hashing::seat_commitment(ROLE_SECRET, claim) == 0x51e5caffcc667f24e161be33d7930ef6fa75ed4be72877ff481028dc7fda73c,
        'seat vector drifted',
    );
}

#[test]
fn seed_commitment_matches_typescript() {
    assert(
        hashing::seed_commitment(OPERATOR_SEED) == 0x371c563211071964e54e16ae8db2f45bcacc89e0982d9abd541a25362ec5e67,
        'seed vector drifted',
    );
}

/// `final_seed` is derived inside `start_match`, so this pins the derivation the keeper
/// replicates when it tells a player what their role is.
#[test]
fn final_seed_matches_typescript() {
    let acc = array![OPERATOR_SEED, 1, 2, 3];
    assert(
        core::poseidon::poseidon_hash_span(acc.span()) == 0x295e7b07295b9cb72f60ac895d3ae23a4e29d32d68457badd7bf52a7eaeaf51,
        'final seed vector drifted',
    );
}

#[test]
fn role_draw_matches_typescript() {
    assert(
        hashing::role_draw(99, ROLE_SECRET) == 0x2c4bcc0a0e969b7e22c10a7501d549d2eaac724b6c0a9c8bf65b3b2099a56ae,
        'draw vector drifted',
    );
}

#[test]
fn vote_receipt_matches_typescript() {
    assert(
        hashing::vote_receipt(ROLE_SECRET, 2, 3) == 0x76dac4132424fa8813f469a0c0b84d1240b4f02e5c77c66b036ef872e9cc377,
        'vote vector drifted',
    );
}

#[test]
fn kill_commitment_matches_typescript() {
    assert(
        hashing::kill_commitment(ROLE_SECRET, 1, 4) == 0x32e4661c0df679bfa89e6c94bbb30f9f49dcbd5a60e7b894bebaa7f5cadefad,
        'kill vector drifted',
    );
}

/// The impostor band reads the low four decimal digits of the draw, so a `impostor_bps` of
/// 2500 really does mean one seat in four.
#[test]
fn impostor_band_reads_the_low_digits() {
    assert(hashing::draw_is_impostor(12345, 5000), 'should be impostor');
    assert(!hashing::draw_is_impostor(12345, 2000), 'should be crew');
    assert(hashing::draw_is_impostor(10000, 1), 'zero bucket is impostor');
}
