import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

pragma solidity ^0.8.0;
contract MockERC721Resale is ERC721, IERC2981 {
    uint256 public totalSupply;
    bool public universalApproval;

    address public royaltyReceiver;
    uint256 public royaltyPercentBips;

    constructor(
        string memory name,
        string memory symbol
    ) ERC721(name, symbol) {
        royaltyReceiver = msg.sender;
        royaltyPercentBips = 0;
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

    function royaltyInfo(
        uint256, /*_tokenId*/
        uint256 _salePrice
    )
        external
        view
        virtual
        override
        returns (address receiver, uint256 royaltyAmount)
    {
        receiver = address(royaltyReceiver);
        royaltyAmount = (_salePrice * royaltyPercentBips) / 10000;
    }

    function setRoyalty(address receiver, uint256 percentBips) external virtual {
        royaltyReceiver = receiver;
        royaltyPercentBips = percentBips;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721, IERC165)
        returns (bool)
    {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }
}
