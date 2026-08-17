//! CKBALLOT — the ballot token.
//!
//! It has no market value. Its only job is to exist as an ERC-20 so the STRK20 pool can
//! hold it as a shielded note. Casting a vote means *spending* one of these notes, and the
//! pool proves note ownership without revealing which note was spent. That is where the
//! anonymity of a CrewKill vote actually comes from — not from the game contract, which
//! never learns who voted.
//!
//! A minimal, self-contained SNIP-2 implementation: one dependency-free file keeps the
//! whole package buildable on a stock Cairo toolchain.

#[starknet::contract]
pub mod BallotToken {
    use core::num::traits::Zero;
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address};
    use crate::constants::errors;
    use crate::interfaces::{IBallotToken, IERC20};

    #[storage]
    struct Storage {
        balances: Map<ContractAddress, u256>,
        allowances: Map<(ContractAddress, ContractAddress), u256>,
        total_supply: u256,
        minter: ContractAddress,
        owner: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Transfer: Transfer,
        Approval: Approval,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Transfer {
        #[key]
        pub from: ContractAddress,
        #[key]
        pub to: ContractAddress,
        pub value: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Approval {
        #[key]
        pub owner: ContractAddress,
        #[key]
        pub spender: ContractAddress,
        pub value: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        assert(owner.is_non_zero(), errors::ZERO_ADDRESS);
        self.owner.write(owner);
        self.minter.write(owner);
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

        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            self.move_tokens(get_caller_address(), recipient, amount);
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
            assert(allowed >= amount, 'CKB: insufficient allowance');
            self.allowances.entry((sender, caller)).write(allowed - amount);
            self.move_tokens(sender, recipient, amount);
            true
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            self.allowances.entry((caller, spender)).write(amount);
            self.emit(Approval { owner: caller, spender, value: amount });
            true
        }
    }

    #[abi(embed_v0)]
    impl BallotImpl of IBallotToken<ContractState> {
        fn mint(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            assert(get_caller_address() == self.minter.read(), errors::NOT_OWNER);
            self.total_supply.write(self.total_supply.read() + amount);
            let bal = self.balances.entry(recipient).read();
            self.balances.entry(recipient).write(bal + amount);
            self.emit(Transfer { from: Zero::zero(), to: recipient, value: amount });
        }

        fn burn(ref self: ContractState, account: ContractAddress, amount: u256) {
            assert(get_caller_address() == self.minter.read(), errors::NOT_OWNER);
            let bal = self.balances.entry(account).read();
            assert(bal >= amount, 'CKB: burn exceeds balance');
            self.balances.entry(account).write(bal - amount);
            self.total_supply.write(self.total_supply.read() - amount);
            self.emit(Transfer { from: account, to: Zero::zero(), value: amount });
        }

        fn set_minter(ref self: ContractState, minter: ContractAddress) {
            assert(get_caller_address() == self.owner.read(), errors::NOT_OWNER);
            assert(minter.is_non_zero(), errors::ZERO_ADDRESS);
            self.minter.write(minter);
        }

        fn minter(self: @ContractState) -> ContractAddress {
            self.minter.read()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn move_tokens(
            ref self: ContractState,
            from: ContractAddress,
            to: ContractAddress,
            amount: u256,
        ) {
            assert(to.is_non_zero(), errors::ZERO_ADDRESS);
            let bal = self.balances.entry(from).read();
            assert(bal >= amount, 'CKB: insufficient balance');
            self.balances.entry(from).write(bal - amount);
            let to_bal = self.balances.entry(to).read();
            self.balances.entry(to).write(to_bal + amount);
            self.emit(Transfer { from, to, value: amount });
        }
    }
}
