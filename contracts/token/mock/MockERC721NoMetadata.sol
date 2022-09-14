import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

pragma solidity ^0.8.0;
contract MockERC721NoMetadata is ERC721 {
    uint256 public totalSupply;
    bool public universalApproval;

    constructor() ERC721("No Name", "No Symbol") {

    }

    /**
     * @dev See {IERC721Metadata-name}.
     */
    function name() public view virtual override returns (string memory) {
        require(false, "No Name");
    }

    /**
     * @dev See {IERC721Metadata-symbol}.
     */
    function symbol() public view virtual override returns (string memory) {
        require(false, "No Symbol");
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721) returns (bool) {
        if (interfaceId == type(IERC721Metadata).interfaceId) {
            return false;
        }
        return super.supportsInterface(interfaceId);
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
