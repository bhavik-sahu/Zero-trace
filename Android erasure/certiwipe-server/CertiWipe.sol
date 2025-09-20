// SPDX-License-Identifier: MIT
// Specifies the license for the code.
pragma solidity ^0.8.20;

// Import the standard, secure code for an ERC721 NFT from OpenZeppelin.
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
// Import a security feature that ensures only the owner can mint new tokens.
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CertiWipe
 * @dev An ERC721 token where each token represents a unique data wipe certificate.
 * The token stores a pointer (an IPFS CID) to the off-chain certificate data.
 */
contract CertiWipe is ERC721, Ownable {
    // A counter to keep track of the next token ID to be minted.
    uint256 private _nextTokenId;

    // A mapping (like a dictionary) from a token ID to its IPFS CID string.
    mapping(uint256 => string) private _tokenCIDs;

    /**
     * @dev The constructor runs once when the contract is deployed.
     * It sets the name and symbol for your NFT collection.
     * It also sets the deployer of the contract as the initial owner.
     */
    constructor() ERC721("CertiWipe Certificate", "CWC") Ownable(msg.sender) {}

    /**
     * @dev Mints a new certificate NFT and associates it with an IPFS CID.
     * Only the owner of the contract (your server's wallet) can call this function.
     * @param recipient The address that will receive the newly minted NFT.
     * @param ipfsCID The IPFS Content Identifier for the certificate data.
     * @return The ID of the newly minted token.
     */
    function mintCertificate(address recipient, string memory ipfsCID)
        public
        onlyOwner // This is the security check.
        returns (uint256)
    {
        uint256 tokenId = _nextTokenId++;
        _safeMint(recipient, tokenId);
        _tokenCIDs[tokenId] = ipfsCID;
        return tokenId;
    }

    /**
     * @dev A public function to allow anyone to view the IPFS CID for a given token.
     * @param tokenId The ID of the token to query.
     * @return The IPFS CID string associated with the token ID.
     */
    function getTokenCID(uint256 tokenId) public view returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        return _tokenCIDs[tokenId];
    }
}