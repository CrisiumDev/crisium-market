import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

pragma solidity ^0.8.0;
contract MockERC721 is ERC721 {
    uint256 public totalSupply;
    bool public universalApproval;

    constructor(
        string memory name,
        string memory symbol
    ) ERC721(name, symbol) {

    }

    function mint(address to, uint256[] calldata tokenIds) public {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            _mint(to, tokenIds[i]);
        }

        totalSupply += tokenIds.length;
    }

    function setUniversalApproval(bool _universalApproval) public {
        universalApproval = _universalApproval;
    }

    /**
     * @dev Returns whether `spender` is allowed to manage `tokenId`.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view override virtual returns (bool) {
        return universalApproval || super._isApprovedOrOwner(spender, tokenId);
    }
}
