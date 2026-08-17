//! CrewKill — a staked social-deduction match, settled entirely on-chain.
//!
//! This one contract is both the game and a STRK20 *anonymizer*: the privacy pool calls
//! `privacy_invoke` on it inside a private transaction, so stakes, ballots and payouts all
//! move without ever naming a wallet.
//!
//! ## Why nobody — including us — can cheat
//!
//! * **Roles.** Before a lobby opens, the operator publishes `poseidon(OPSEED_TAG, seed)`.
//!   Every player then commits `poseidon(SEAT_TAG, role_secret, claim_commitment)` when they
//!   buy a seat. When the roster locks, the operator reveals `seed` and the chain fixes
//!   `final_seed = poseidon(seed, c_0 .. c_n)`. A seat is an impostor iff
//!   `poseidon(DRAW_TAG, final_seed, role_secret) % 10000 < impostor_bps`.
//!   The operator cannot bias the draw (its seed was committed before it saw any player
//!   commitment) and players cannot grind theirs (their commitment is fixed before the seed
//!   is public). Crucially the operator *also cannot read the roles*: the draw needs
//!   `role_secret`, which never leaves the player until the match is over.
//!
//! * **Impostor count is itself a secret.** Because each seat draws independently, nobody
//!   knows whether a match has one impostor, three, or none at all. That is deliberate — it
//!   is deduction under genuine uncertainty, and it falls straight out of the cryptography.
//!
//! * **Votes.** A vote is cast by *spending a ballot note* through the pool. The pool proves
//!   the voter owned a ballot without revealing which one, so this contract records a tally
//!   and a receipt and learns nothing about who voted. The receipt
//!   `poseidon(VOTE_TAG, role_secret, round, target)` is unforgeable without the role secret
//!   and unreadable until that secret is published at the end of the match — at which point
//!   the whole match becomes publicly auditable.
//!
//! * **Settlement.** `settle` is permissionless and replays the match from on-chain data
//!   alone: night actions, ejections, the win condition and every payout. The off-chain
//!   engine is a mirror for the UI, never the source of truth.
//!
//! ## The Detective Pool
//!
//! A slice of the pot is set aside before play. Anyone who voted for a seat that turns out
//! to be an impostor takes a share of it *whether or not their side won*, weighted toward
//! earlier rounds where there was less public information to go on. Reading the room
//! correctly pays even from the losing side.

#[starknet::contract]
pub mod CrewKill {
    use core::num::traits::Zero;
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use crate::constants::{BPS_DENOM, MAX_KILLS, MAX_ROUNDS, MAX_SEATS, NO_TARGET, errors};
    use crate::hashing;
    use crate::interfaces::{
        IBallotTokenDispatcher, IBallotTokenDispatcherTrait, ICrewKill, ICrewKillAnonymizer,
        IERC20Dispatcher, IERC20DispatcherTrait,
    };
    use crate::objects::{
        BallotKind, CrewKillOperation, KillClaim, MatchInfo, MatchPhase, OpenNoteDeposit, Seat,
        VoteReceipt,
    };

    #[storage]
    struct Storage {
        /// The STRK20 privacy pool. Pinned at deployment; the only address allowed to call
        /// `privacy_invoke`, because this helper holds funds between transactions.
        privacy_pool: ContractAddress,
        /// Off-chain keeper. Starknet has no native timers, so round progression, lobby
        /// close and the reveal window are driven from outside. The keeper can only move
        /// the match along — it can never read a role or touch a payout.
        keeper: ContractAddress,
        owner: ContractAddress,
        /// Token stakes and payouts are denominated in (STRK on mainnet).
        stake_token: ContractAddress,
        /// Valueless token whose notes are spent to cast anonymous ballots.
        ballot_token: ContractAddress,
        /// Stake-token balance this contract believes it holds. The delta against the real
        /// ERC-20 balance is how an incoming pool withdrawal is measured.
        accounted_stake: u128,
        /// House float used to auto-fill empty seats with agents.
        treasury: u128,
        protocol_fees: u128,
        next_match_id: u64,
        matches: Map<u64, MatchInfo>,
        seats: Map<(u64, u32), Seat>,
        /// `seat_commitment -> seat_index + 1` (0 means "not in this match").
        seat_lookup: Map<(u64, felt252), u32>,
        /// `(match, round, target) -> votes`.
        tally: Map<(u64, u8, u32), u32>,
        /// Vote receipts, keyed by the receipt hash itself so nothing links one to a seat.
        receipts: Map<felt252, VoteReceipt>,
        kills: Map<(u64, u32), KillClaim>,
        kill_count: Map<u64, u32>,
        /// Detective-Pool weight accrued per seat, written during settlement.
        det_weight: Map<(u64, u32), u64>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        MatchCreated: MatchCreated,
        SeatBought: SeatBought,
        MatchStarted: MatchStarted,
        BallotCast: BallotCast,
        PlayEnded: PlayEnded,
        SeatRevealed: SeatRevealed,
        MatchSettled: MatchSettled,
        PayoutClaimed: PayoutClaimed,
        MatchAborted: MatchAborted,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MatchCreated {
        #[key]
        pub match_id: u64,
        pub stake_amount: u128,
        pub seat_count: u32,
        pub rounds: u8,
        pub impostor_bps: u16,
        pub detective_bps: u16,
        pub seed_commitment: felt252,
    }

    /// Deliberately carries no address. A seat is bought from inside a pool transaction, so
    /// there is no buyer to name — that is the whole point.
    #[derive(Drop, starknet::Event)]
    pub struct SeatBought {
        #[key]
        pub match_id: u64,
        pub seat_index: u32,
        pub seat_commitment: felt252,
        pub is_agent: bool,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MatchStarted {
        #[key]
        pub match_id: u64,
        pub final_seed: felt252,
        pub seats_filled: u32,
        pub pot: u128,
    }

    /// Records that *a* ballot was spent, never whose.
    #[derive(Drop, starknet::Event)]
    pub struct BallotCast {
        #[key]
        pub match_id: u64,
        pub round: u8,
        pub target_seat: u32,
        pub is_kill: bool,
        pub receipt: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PlayEnded {
        #[key]
        pub match_id: u64,
        pub rounds_played: u8,
    }

    #[derive(Drop, starknet::Event)]
    pub struct SeatRevealed {
        #[key]
        pub match_id: u64,
        pub seat_index: u32,
        pub role_secret: felt252,
        pub is_impostor: bool,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MatchSettled {
        #[key]
        pub match_id: u64,
        pub crew_won: bool,
        pub impostor_count: u32,
        pub pot: u128,
        pub detective_weight_total: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PayoutClaimed {
        #[key]
        pub match_id: u64,
        pub seat_index: u32,
        pub amount: u128,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MatchAborted {
        #[key]
        pub match_id: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        keeper: ContractAddress,
        privacy_pool: ContractAddress,
        stake_token: ContractAddress,
        ballot_token: ContractAddress,
    ) {
        assert(owner.is_non_zero(), errors::ZERO_ADDRESS);
        assert(keeper.is_non_zero(), errors::ZERO_ADDRESS);
        assert(privacy_pool.is_non_zero(), errors::ZERO_ADDRESS);
        assert(stake_token.is_non_zero(), errors::ZERO_ADDRESS);
        assert(ballot_token.is_non_zero(), errors::ZERO_ADDRESS);
        self.owner.write(owner);
        self.keeper.write(keeper);
        self.privacy_pool.write(privacy_pool);
        self.stake_token.write(stake_token);
        self.ballot_token.write(ballot_token);
        self.next_match_id.write(1);
    }

    // ══════════════════════════════════════════════════════════════════════════════════
    // The pool-facing surface
    // ══════════════════════════════════════════════════════════════════════════════════

    #[abi(embed_v0)]
    impl AnonymizerImpl of ICrewKillAnonymizer<ContractState> {
        /// Called by the privacy pool via `INVOKE_SELECTOR` inside a private transaction.
        ///
        /// The pool has already withdrawn any input tokens to this contract by the time we
        /// run, so inputs are measured as a balance delta rather than trusted from calldata.
        /// The return value tells the pool which open notes to credit; an empty span means
        /// "credit nothing", which is what a vote returns.
        fn privacy_invoke(
            ref self: ContractState,
            operation: CrewKillOperation,
            match_id: u64,
            commitment: felt252,
            kind: BallotKind,
            round: u8,
            target_seat: u32,
            secret: felt252,
            note_id: felt252,
        ) -> Span<OpenNoteDeposit> {
            assert(get_caller_address() == self.privacy_pool.read(), errors::NOT_POOL);

            match operation {
                CrewKillOperation::JoinSeat => self.do_join_seat(match_id, commitment, note_id),
                CrewKillOperation::CastBallot => self
                    .do_cast_ballot(match_id, commitment, kind, round, target_seat),
                CrewKillOperation::Claim => self.do_claim(match_id, secret, note_id),
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════════════════════
    // Lifecycle, reveals, settlement and reads
    // ══════════════════════════════════════════════════════════════════════════════════

    #[abi(embed_v0)]
    impl CrewKillImpl of ICrewKill<ContractState> {
        fn create_match(
            ref self: ContractState,
            stake_amount: u128,
            seat_count: u32,
            rounds: u8,
            impostor_bps: u16,
            detective_bps: u16,
            protocol_bps: u16,
            seed_commitment: felt252,
        ) -> u64 {
            self.only_keeper();
            assert(stake_amount > 0, errors::ZERO_AMOUNT);
            assert(seat_count >= 4 && seat_count <= MAX_SEATS, errors::TOO_MANY_SEATS);
            assert(rounds >= 1 && rounds <= MAX_ROUNDS, errors::TOO_MANY_ROUNDS);
            assert(impostor_bps > 0 && impostor_bps < 10000, errors::BAD_BPS);
            let reserved: u32 = detective_bps.into() + protocol_bps.into();
            assert(reserved < 10000, errors::BAD_BPS);
            assert(seed_commitment.is_non_zero(), errors::BAD_SEED);

            let match_id = self.next_match_id.read();
            self.next_match_id.write(match_id + 1);
            self
                .matches
                .entry(match_id)
                .write(
                    MatchInfo {
                        phase: MatchPhase::Lobby,
                        stake_amount,
                        seat_count,
                        seats_filled: 0,
                        rounds,
                        impostor_bps,
                        detective_bps,
                        protocol_bps,
                        seed_commitment,
                        final_seed: 0,
                        pot: 0,
                        rounds_played: 0,
                        crew_won: false,
                        revealed_count: 0,
                        impostor_count: 0,
                        detective_weight_total: 0,
                    },
                );
            self
                .emit(
                    MatchCreated {
                        match_id,
                        stake_amount,
                        seat_count,
                        rounds,
                        impostor_bps,
                        detective_bps,
                        seed_commitment,
                    },
                );
            match_id
        }

        fn fill_agent_seat(
            ref self: ContractState, match_id: u64, seat_commitment: felt252,
        ) -> u32 {
            self.only_keeper();
            let m = self.load_match(match_id);
            assert(m.phase == MatchPhase::Lobby, errors::BAD_PHASE);

            let treasury = self.treasury.read();
            assert(treasury >= m.stake_amount, errors::TREASURY_EMPTY);
            self.treasury.write(treasury - m.stake_amount);

            self.seat_in(match_id, seat_commitment, true)
        }

        fn start_match(ref self: ContractState, match_id: u64, operator_seed: felt252) {
            self.only_keeper();
            let mut m = self.load_match(match_id);
            assert(m.phase == MatchPhase::Lobby, errors::BAD_PHASE);
            assert(m.seats_filled == m.seat_count, errors::NOT_ENOUGH_SEATS);
            assert(
                hashing::seed_commitment(operator_seed) == m.seed_commitment, errors::BAD_SEED,
            );

            // Every seat commitment feeds the seed, so each player contributed entropy the
            // operator could not see when it fixed its own.
            let mut acc: Array<felt252> = array![operator_seed];
            for i in 0..m.seat_count {
                acc.append(self.seats.entry((match_id, i)).read().seat_commitment);
            }
            m.final_seed = core::poseidon::poseidon_hash_span(acc.span());
            m.phase = MatchPhase::Playing;
            self.matches.entry(match_id).write(m);
            self
                .emit(
                    MatchStarted {
                        match_id,
                        final_seed: m.final_seed,
                        seats_filled: m.seats_filled,
                        pot: m.pot,
                    },
                );
        }

        fn end_play(ref self: ContractState, match_id: u64, rounds_played: u8) {
            self.only_keeper();
            let mut m = self.load_match(match_id);
            assert(m.phase == MatchPhase::Playing, errors::BAD_PHASE);
            assert(rounds_played >= 1 && rounds_played <= m.rounds, errors::BAD_ROUND);
            m.rounds_played = rounds_played;
            m.phase = MatchPhase::Revealing;
            self.matches.entry(match_id).write(m);
            self.emit(PlayEnded { match_id, rounds_played });
        }

        fn abort_match(ref self: ContractState, match_id: u64) {
            self.only_keeper();
            let mut m = self.load_match(match_id);
            assert(
                m.phase == MatchPhase::Lobby || m.phase == MatchPhase::Playing, errors::BAD_PHASE,
            );
            // Full refund: every seat gets its stake back, no protocol fee, no pool split.
            for i in 0..m.seats_filled {
                let mut s = self.seats.entry((match_id, i)).read();
                s.payout = m.stake_amount;
                self.seats.entry((match_id, i)).write(s);
            }
            m.phase = MatchPhase::Aborted;
            self.matches.entry(match_id).write(m);
            self.emit(MatchAborted { match_id });
        }

        fn reveal_seat(
            ref self: ContractState, match_id: u64, role_secret: felt252, claim_commitment: felt252,
        ) {
            let m = self.load_match(match_id);
            assert(
                m.phase == MatchPhase::Revealing || m.phase == MatchPhase::Aborted,
                errors::BAD_PHASE,
            );
            let commitment = hashing::seat_commitment(role_secret, claim_commitment);
            let seat_index = self.lookup_seat(match_id, commitment);

            let mut s = self.seats.entry((match_id, seat_index)).read();
            assert(!s.revealed, errors::ALREADY_REVEALED);
            s.revealed = true;
            s.role_secret = role_secret;
            s.claim_commitment = claim_commitment;
            s.is_impostor = hashing::draw_is_impostor(
                hashing::role_draw(m.final_seed, role_secret), m.impostor_bps,
            );
            self.seats.entry((match_id, seat_index)).write(s);

            let mut m2 = m;
            m2.revealed_count += 1;
            if s.is_impostor {
                m2.impostor_count += 1;
            }
            self.matches.entry(match_id).write(m2);
            self
                .emit(
                    SeatRevealed {
                        match_id, seat_index, role_secret, is_impostor: s.is_impostor,
                    },
                );
        }

        /// Replays the entire match from chain state and writes every payout. Permissionless:
        /// anybody can settle, and everybody gets the same answer, because the inputs are
        /// public and the rules are here rather than on a server.
        fn settle(ref self: ContractState, match_id: u64) {
            let mut m = self.load_match(match_id);
            assert(m.phase == MatchPhase::Revealing, errors::BAD_PHASE);

            let impostors = self.collect_impostors(match_id, m.seats_filled);
            self.validate_kills(match_id, @impostors);
            self.replay_eliminations(match_id, m);

            // The crew wins by eliminating every impostor. Anything else — impostors still
            // breathing when the round limit hits, or the crew wiped out — is an impostor win.
            // A match that drew no impostors at all is therefore a crew win by default, which
            // is exactly right: there was never anything to catch.
            let (alive_impostors, _alive_crew) = self.count_alive(match_id, m.seats_filled);
            m.crew_won = alive_impostors == 0;

            let weight_total = self
                .score_detectives(match_id, m.seats_filled, m.rounds_played, @impostors);
            m.detective_weight_total = weight_total;

            self.pay_out(match_id, ref m, weight_total);

            m.phase = MatchPhase::Settled;
            self.matches.entry(match_id).write(m);
            self
                .emit(
                    MatchSettled {
                        match_id,
                        crew_won: m.crew_won,
                        impostor_count: m.impostor_count,
                        pot: m.pot,
                        detective_weight_total: weight_total,
                    },
                );
        }

        fn get_match(self: @ContractState, match_id: u64) -> MatchInfo {
            self.matches.entry(match_id).read()
        }

        fn get_seat(self: @ContractState, match_id: u64, seat_index: u32) -> Seat {
            self.seats.entry((match_id, seat_index)).read()
        }

        fn get_seat_index(
            self: @ContractState, match_id: u64, seat_commitment: felt252,
        ) -> u32 {
            let raw = self.seat_lookup.entry((match_id, seat_commitment)).read();
            assert(raw != 0, errors::BAD_SECRET);
            raw - 1
        }

        fn get_tally(self: @ContractState, match_id: u64, round: u8, target_seat: u32) -> u32 {
            self.tally.entry((match_id, round, target_seat)).read()
        }

        fn get_receipt(self: @ContractState, receipt: felt252) -> VoteReceipt {
            self.receipts.entry(receipt).read()
        }

        fn get_kill(self: @ContractState, match_id: u64, index: u32) -> KillClaim {
            self.kills.entry((match_id, index)).read()
        }

        fn get_kill_count(self: @ContractState, match_id: u64) -> u32 {
            self.kill_count.entry(match_id).read()
        }

        fn match_count(self: @ContractState) -> u64 {
            self.next_match_id.read() - 1
        }

        fn config(
            self: @ContractState,
        ) -> (ContractAddress, ContractAddress, ContractAddress, ContractAddress) {
            (
                self.privacy_pool.read(),
                self.keeper.read(),
                self.stake_token.read(),
                self.ballot_token.read(),
            )
        }

        fn treasury(self: @ContractState) -> u128 {
            self.treasury.read()
        }

        fn protocol_fees(self: @ContractState) -> u128 {
            self.protocol_fees.read()
        }

        fn fund_treasury(ref self: ContractState, amount: u128) {
            assert(amount > 0, errors::ZERO_AMOUNT);
            let caller = get_caller_address();
            IERC20Dispatcher { contract_address: self.stake_token.read() }
                .transfer_from(caller, get_contract_address(), amount.into());
            self.treasury.write(self.treasury.read() + amount);
            self.accounted_stake.write(self.accounted_stake.read() + amount);
        }

        fn withdraw_protocol_fees(ref self: ContractState, recipient: ContractAddress) {
            self.only_owner();
            assert(recipient.is_non_zero(), errors::ZERO_ADDRESS);
            let fees = self.protocol_fees.read();
            assert(fees > 0, errors::NOTHING_TO_CLAIM);
            self.protocol_fees.write(0);
            self.accounted_stake.write(self.accounted_stake.read() - fees);
            IERC20Dispatcher { contract_address: self.stake_token.read() }
                .transfer(recipient, fees.into());
        }

        fn set_keeper(ref self: ContractState, keeper: ContractAddress) {
            self.only_owner();
            assert(keeper.is_non_zero(), errors::ZERO_ADDRESS);
            self.keeper.write(keeper);
        }

        fn transfer_ownership(ref self: ContractState, owner: ContractAddress) {
            self.only_owner();
            assert(owner.is_non_zero(), errors::ZERO_ADDRESS);
            self.owner.write(owner);
        }
    }

    // ══════════════════════════════════════════════════════════════════════════════════
    // Internals
    // ══════════════════════════════════════════════════════════════════════════════════

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn only_keeper(self: @ContractState) {
            let caller = get_caller_address();
            assert(
                caller == self.keeper.read() || caller == self.owner.read(), errors::NOT_KEEPER,
            );
        }

        fn only_owner(self: @ContractState) {
            assert(get_caller_address() == self.owner.read(), errors::NOT_OWNER);
        }

        fn load_match(self: @ContractState, match_id: u64) -> MatchInfo {
            let m = self.matches.entry(match_id).read();
            assert(m.seat_count != 0, errors::NO_MATCH);
            m
        }

        fn lookup_seat(self: @ContractState, match_id: u64, commitment: felt252) -> u32 {
            let raw = self.seat_lookup.entry((match_id, commitment)).read();
            assert(raw != 0, errors::BAD_SECRET);
            raw - 1
        }

        /// Registers a seat and books its stake into the pot. Shared by human seats (paid
        /// through the pool) and agent seats (paid from the treasury).
        fn seat_in(
            ref self: ContractState, match_id: u64, seat_commitment: felt252, is_agent: bool,
        ) -> u32 {
            let mut m = self.matches.entry(match_id).read();
            assert(m.seats_filled < m.seat_count, errors::SEATS_FULL);
            assert(seat_commitment.is_non_zero(), errors::SEAT_TAKEN);
            assert(
                self.seat_lookup.entry((match_id, seat_commitment)).read() == 0,
                errors::SEAT_TAKEN,
            );

            let index = m.seats_filled;
            self
                .seats
                .entry((match_id, index))
                .write(
                    Seat {
                        seat_commitment,
                        role_secret: 0,
                        claim_commitment: 0,
                        revealed: false,
                        is_agent,
                        is_impostor: false,
                        eliminated: false,
                        eliminated_round: 0,
                        payout: 0,
                        claimed: false,
                    },
                );
            self.seat_lookup.entry((match_id, seat_commitment)).write(index + 1);
            m.seats_filled = index + 1;
            m.pot += m.stake_amount;
            self.matches.entry(match_id).write(m);
            self.emit(SeatBought { match_id, seat_index: index, seat_commitment, is_agent });
            index
        }

        /// Stake in, ballots out. The pool moved the stake to us before calling, so the
        /// amount is read off the balance delta rather than taken on trust from calldata.
        fn do_join_seat(
            ref self: ContractState, match_id: u64, seat_commitment: felt252, note_id: felt252,
        ) -> Span<OpenNoteDeposit> {
            let m = self.load_match(match_id);
            assert(m.phase == MatchPhase::Lobby, errors::BAD_PHASE);

            let stake_token = self.stake_token.read();
            let balance = IERC20Dispatcher { contract_address: stake_token }
                .balance_of(get_contract_address());
            let accounted = self.accounted_stake.read();
            let received = u256_to_u128(balance) - accounted;
            assert(received == m.stake_amount, errors::BAD_STAKE);
            self.accounted_stake.write(accounted + received);

            self.seat_in(match_id, seat_commitment, false);

            // One ballot note per meeting. Minted straight into the pool's open note, so the
            // player's ballots are shielded from the moment they exist.
            let ballots: u128 = m.rounds.into();
            let ballot_token = self.ballot_token.read();
            let pool = self.privacy_pool.read();
            IBallotTokenDispatcher { contract_address: ballot_token }
                .mint(get_contract_address(), ballots.into());
            IERC20Dispatcher { contract_address: ballot_token }.approve(pool, ballots.into());

            [OpenNoteDeposit { note_id, token: ballot_token, amount: ballots }].span()
        }

        /// A vote or a night action. The ballot note has already been withdrawn to us by the
        /// pool; we check it arrived, burn it, and record the result. Nothing here identifies
        /// the caller, and nothing can: the pool proved note ownership, not identity.
        fn do_cast_ballot(
            ref self: ContractState,
            match_id: u64,
            commitment: felt252,
            kind: BallotKind,
            round: u8,
            target_seat: u32,
        ) -> Span<OpenNoteDeposit> {
            let m = self.load_match(match_id);
            assert(m.phase == MatchPhase::Playing, errors::BAD_PHASE);
            assert(round >= 1 && round <= m.rounds, errors::BAD_ROUND);
            assert(commitment.is_non_zero(), errors::REPLAY);
            assert(!self.receipts.entry(commitment).read().exists, errors::REPLAY);

            // Proof that a ballot was really spent: the pool withdrew one to us. Burning the
            // whole balance keeps the accounting self-healing — a ballot sitting here is by
            // definition already spent.
            let ballot_token = self.ballot_token.read();
            let held = IERC20Dispatcher { contract_address: ballot_token }
                .balance_of(get_contract_address());
            assert(held >= 1_u256, errors::BAD_BALLOT);
            IBallotTokenDispatcher { contract_address: ballot_token }
                .burn(get_contract_address(), held);

            let is_kill = match kind {
                BallotKind::Vote => false,
                BallotKind::Kill => true,
            };

            if is_kill {
                assert(target_seat < m.seats_filled, errors::BAD_TARGET);
                let n = self.kill_count.entry(match_id).read();
                assert(n < MAX_KILLS, errors::TOO_MANY_KILLS);
                self
                    .kills
                    .entry((match_id, n))
                    .write(KillClaim { commitment, victim_seat: target_seat, round, validated: false });
                self.kill_count.entry(match_id).write(n + 1);
            } else {
                assert(
                    target_seat < m.seats_filled || target_seat == NO_TARGET, errors::BAD_TARGET,
                );
                let votes = self.tally.entry((match_id, round, target_seat)).read();
                self.tally.entry((match_id, round, target_seat)).write(votes + 1);
            }

            // The receipt is stored under its own hash, so the table itself reveals nothing.
            self
                .receipts
                .entry(commitment)
                .write(VoteReceipt { match_id, round, target_seat, exists: true });
            self.emit(BallotCast { match_id, round, target_seat, is_kill, receipt: commitment });

            [].span()
        }

        /// Pulls a settled payout into an open note. The claim secret — committed at join
        /// time and never published — is what proves ownership, so publishing the role
        /// secret at reveal time cannot be used by anyone else to steal the money.
        fn do_claim(
            ref self: ContractState, match_id: u64, claim_secret: felt252, note_id: felt252,
        ) -> Span<OpenNoteDeposit> {
            let m = self.load_match(match_id);
            assert(
                m.phase == MatchPhase::Settled || m.phase == MatchPhase::Aborted,
                errors::BAD_PHASE,
            );
            let claim_commitment = hashing::claim_commitment(claim_secret);

            // Find the seat whose reveal published this claim commitment.
            let mut found: u32 = MAX_SEATS + 1;
            for i in 0..m.seats_filled {
                if self.seats.entry((match_id, i)).read().claim_commitment == claim_commitment {
                    found = i;
                    break;
                }
            }
            assert(found <= MAX_SEATS, errors::NOT_REVEALED);

            let mut s = self.seats.entry((match_id, found)).read();
            assert(!s.claimed, errors::ALREADY_CLAIMED);
            assert(s.payout > 0, errors::NOTHING_TO_CLAIM);
            s.claimed = true;
            let amount = s.payout;
            self.seats.entry((match_id, found)).write(s);

            let stake_token = self.stake_token.read();
            let pool = self.privacy_pool.read();
            IERC20Dispatcher { contract_address: stake_token }.approve(pool, amount.into());
            self.accounted_stake.write(self.accounted_stake.read() - amount);
            self.emit(PayoutClaimed { match_id, seat_index: found, amount });

            [OpenNoteDeposit { note_id, token: stake_token, amount }].span()
        }

        /// Seat indices that revealed an impostor draw.
        fn collect_impostors(
            self: @ContractState, match_id: u64, seats_filled: u32,
        ) -> Array<u32> {
            let mut out: Array<u32> = array![];
            for i in 0..seats_filled {
                let s = self.seats.entry((match_id, i)).read();
                if s.revealed && s.is_impostor {
                    out.append(i);
                }
            }
            out
        }

        /// A night action only counts if a revealed impostor's secret reproduces its
        /// commitment. Anything else was a bluff, and a bluff costs the bluffer their stake.
        fn validate_kills(ref self: ContractState, match_id: u64, impostors: @Array<u32>) {
            let n = self.kill_count.entry(match_id).read();
            for k in 0..n {
                let mut claim = self.kills.entry((match_id, k)).read();
                let mut valid = false;
                for j in 0..impostors.len() {
                    let idx = *impostors.at(j);
                    let s = self.seats.entry((match_id, idx)).read();
                    if hashing::kill_commitment(s.role_secret, claim.round, claim.victim_seat)
                        == claim.commitment {
                        valid = true;
                        break;
                    }
                }
                claim.validated = valid;
                self.kills.entry((match_id, k)).write(claim);
            }
        }

        /// Round by round: night actions land first, then the meeting ejects whoever the
        /// tally singles out. Every claimed kill is applied — the engine could not tell a
        /// real one from a bluff at the time either — and bluffs are punished at payout.
        fn replay_eliminations(ref self: ContractState, match_id: u64, m: MatchInfo) {
            let kills = self.kill_count.entry(match_id).read();
            for r in 1..(m.rounds_played + 1) {
                // Night.
                for k in 0..kills {
                    let claim = self.kills.entry((match_id, k)).read();
                    if claim.round == r {
                        let mut victim = self.seats.entry((match_id, claim.victim_seat)).read();
                        if !victim.eliminated {
                            victim.eliminated = true;
                            victim.eliminated_round = r;
                            self.seats.entry((match_id, claim.victim_seat)).write(victim);
                        }
                    }
                }

                // Meeting: a strict plurality ejects; a tie or a skip majority ejects nobody.
                let mut top_seat: u32 = NO_TARGET;
                let mut top_votes: u32 = 0;
                let mut tied = false;
                for i in 0..m.seats_filled {
                    let v = self.tally.entry((match_id, r, i)).read();
                    if v > top_votes {
                        top_votes = v;
                        top_seat = i;
                        tied = false;
                    } else if v == top_votes && v > 0 {
                        tied = true;
                    }
                }
                let skips = self.tally.entry((match_id, r, NO_TARGET)).read();
                if top_votes > 0 && !tied && top_votes > skips && top_seat != NO_TARGET {
                    let mut ejected = self.seats.entry((match_id, top_seat)).read();
                    if !ejected.eliminated {
                        ejected.eliminated = true;
                        ejected.eliminated_round = r;
                        self.seats.entry((match_id, top_seat)).write(ejected);
                    }
                }
            }
        }

        fn count_alive(self: @ContractState, match_id: u64, seats_filled: u32) -> (u32, u32) {
            let mut alive_impostors = 0_u32;
            let mut alive_crew = 0_u32;
            for i in 0..seats_filled {
                let s = self.seats.entry((match_id, i)).read();
                if !s.eliminated {
                    if s.revealed && s.is_impostor {
                        alive_impostors += 1;
                    } else {
                        alive_crew += 1;
                    }
                }
            }
            (alive_impostors, alive_crew)
        }

        /// The Detective Pool. Every vote that named a real impostor earns weight, and an
        /// early call is worth more than a late one because there was less to go on.
        fn score_detectives(
            ref self: ContractState,
            match_id: u64,
            seats_filled: u32,
            rounds_played: u8,
            impostors: @Array<u32>,
        ) -> u64 {
            let mut total: u64 = 0;
            for i in 0..seats_filled {
                let s = self.seats.entry((match_id, i)).read();
                if !s.revealed {
                    continue;
                }
                let mut weight: u64 = 0;
                for r in 1..(rounds_played + 1) {
                    for j in 0..impostors.len() {
                        let target = *impostors.at(j);
                        let receipt = hashing::vote_receipt(s.role_secret, r, target);
                        let rec = self.receipts.entry(receipt).read();
                        if rec.exists && rec.match_id == match_id {
                            // Earlier rounds carry more weight.
                            weight += (rounds_played - r + 1).into();
                        }
                    }
                }
                if weight > 0 {
                    self.det_weight.entry((match_id, i)).write(weight);
                    total += weight;
                }
            }
            total
        }

        /// Splits the pot: protocol fee, Detective Pool, then the main pot across the
        /// winning side. Unrevealed seats and proven bluffers forfeit; their stakes stay in
        /// the pot and enlarge everyone else's share.
        fn pay_out(
            ref self: ContractState, match_id: u64, ref m: MatchInfo, weight_total: u64,
        ) {
            let pot = m.pot;
            let fee = pot * m.protocol_bps.into() / BPS_DENOM;
            let detective = if weight_total > 0 {
                pot * m.detective_bps.into() / BPS_DENOM
            } else {
                0
            };
            let main = pot - fee - detective;

            // Who is eligible for the main pot: revealed, on the winning side, not a bluffer.
            let mut winners: u32 = 0;
            for i in 0..m.seats_filled {
                if self.is_winner(match_id, i, m.crew_won) {
                    winners += 1;
                }
            }

            let per_winner = if winners > 0 {
                main / winners.into()
            } else {
                0
            };
            let mut distributed: u128 = 0;

            for i in 0..m.seats_filled {
                let mut s = self.seats.entry((match_id, i)).read();
                let mut amount: u128 = 0;
                if self.is_winner(match_id, i, m.crew_won) {
                    amount += per_winner;
                }
                if weight_total > 0 {
                    let w = self.det_weight.entry((match_id, i)).read();
                    if w > 0 {
                        amount += detective * w.into() / weight_total.into();
                    }
                }
                if amount > 0 {
                    s.payout = amount;
                    self.seats.entry((match_id, i)).write(s);
                    distributed += amount;
                }
            }

            // Anything left — the rounding dust, plus the whole main pot if nobody was
            // eligible — becomes protocol fees rather than sitting unreachable.
            self.protocol_fees.write(self.protocol_fees.read() + (pot - distributed));
        }

        /// A seat shares the main pot if it revealed, was on the winning side, and did not
        /// submit a night action it had no right to submit.
        fn is_winner(self: @ContractState, match_id: u64, seat_index: u32, crew_won: bool) -> bool {
            let s = self.seats.entry((match_id, seat_index)).read();
            if !s.revealed {
                return false;
            }
            if s.is_impostor == crew_won {
                return false;
            }
            !self.is_bluffer(match_id, seat_index)
        }

        /// True if this seat authored a night action that settlement could not validate —
        /// that is, a crewmate who claimed a kill they were never entitled to make.
        fn is_bluffer(self: @ContractState, match_id: u64, seat_index: u32) -> bool {
            let s = self.seats.entry((match_id, seat_index)).read();
            let n = self.kill_count.entry(match_id).read();
            let mut bluffed = false;
            for k in 0..n {
                let claim = self.kills.entry((match_id, k)).read();
                if claim.validated {
                    continue;
                }
                if hashing::kill_commitment(s.role_secret, claim.round, claim.victim_seat)
                    == claim.commitment {
                    bluffed = true;
                    break;
                }
            }
            bluffed
        }
    }

    /// Note amounts are `u128`; anything wider is a bug or an attack, so fail loudly.
    fn u256_to_u128(value: u256) -> u128 {
        assert(value.high == 0, errors::U128_OVERFLOW);
        value.low
    }
}
