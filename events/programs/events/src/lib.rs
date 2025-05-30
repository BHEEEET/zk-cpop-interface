#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
mod instructions;
mod state;
use crate::instructions::*;

declare_id!("9bzx1HunSwH6ME3MDpaBfnBqPUqpkar9ZYgpdz1meSgh");

#[program]
pub mod events {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, name: String, description: String) -> Result<()> {
        ctx.accounts.init_event(name,description);
        Ok(())
    }
}
