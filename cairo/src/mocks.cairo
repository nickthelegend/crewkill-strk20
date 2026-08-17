//! Test doubles.
//!
//! `MockPrivacyPool` reproduces the exact sandwich the real STRK20 pool performs around
//! `privacy_invoke`: withdraw inputs to the helper, call it, then pull whatever the returned
//! `OpenNoteDeposit`s say it may pull. Testing against this is what proves the CrewKill
//! helper honours the protocol's contract — approve-don't-transfer, balance-delta accounting,
//! and an empty span meaning "credit nothing".
//!
//! These are also useful outside tests: the devnet deployment wires the game to the mock
//! pool so a full match can be played end to end without a proving service.

/// A minimal mintable ERC-20 standing in for STRK.
#[starknet::contract]
pub mod MockERC20 {
    use core::num::traits::Zero;
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address};
    use crate::interfaces::IERC20;

    #[storage]
    struct Storage {
        balances: Map<ContractAddress, u256>,
        allowances: Map<(ContractAddress, ContractAddress), u256>,
        total_supply: u256,
    }

    #[starknet::interface]
    pub trait IMintable<T> {
        fn mint(ref self: T, recipient: ContractAddress, amount: u256);
    }

    #[constructor]
    fn constructor(ref self: ContractState) {}

    #[abi(embed_v0)]
    impl MintableImpl of IMintable<ContractState> {
        fn mint(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            self.balances.entry(recipient).write(self.balances.entry(recipient).read() + amount);
            self.total_supply.write(self.total_supply.read() + amount);
        }
    }

    #[abi(embed_v0)]
    impl ERC20Impl of IERC20<ContractState> {
        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.entry(account).read()
        }
        fn total_supply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }
        fn allowance(
            self: @ContractState, owner: ContractAddress, spender: ContractAddress,
        ) -> u256 {
            self.allowances.entry((owner, spender)).read()
        }
        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            self.allowances.entry((get_caller_address(), spender)).write(amount);
            true
        }
        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            let from = get_caller_address();
            let bal = self.balances.entry(from).read();
            assert(bal >= amount, 'ERC20: insufficient balance');
            assert(recipient.is_non_zero(), 'ERC20: zero recipient');
            self.balances.entry(from).write(bal - amount);
            self.balances.entry(recipient).write(self.balances.entry(recipient).read() + amount);
            true
        }
        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            let caller = get_caller_address();
            let allowed = self.allowances.entry((sender, caller)).read();
            assert(allowed >= amount, 'ERC20: insufficient allowance');
            self.allowances.entry((sender, caller)).write(allowed - amount);
            let bal = self.balances.entry(sender).read();
            assert(bal >= amount, 'ERC20: insufficient balance');
            self.balances.entry(sender).write(bal - amount);
            self.balances.entry(recipient).write(self.balances.entry(recipient).read() + amount);
            true
        }
    }
}

/// Stands in for the STRK20 privacy pool: shielded balances kept per (owner, token), the
/// withdraw → invoke → credit sandwich, and open notes.
#[starknet::contract]
pub mod MockPrivacyPool {
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use crate::interfaces::{IERC20Dispatcher, IERC20DispatcherTrait};
    use crate::objects::{BallotKind, CrewKillOperation, OpenNoteDeposit};

    #[starknet::interface]
    pub trait IMockPool<T> {
        /// Shield: move public tokens into a private balance.
        fn deposit(ref self: T, token: ContractAddress, amount: u128);
        /// Private transfer between shielded balances.
        fn private_transfer(
            ref self: T, token: ContractAddress, to: ContractAddress, amount: u128,
        );
        fn shielded_balance(self: @T, owner: ContractAddress, token: ContractAddress) -> u128;
        /// The sandwich. `in_token`/`in_amount` are withdrawn from the caller's shielded
        /// balance to `helper` before the call; every returned deposit is pulled back and
        /// credited to `note_owner`.
        fn invoke(
            ref self: T,
            helper: ContractAddress,
            in_token: ContractAddress,
            in_amount: u128,
            note_owner: ContractAddress,
            operation: CrewKillOperation,
            match_id: u64,
            commitment: felt252,
            kind: BallotKind,
            round: u8,
            target_seat: u32,
            secret: felt252,
            note_id: felt252,
        );
    }

    #[starknet::interface]
    trait IHelper<T> {
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

    #[storage]
    struct Storage {
        shielded: Map<(ContractAddress, ContractAddress), u128>,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {}

    #[abi(embed_v0)]
    impl MockPoolImpl of IMockPool<ContractState> {
        fn deposit(ref self: ContractState, token: ContractAddress, amount: u128) {
            let caller = get_caller_address();
            IERC20Dispatcher { contract_address: token }
                .transfer_from(caller, get_contract_address(), amount.into());
            let key = (caller, token);
            self.shielded.entry(key).write(self.shielded.entry(key).read() + amount);
        }

        fn private_transfer(
            ref self: ContractState, token: ContractAddress, to: ContractAddress, amount: u128,
        ) {
            let from = get_caller_address();
            let bal = self.shielded.entry((from, token)).read();
            assert(bal >= amount, 'POOL: insufficient shielded');
            self.shielded.entry((from, token)).write(bal - amount);
            self.shielded.entry((to, token)).write(self.shielded.entry((to, token)).read() + amount);
        }

        fn shielded_balance(
            self: @ContractState, owner: ContractAddress, token: ContractAddress,
        ) -> u128 {
            self.shielded.entry((owner, token)).read()
        }

        fn invoke(
            ref self: ContractState,
            helper: ContractAddress,
            in_token: ContractAddress,
            in_amount: u128,
            note_owner: ContractAddress,
            operation: CrewKillOperation,
            match_id: u64,
            commitment: felt252,
            kind: BallotKind,
            round: u8,
            target_seat: u32,
            secret: felt252,
            note_id: felt252,
        ) {
            let caller = get_caller_address();
            if in_amount > 0 {
                let bal = self.shielded.entry((caller, in_token)).read();
                assert(bal >= in_amount, 'POOL: insufficient shielded');
                self.shielded.entry((caller, in_token)).write(bal - in_amount);
                IERC20Dispatcher { contract_address: in_token }
                    .transfer(helper, in_amount.into());
            }

            let deposits = IHelperDispatcher { contract_address: helper }
                .privacy_invoke(
                    operation, match_id, commitment, kind, round, target_seat, secret, note_id,
                );

            // Approve-don't-transfer: the pool pulls what the helper allowed.
            for i in 0..deposits.len() {
                let d = *deposits.at(i);
                IERC20Dispatcher { contract_address: d.token }
                    .transfer_from(helper, get_contract_address(), d.amount.into());
                let key = (note_owner, d.token);
                self.shielded.entry(key).write(self.shielded.entry(key).read() + d.amount);
            }
        }
    }
}
