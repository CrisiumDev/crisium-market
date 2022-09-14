import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

import "./Classifieds.sol";

contract ClassifiedsFactory is Context, AccessControlEnumerable {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    event ClassifiedCreated(string itemName, string itemSymbol, address indexed itemToken, address indexed currencyToken, address indexed classifieds);

    mapping(address => Classifieds) public classifieds;
    address public currencyToken;

    constructor(address _currencyTokenAddress) {
        currencyToken = _currencyTokenAddress;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(MANAGER_ROLE, _msgSender());
    }

    function createClassifieds(address _itemTokenAddress) external returns (address) {
        require(hasRole(MANAGER_ROLE, _msgSender()), "ClassifiedsFactory: not authorized");
        require(_itemTokenAddress != address(0), "ClassifiedsFactory: invalid address");
        require(address(classifieds[_itemTokenAddress]) == address(0), "ClassifiedsFactory: already created");

        Classifieds c = new Classifieds(_itemTokenAddress, currencyToken);
        classifieds[_itemTokenAddress] = c;

        bool metadata = ERC165Checker.supportsInterface(_itemTokenAddress, type(IERC721Metadata).interfaceId);

        emit ClassifiedCreated(
            metadata ? IERC721Metadata(_itemTokenAddress).name() : "Unknown Name",
            metadata ? IERC721Metadata(_itemTokenAddress).symbol() : "Unknown Symbol",
            _itemTokenAddress,
            currencyToken,
            address(c)
        );

        return address(c);
    }

    function pause(address _classifiedsOrItemToken) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "ClassifiedsFactory: not authorized");

        Classifieds c = classifieds[_classifiedsOrItemToken];
        if (address(c) != address(0)) {
            c.pause();
        } else {
            Classifieds(_classifiedsOrItemToken).pause();
        }
    }

    function unpause(address _classifiedsOrItemToken) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "ClassifiedsFactory: not authorized");

        Classifieds c = classifieds[_classifiedsOrItemToken];
        if (address(c) != address(0)) {
            c.unpause();
        } else {
            Classifieds(_classifiedsOrItemToken).unpause();
        }
    }
}
