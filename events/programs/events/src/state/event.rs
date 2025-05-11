use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Event{
    pub creator: Pubkey,
    #[max_len(32)]
    pub name: String,
    #[max_len(100)]
    pub description: String,
    pub rewards_bump: u8,
    pub bump: u8,
    pub reward_escrow_index: u8
}