use anchor_lang::prelude::*;
use light_compressed_token::{
    process_transfer::{
        CompressedTokenInstructionDataTransfer, InputTokenDataWithContext,
        PackedTokenTransferOutputData,
    },
    program::LightCompressedToken,
};

#[derive(Accounts, LightTraits)]
pub struct DepositCompressedRewards<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut, has_one = creator)]
    pub event: Account<'info, Event>,

    pub compressed_token_program: Program<'info, LightCompressedToken>,
    /// CHECK:
    pub compressed_token_cpi_authority_pda: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

impl <'info> Deposit<'info>{
    pub fn deposit(&mut self) -> Result<()>{


        Ok(())
    }
}
