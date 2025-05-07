import { homedir } from "os";
import "dotenv/config"
import { Rpc, confirmTx, createRpc } from "@lightprotocol/stateless.js";
import {
    compress,
    CompressedTokenProgram,
    transfer,
} from "@lightprotocol/compressed-token";
import {
    getOrCreateAssociatedTokenAccount,
    mintTo as mintToSpl,
    TOKEN_2022_PROGRAM_ID,
    createInitializeMetadataPointerInstruction,
    createInitializeMintInstruction,
    ExtensionType,
    getMintLen,
    LENGTH_SIZE,
    TYPE_SIZE,
} from "@solana/spl-token";
import {
    Keypair,
    sendAndConfirmTransaction,
    SystemProgram,
    Transaction,
} from "@solana/web3.js";
import {
    createInitializeInstruction,
    pack,
    TokenMetadata,
} from "@solana/spl-token-metadata";
import { readFileSync } from "fs";

const payer = Keypair.fromSecretKey(
    Uint8Array.from(
        JSON.parse(readFileSync(homedir() + "/.config/solana/id.json", "utf-8"))
    )
);

//const RPC_ENDPOINT = "https://api.devnet.solana.com";
const RPC_ENDPOINT = process.env.DEVNET_RPC_URL;

const connection: Rpc = createRpc(RPC_ENDPOINT, RPC_ENDPOINT, RPC_ENDPOINT);

(async () => {
    const mint = Keypair.generate();
    const decimals = 9;

    console.log(payer.publicKey.toBase58())

    const metadata: TokenMetadata = {
        mint: mint.publicKey,
        name: "name",
        symbol: "symbol",
        uri: "uri",
        additionalMetadata: [["t1", "Test"]],
    };

    const mintLen = getMintLen([ExtensionType.MetadataPointer]);

    const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;

    // airdrop to pay gas
    await confirmTx(
        connection,
        await connection.requestAirdrop(payer.publicKey, 1e7)
    );

    const mintLamports = await connection.getMinimumBalanceForRentExemption(
        mintLen + metadataLen
    );

    const mintTransaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: mint.publicKey,
            space: mintLen,
            lamports: mintLamports,
            programId: TOKEN_2022_PROGRAM_ID,
        }),
        createInitializeMetadataPointerInstruction(
            mint.publicKey,
            payer.publicKey,
            mint.publicKey,
            TOKEN_2022_PROGRAM_ID
        ),
        createInitializeMintInstruction(
            mint.publicKey,
            decimals,
            payer.publicKey,
            null,
            TOKEN_2022_PROGRAM_ID
        ),
        createInitializeInstruction({
            programId: TOKEN_2022_PROGRAM_ID,
            mint: mint.publicKey,
            metadata: mint.publicKey,
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadata.uri,
            mintAuthority: payer.publicKey,
            updateAuthority: payer.publicKey,
        }),
    );

    const txId = await sendAndConfirmTransaction(connection, mintTransaction, [
        payer,
        mint,
    ]);

    // ✅ STEP 1: Create the instruction
    const createPoolIx = await CompressedTokenProgram.createTokenPool({
        feePayer: payer.publicKey,
        mint: mint.publicKey,
        tokenProgramId: TOKEN_2022_PROGRAM_ID,
    });

    // ✅ STEP 2: Create a standalone transaction for it
    const poolTx = new Transaction().add(createPoolIx);

    // ✅ STEP 3: Send and confirm it with the appropriate signers
    const poolTxId = await sendAndConfirmTransaction(connection, poolTx, [payer]);
    console.log(`Token pool created! txId: ${poolTxId}`);

    console.log(`txId: ${txId}`);

    const ata = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint.publicKey,
        payer.publicKey,
        undefined,
        undefined,
        undefined,
        TOKEN_2022_PROGRAM_ID
    );

    console.log(`ATA: ${ata.address}`);
    // Mint SPL
    const mintTxId = await mintToSpl(
        connection,
        payer,
        mint.publicKey,
        ata.address,
        payer.publicKey,
        1e5,
        undefined,
        undefined,
        TOKEN_2022_PROGRAM_ID
    );
    console.log(`mint-spl success! txId: ${mintTxId}`);

    const compressedTokenTxId = await compress(
        connection,
        payer,
        mint.publicKey,
        1e5,
        payer,
        ata.address,
        payer.publicKey
    );
    console.log(`compressed-token success! txId: ${compressedTokenTxId}`);

    // compressed transfers do not require the passing of a token program id.
    const transferCompressedTxId = await transfer(
        connection,
        payer,
        mint.publicKey,
        1e5,
        payer,
        payer.publicKey // self-transfer
    );
    console.log(`transfer-compressed success! txId: ${transferCompressedTxId}`);
})();