use crate::state::Event;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::rent::{
    DEFAULT_EXEMPTION_THRESHOLD, DEFAULT_LAMPORTS_PER_BYTE_YEAR,
};
use anchor_lang::system_program::{transfer, Transfer};
use anchor_spl::token_interface::{
    token_metadata_initialize, Mint, Token2022, TokenMetadataInitialize,
};

use light_compressed_account::instruction_data::compressed_proof::CompressedProof;
use light_compressed_token::{
    process_transfer::{
        CompressedTokenInstructionDataTransfer, InputTokenDataWithContext,
        PackedTokenTransferOutputData,
    },
    program::LightCompressedToken,
};
use light_sd::{light_system_accounts, LightTraits};
use light_sdk::{light_system_accounts, LightTraits};
use spl_token_metadata_interface::state::TokenMetadata;
use spl_type_length_value::variable_len_pack::VariableLenPack;

#[light_system_accounts]
#[derive(Accounts, LightTraits)]
#[instruction(name: String)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        seeds = [b"rewards", event.key().as_ref()],
        bump,
        mint::decimals = 2,
        mint:: authority = creator,
        extensions::metadata_pointer::authority = creator,
        extensions::metadata_pointer::metadata_address = rewards_mint,
    )]
    pub rewards_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = creator,
        seeds = [b"event",creator.key().as_ref(), name.as_bytes()],
        bump,
        space = Event::INIT_SPACE
    )]
    pub event: Account<'info, Event>,
    // PASS the existing mint here as input
    #[authority]
    #[account(
        seeds = [b"vault", creator.key().as_ref()],
        bump
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub compressed_token_program: Program<'info, LightCompressedToken>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    pub fn mint_tokens(&mut self, args: TokenMetadataArgs, bumps: &InitializeBumps) -> Result<()>{
        let TokenMetadataArgs { name, symbol, uri } = args;

        let token_metedata = TokenMetadata {
            name: name.clone(),
            symbol: symbol.clone(),
            uri: uri.clone(),
            ..Default::default()
        };

        let data_len = 4 + token_metedata.get_packed_len()?;

        let lamports =
            data_len as u64 * DEFAULT_LAMPORTS_PER_BYTE_YEAR * DEFAULT_EXEMPTION_THRESHOLD as u64;

        transfer(
            CpiContext::new(
                self.system_program.to_account_info(),
                Transfer {
                    from: self.creator.to_account_info(),
                    to: self.rewards_mint.to_account_info(),
                },
            ),
            lamports,
        )?;

        // Initialize token metadata
        token_metadata_initialize(
            CpiContext::new(
                self.token_program.to_account_info(),
                TokenMetadataInitialize {
                    program_id: self.token_program.to_account_info(),
                    mint: self.rewards_mint.to_account_info(),
                    metadata: self.rewards_mint.to_account_info(),
                    mint_authority: self.creator.to_account_info(),
                    update_authority: self.creator.to_account_info(),
                },
            ),
            name,
            symbol,
            uri,
        )?;

        Ok(())

    }

    pub fn init_event(
        &mut self,
        name_event: String,
        description_event: String,
        bumps: &InitializeBumps,
    ) -> Result<()> {
        self.event.set_inner(Event {
            creator: self.creator.key(),
            name: name_event,
            description: description_event,
            rewards_bump: bumps.rewards_mint,
            bump: bumps.event,
            reward_escrow_index: todo!(),
        });

        Ok(())
    }
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct TokenMetadataArgs {
    pub name: String,
    pub symbol: String,
    pub uri: String,
}
