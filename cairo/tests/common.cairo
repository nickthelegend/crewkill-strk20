use crewkill::interfaces::{
    IBallotTokenDispatcher, IBallotTokenDispatcherTrait, ICrewKillDispatcher,
    ICrewKillDispatcherTrait, IERC20Dispatcher, IERC20DispatcherTrait,
};
use crewkill::mocks::MockERC20::{IMintableDispatcher, IMintableDispatcherTrait};
use crewkill::mocks::MockPrivacyPool::{IMockPoolDispatcher, IMockPoolDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;

pub const STAKE: u128 = 1000;
pub const ROUNDS: u8 = 3;
pub const SEATS: u32 = 4;
/// 100% of draws land in the impostor band — used by tests that need a known role.
pub const ALL_IMPOSTOR_BPS: u16 = 9999;
pub const DETECTIVE_BPS: u16 = 1200;
pub const PROTOCOL_BPS: u16 = 300;

#[derive(Copy, Drop)]
pub struct World {
    pub game: ICrewKillDispatcher,
    pub game_addr: ContractAddress,
    pub pool: IMockPoolDispatcher,
    pub pool_addr: ContractAddress,
    pub stake: IERC20Dispatcher,
    pub stake_addr: ContractAddress,
    pub ballot_addr: ContractAddress,
    pub owner: ContractAddress,
    pub keeper: ContractAddress,
}

pub fn addr(v: felt252) -> ContractAddress {
    v.try_into().unwrap()
}

pub fn deploy_world() -> World {
    let owner = addr('owner');
    let keeper = addr('keeper');

    let erc20_class = declare("MockERC20").unwrap().contract_class();
    let (stake_addr, _) = erc20_class.deploy(@array![]).unwrap();

    let pool_class = declare("MockPrivacyPool").unwrap().contract_class();
    let (pool_addr, _) = pool_class.deploy(@array![]).unwrap();

    let ballot_class = declare("BallotToken").unwrap().contract_class();
    let (ballot_addr, _) = ballot_class.deploy(@array![owner.into()]).unwrap();

    let game_class = declare("CrewKill").unwrap().contract_class();
    let (game_addr, _) = game_class
        .deploy(
            @array![
                owner.into(),
                keeper.into(),
                pool_addr.into(),
                stake_addr.into(),
                ballot_addr.into(),
            ],
        )
        .unwrap();

    // Only the game may mint ballots.
    start_cheat_caller_address(ballot_addr, owner);
    IBallotTokenDispatcher { contract_address: ballot_addr }.set_minter(game_addr);
    stop_cheat_caller_address(ballot_addr);

    World {
        game: ICrewKillDispatcher { contract_address: game_addr },
        game_addr,
        pool: IMockPoolDispatcher { contract_address: pool_addr },
        pool_addr,
        stake: IERC20Dispatcher { contract_address: stake_addr },
        stake_addr,
        ballot_addr,
        owner,
        keeper,
    }
}

/// Mints public tokens to `who` and shields them in the pool.
pub fn fund_and_shield(w: World, who: ContractAddress, amount: u128) {
    IMintableDispatcher { contract_address: w.stake_addr }.mint(who, amount.into());
    start_cheat_caller_address(w.stake_addr, who);
    w.stake.approve(w.pool_addr, amount.into());
    stop_cheat_caller_address(w.stake_addr);
    start_cheat_caller_address(w.pool_addr, who);
    w.pool.deposit(w.stake_addr, amount);
    stop_cheat_caller_address(w.pool_addr);
}

pub fn fund_treasury(w: World, amount: u128) {
    IMintableDispatcher { contract_address: w.stake_addr }.mint(w.owner, amount.into());
    start_cheat_caller_address(w.stake_addr, w.owner);
    w.stake.approve(w.game_addr, amount.into());
    stop_cheat_caller_address(w.stake_addr);
    start_cheat_caller_address(w.game_addr, w.owner);
    w.game.fund_treasury(amount);
    stop_cheat_caller_address(w.game_addr);
}
